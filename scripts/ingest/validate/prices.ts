import { IngestionContractError, MethodologyMismatchError, PRICE_CONTRACTS, PRICE_METHODOLOGY_FINGERPRINTS } from '../types.ts';
import type { IndicatorDataset, Observation, PriceDatasetId } from '../types.ts';
import { coverageCoversDates, validateIndicatorDataset, validateMonthlyObservations } from './dataset.ts';

const PRICE_COVERAGE_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])\s+to\s+\d{4}-(?:0[1-9]|1[0-2])$/;
const PRICE_IDS: PriceDatasetId[] = ['cpi', 'core-cpi', 'ppi'];

function fail(message: string): never {
  throw new IngestionContractError(message);
}

function officialNbsUrl(url: string): boolean {
  return /^https:\/\/(?:data\.|www\.)?stats\.gov\.cn\//.test(url);
}

export function validatePriceObservations(observations: Observation[], id: PriceDatasetId): void {
  validateMonthlyObservations(observations, id);
}

export function priceCoverageCoversDates(
  sources: IndicatorDataset['sources'],
  dates: string[],
): boolean {
  return coverageCoversDates(sources, dates);
}

export function validatePriceDataset(dataset: IndicatorDataset, id: PriceDatasetId): void {
  if (!PRICE_IDS.includes(id)) fail(`Unknown price dataset: ${id}`);
  const contract = PRICE_CONTRACTS[id];
  validateIndicatorDataset(dataset, {
    coveragePattern: PRICE_COVERAGE_PATTERN,
    validateObservations: (observations) => validatePriceObservations(observations, id),
    coverageCoversDates: priceCoverageCoversDates,
  });
  if (dataset.id !== id) fail(`Price dataset id mismatch: ${dataset.id} != ${id}`);
  if (dataset.country !== 'CN') fail(`${id} country must be CN, got ${dataset.country}`);
  if (dataset.frequency !== contract.frequency) fail(`${id} frequency must be ${contract.frequency}, got ${dataset.frequency}`);
  if (dataset.unit !== contract.unit) fail(`${id} unit must be ${contract.unit}, got ${dataset.unit}`);
  if (dataset.metric !== contract.metric) fail(`${id} metric must be ${contract.metric}, got ${dataset.metric}`);
  if (dataset.source !== 'NBS') fail(`${id} source must be NBS, got ${dataset.source}`);
  if (dataset.calculation !== contract.calculation) fail(`${id} calculation must be published, got ${dataset.calculation}`);
  if (dataset.methodologyFingerprint !== PRICE_METHODOLOGY_FINGERPRINTS[id]) {
    throw new MethodologyMismatchError(`${id} methodology fingerprint differs from the expected contract`);
  }
  if (dataset.methodologyEffectiveFrom !== undefined && !/^\d{4}-\d{2}$/.test(dataset.methodologyEffectiveFrom)) {
    fail(`${id} methodologyEffectiveFrom must be YYYY-MM`);
  }
  if (dataset.sources.some((source) => !officialNbsUrl(source.url))) {
    fail(`Invalid official NBS source for ${id}`);
  }
}
