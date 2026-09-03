import { IngestionContractError, MethodologyMismatchError } from '../types.ts';
import type { IndicatorDataset, IndicatorSource, RawNbsRealEconomySeries, RealEconomyDatasetId } from '../types.ts';
import { mergeObservations } from '../validate/overlap.ts';
import { realEconomyCoverageCoversDates, validateRealEconomyDataset, validateRealEconomyObservations } from '../validate/real-economy.ts';

function pruneRealEconomySources(sources: IndicatorSource[], dates: string[], id: RealEconomyDatasetId): IndicatorSource[] {
  let result = [...sources].sort((left, right) => left.sourceDate.localeCompare(right.sourceDate));
  let removed = true;
  while (removed && result.length > 1) {
    removed = false;
    for (let index = 0; index < result.length; index += 1) {
      const candidate = result.filter((_, candidateIndex) => candidateIndex !== index);
      if (realEconomyCoverageCoversDates(candidate, dates, id)) {
        result = candidate;
        removed = true;
        break;
      }
    }
  }
  return result;
}

function latestPeriod(dataset: IndicatorDataset): string {
  const latest = dataset.data.at(-1)?.date;
  if (!latest) throw new IngestionContractError('Real-economy dataset contains no observations: ' + dataset.id);
  return latest;
}

export function normalizeRealEconomyDataset(
  raw: RawNbsRealEconomySeries,
  existing: IndicatorDataset,
  id: RealEconomyDatasetId,
): IndicatorDataset {
  validateRealEconomyDataset(existing, id);
  if (raw.id !== id) throw new IngestionContractError('Fetched NBS dataset id mismatch: ' + raw.id + ' != ' + id);
  if (raw.methodologyFingerprint !== existing.methodologyFingerprint) {
    throw new MethodologyMismatchError('Fetched NBS methodology differs from existing dataset: ' + id);
  }
  validateRealEconomyObservations(raw.observations, id, { requireYearStart: false });

  const existingLatest = latestPeriod(existing);
  const incomingAddsNewPeriod = raw.observations.some(({ date }) => date > existingLatest);
  if (incomingAddsNewPeriod && raw.publication.sourceDate < existing.updatedAt) {
    throw new IngestionContractError(
      'Fetched NBS publication is older than existing updatedAt: ' + raw.publication.sourceDate + ' < ' + existing.updatedAt,
    );
  }

  const data = mergeObservations(existing.data, raw.observations, 'NBS ' + id);
  const first = raw.observations[0];
  const last = raw.observations.at(-1);
  if (!first || !last) throw new IngestionContractError('Fetched NBS publication contains no observations: ' + id);
  const latestSource: IndicatorSource = {
    title: '国家统计局：' + raw.publication.title,
    url: raw.publication.url,
    sourceDate: raw.publication.sourceDate,
    coverage: first.date + ' to ' + last.date,
  };
  const candidates = [
    ...existing.sources.filter((source) => source.url !== latestSource.url),
    latestSource,
  ];
  const sources = pruneRealEconomySources(candidates, data.map((observation) => observation.date), id);
  const source = sources.at(-1);
  if (!source) throw new IngestionContractError('NBS dataset contains no source after normalization: ' + id);
  const normalized: IndicatorDataset = {
    ...existing,
    updatedAt: source.sourceDate,
    methodologyFingerprint: existing.methodologyFingerprint,
    sources,
    data,
  };
  validateRealEconomyDataset(normalized, id);
  return normalized;
}
