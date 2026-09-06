import {
  CUSTOMS_TRADE_CONTRACTS,
  CUSTOMS_TRADE_METHODOLOGY_FINGERPRINT,
  IngestionContractError,
  MethodologyMismatchError,
} from '../types.ts';
import type { IndicatorDataset, IndicatorSource, Observation, CustomsTradeDatasetId } from '../types.ts';
import { coverageCoversDates, validateIndicatorDataset, validateMonthlyObservations } from './dataset.ts';

const COVERAGE_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])\s+to\s+\d{4}-(?:0[1-9]|1[0-2])$/;
const IDS: CustomsTradeDatasetId[] = ['exports', 'imports'];
// GACC published Jan-Feb 2026 as a cumulative release without a defensible
// standalone January observation. Keep that one documented gap explicit while
// requiring continuity everywhere else in the backfilled history.
export const CUSTOMS_TRADE_ALLOWED_GAPS: ReadonlySet<string> = new Set(['2025-12 -> 2026-02']);

function fail(message: string): never {
  throw new IngestionContractError(message);
}

function officialCustomsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && (url.hostname === 'customs.gov.cn' || url.hostname.endsWith('.customs.gov.cn'));
  } catch {
    return false;
  }
}

export function validateCustomsTradeObservations(observations: Observation[], id: CustomsTradeDatasetId): void {
  validateMonthlyObservations(observations, `Customs ${id}`, CUSTOMS_TRADE_ALLOWED_GAPS);
}

export function customsTradeCoverageCoversDates(
  sources: IndicatorSource[],
  dates: string[],
): boolean {
  const dataSources = sources.filter((source) => (source.role ?? 'data') === 'data');
  return dataSources.length > 0 && coverageCoversDates(dataSources, dates);
}

export function validateCustomsTradeDataset(dataset: IndicatorDataset, id: CustomsTradeDatasetId): void {
  if (!IDS.includes(id)) fail(`Unknown Customs trade dataset: ${id}`);
  const contract = CUSTOMS_TRADE_CONTRACTS[id];
  validateIndicatorDataset(dataset, {
    coveragePattern: COVERAGE_PATTERN,
    validateObservations: (observations) => validateCustomsTradeObservations(observations, id),
    coverageCoversDates: customsTradeCoverageCoversDates,
  });
  if (dataset.id !== id) fail(`Customs trade dataset id mismatch: ${dataset.id} != ${id}`);
  if (dataset.country !== 'CN') fail(`${id} country must be CN, got ${dataset.country}`);
  if (dataset.frequency !== contract.frequency) fail(`${id} frequency must be ${contract.frequency}, got ${dataset.frequency}`);
  if (dataset.unit !== contract.unit) fail(`${id} unit must be ${contract.unit}, got ${dataset.unit}`);
  if (dataset.metric !== contract.metric) fail(`${id} metric must be ${contract.metric}, got ${dataset.metric}`);
  if (dataset.source !== 'GACC') fail(`${id} source must be GACC, got ${dataset.source}`);
  if (dataset.calculation !== contract.calculation) fail(`${id} calculation must be published, got ${dataset.calculation}`);
  if (dataset.methodologyFingerprint !== CUSTOMS_TRADE_METHODOLOGY_FINGERPRINT) {
    throw new MethodologyMismatchError(`${id} methodology fingerprint differs from the expected Customs contract`);
  }
  if (dataset.sources.some((source) => !officialCustomsUrl(source.url))) {
    fail(`Invalid official GACC source for ${id}`);
  }
  if (!/货物贸易|goods trade/i.test(dataset.comparabilityNote)) {
    fail(`${id} comparability note must identify customs goods trade`);
  }
  if (!/人民币|RMB|CNY/i.test(dataset.comparabilityNote)) {
    fail(`${id} comparability note must identify the RMB valuation`);
  }
}
