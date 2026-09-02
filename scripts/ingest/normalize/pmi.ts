import { IngestionContractError } from '../types.ts';
import type { IndicatorDataset, RawPmiPublication, Observation, IndicatorSource } from '../types.ts';
import { mergePmiObservations } from '../validate/overlap.ts';
import { validateIndicatorDataset } from '../validate/dataset.ts';

function validateIncomingObservations(observations: Observation[]): void {
  if (!Array.isArray(observations) || observations.length === 0) {
    throw new IngestionContractError('Fetched PMI publication contains no observations');
  }
  let previousDate = '';
  for (const observation of observations) {
    if (!/^\d{4}-\d{2}$/.test(observation.date)) throw new IngestionContractError(`Invalid fetched PMI date: ${observation.date}`);
    if (observation.date <= previousDate) throw new IngestionContractError(`Fetched PMI observations must be sorted and unique: ${observation.date}`);
    if (!Number.isFinite(observation.value) || observation.value < 0 || observation.value > 100) {
      throw new IngestionContractError(`Invalid fetched PMI value: ${observation.value}`);
    }
    previousDate = observation.date;
  }
}

function coverageStart(source: IndicatorSource, existing: IndicatorDataset): string {
  const match = source.coverage.match(/^(\d{4}-\d{2})\s+to\s+\d{4}-\d{2}$/);
  return match?.[1] ?? existing.data[0].date;
}

export function normalizePmiDataset(raw: RawPmiPublication, existing: IndicatorDataset): IndicatorDataset {
  validateIndicatorDataset(existing);
  validateIncomingObservations(raw.observations);
  const data = mergePmiObservations(existing.data, raw.observations);
  const lastObservation = data.at(-1);
  if (!lastObservation) throw new IngestionContractError('Normalized PMI dataset contains no observations');
  const previousLatest = existing.sources.at(-1);
  if (!previousLatest) throw new IngestionContractError('Existing PMI dataset has no latest source');
  const baselineSources = existing.sources.length > 1 ? existing.sources.slice(0, -1) : existing.sources;
  const latestSource: IndicatorSource = {
    title: `国家统计局：${raw.publication.title}`,
    url: raw.publication.url,
    sourceDate: raw.publication.sourceDate,
    coverage: `${coverageStart(previousLatest, existing)} to ${lastObservation.date}`,
  };

  return {
    ...existing,
    updatedAt: raw.publication.sourceDate,
    sources: [...baselineSources, latestSource],
    data,
  };
}
