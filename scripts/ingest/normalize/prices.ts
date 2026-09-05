import { IngestionContractError, MethodologyMismatchError } from '../types.ts';
import type { IndicatorDataset, IndicatorSource, PriceDatasetId, RawNbsPriceSeries } from '../types.ts';
import { mergeObservations } from '../validate/overlap.ts';
import { pruneSources } from '../validate/dataset.ts';
import { validatePriceDataset, validatePriceObservations } from '../validate/prices.ts';

function latestPeriod(dataset: IndicatorDataset): string {
  const latest = dataset.data.at(-1)?.date;
  if (!latest) throw new IngestionContractError(`Price dataset contains no observations: ${dataset.id}`);
  return latest;
}

function sourceOrder(left: IndicatorSource, right: IndicatorSource): number {
  return left.sourceDate.localeCompare(right.sourceDate)
    || Number(left.role === 'methodology') - Number(right.role === 'methodology')
    || left.url.localeCompare(right.url);
}

function sourceCoverageKey(source: IndicatorSource): string {
  return `${source.role ?? 'data'}|${source.coverage}`;
}

export function normalizePriceDataset(
  raw: RawNbsPriceSeries,
  existing: IndicatorDataset,
  id: PriceDatasetId,
): IndicatorDataset {
  validatePriceDataset(existing, id);
  if (raw.id !== id) throw new IngestionContractError(`Fetched NBS price dataset id mismatch: ${raw.id} != ${id}`);
  if (raw.methodologyFingerprint !== existing.methodologyFingerprint) {
    throw new MethodologyMismatchError(`Fetched NBS price methodology differs from existing dataset: ${id}`);
  }
  validatePriceObservations(raw.observations, id);

  const existingLatest = latestPeriod(existing);
  const incomingAddsNewPeriod = raw.observations.some(({ date }) => date > existingLatest);
  if (incomingAddsNewPeriod && raw.publication.sourceDate < existing.updatedAt) {
    throw new IngestionContractError(
      `Fetched NBS price publication is older than existing updatedAt: ${raw.publication.sourceDate} < ${existing.updatedAt}`,
    );
  }

  const data = mergeObservations(existing.data, raw.observations, `NBS ${id}`);
  const incomingUrls = new Set(raw.dataSources.map((source) => source.url));
  const incomingCoverageKeys = new Set(raw.dataSources.map(sourceCoverageKey));
  const candidates = [
    ...existing.sources.filter((source) => !incomingUrls.has(source.url) && !incomingCoverageKeys.has(sourceCoverageKey(source))),
    ...raw.dataSources,
  ].sort(sourceOrder);
  const pruned = pruneSources(candidates, data.map((observation) => observation.date));
  const sourceByKey = new Map<string, IndicatorSource>();
  for (const source of [...pruned, ...raw.dataSources]) sourceByKey.set(`${source.url}|${sourceCoverageKey(source)}`, source);
  const sources = [...sourceByKey.values()].sort(sourceOrder);
  const latestSource = sources.at(-1);
  if (!latestSource) throw new IngestionContractError(`NBS price dataset has no source after normalization: ${id}`);

  const normalized: IndicatorDataset = {
    ...existing,
    updatedAt: latestSource.sourceDate,
    methodologyFingerprint: existing.methodologyFingerprint,
    sources,
    data,
  };
  validatePriceDataset(normalized, id);
  return normalized;
}
