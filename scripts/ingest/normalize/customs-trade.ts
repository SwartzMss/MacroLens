import { IngestionContractError, MethodologyMismatchError, CUSTOMS_TRADE_CONTRACTS } from '../types.ts';
import type {
  CustomsTradeDatasetId,
  IndicatorDataset,
  IndicatorSource,
  RawCustomsTradePublication,
} from '../types.ts';
import { mergeObservations } from '../validate/overlap.ts';
import { validateCustomsTradeDataset, validateCustomsTradeObservations } from '../validate/customs-trade.ts';

function latestPeriod(dataset: IndicatorDataset): string {
  const latest = dataset.data.at(-1)?.date;
  if (!latest) throw new IngestionContractError(`Customs trade dataset contains no observations: ${dataset.id}`);
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

export function normalizeCustomsTradeDataset(
  raw: RawCustomsTradePublication,
  existing: IndicatorDataset,
  id: CustomsTradeDatasetId,
): IndicatorDataset {
  validateCustomsTradeDataset(existing, id);
  const contract = CUSTOMS_TRADE_CONTRACTS[id];
  if (raw.methodologyFingerprint !== contract.methodologyFingerprint) {
    throw new MethodologyMismatchError(`Fetched GACC methodology differs from existing dataset: ${id}`);
  }
  const incoming = raw.observations[id];
  if (!incoming) throw new IngestionContractError(`Fetched GACC publication is missing ${id}`);
  validateCustomsTradeObservations([incoming], id);

  const existingLatest = latestPeriod(existing);
  if (incoming.date > existingLatest && raw.publication.sourceDate < existing.updatedAt) {
    throw new IngestionContractError(
      `Fetched GACC publication is older than existing updatedAt: ${raw.publication.sourceDate} < ${existing.updatedAt}`,
    );
  }

  const data = mergeObservations(existing.data, [incoming], `GACC ${id}`);
  const incomingUrls = new Set(raw.dataSources.map((source) => source.url));
  const incomingCoverageKeys = new Set(raw.dataSources.map(sourceCoverageKey));
  const candidates = [
    ...existing.sources.filter((source) => !incomingUrls.has(source.url) && !incomingCoverageKeys.has(sourceCoverageKey(source))),
    ...raw.dataSources,
  ].sort(sourceOrder);
  const sources = [...new Map(
    candidates.map((source) => [`${source.url}|${sourceCoverageKey(source)}`, source]),
  ).values()].sort(sourceOrder);
  const normalized: IndicatorDataset = {
    ...existing,
    updatedAt: sources.at(-1)?.sourceDate ?? existing.updatedAt,
    sources,
    data,
  };
  validateCustomsTradeDataset(normalized, id);
  return normalized;
}
