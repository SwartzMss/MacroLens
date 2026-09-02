import { IngestionContractError, MethodologyMismatchError } from '../types.ts';
import type { IndicatorDataset, RawPmiPublication, Observation, IndicatorSource } from '../types.ts';
import { mergePmiObservations } from '../validate/overlap.ts';
import { coverageCoversDates } from '../validate/dataset.ts';
import { validatePmiDataset } from '../validate/pmi.ts';

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

function pruneSources(sources: IndicatorSource[], dates: string[]): IndicatorSource[] {
  let result = [...sources];
  let removed = true;
  while (removed && result.length > 1) {
    removed = false;
    for (let index = 0; index < result.length; index += 1) {
      const candidate = result.filter((_, candidateIndex) => candidateIndex !== index);
      if (coverageCoversDates(candidate, dates)) {
        result = candidate;
        removed = true;
        break;
      }
    }
  }
  return result;
}

export function normalizePmiDataset(raw: RawPmiPublication, existing: IndicatorDataset): IndicatorDataset {
  validatePmiDataset(existing);
  validateIncomingObservations(raw.observations);
  if (raw.publication.sourceDate < existing.updatedAt) {
    throw new IngestionContractError(`Fetched PMI publication is older than existing updatedAt: ${raw.publication.sourceDate} < ${existing.updatedAt}`);
  }
  if (raw.methodologyFingerprint !== existing.methodologyFingerprint) {
    throw new MethodologyMismatchError('PMI methodology fingerprint differs from the existing dataset');
  }
  const data = mergePmiObservations(existing.data, raw.observations);
  const firstIncoming = raw.observations[0];
  const lastIncoming = raw.observations.at(-1);
  if (!firstIncoming || !lastIncoming) throw new IngestionContractError('Fetched PMI publication contains no observations');
  if (!existing.sources.at(-1)) throw new IngestionContractError('Existing PMI dataset has no latest source');
  const latestSource: IndicatorSource = {
    title: `国家统计局：${raw.publication.title}`,
    url: raw.publication.url,
    sourceDate: raw.publication.sourceDate,
    coverage: `${firstIncoming.date} to ${lastIncoming.date}`,
  };
  const candidates = [
    ...existing.sources.filter((source) => source.url !== latestSource.url),
    latestSource,
  ];

  return {
    ...existing,
    updatedAt: raw.publication.sourceDate,
    methodologyFingerprint: raw.methodologyFingerprint,
    sources: pruneSources(candidates, data.map((observation) => observation.date)),
    data,
  };
}
