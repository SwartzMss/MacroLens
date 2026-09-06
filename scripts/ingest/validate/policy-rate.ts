import type { IndicatorDataset, Observation } from '../types.ts';
import { IngestionContractError } from '../types.ts';
import { validateIndicatorDataset } from './dataset.ts';
import { validateDay, validatePublication } from '../fetch/policy-rate.ts';

export const POLICY_RATE_METHODOLOGY = 'pboc-7d-reverse-repo|published-rate|effective-operation-date|step-changes|fixed-rate-from-2024-07-22';
export const DAY_COVERAGE = /^(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})$/;

export function validateEventObservations(observations: Observation[]): void {
  if (!observations.length) throw new IngestionContractError('Event dataset requires observations');
  for (let index = 0; index < observations.length; index++) {
    const point = observations[index];
    validateDay(point.date);
    if (!Number.isFinite(point.value)) throw new IngestionContractError('Invalid event value');
    if (index && point.date <= observations[index - 1].date) throw new IngestionContractError('Event dates must be chronologically sorted and unique');
  }
}

export function validatePolicyRateDataset(dataset: IndicatorDataset): void {
  validateIndicatorDataset(dataset, {
    coveragePattern: DAY_COVERAGE,
    validateObservations: validateEventObservations,
    coverageCoversDates: (sources, dates) => dates.every(date => sources.some(source => source.coverage === `${date} to ${date}`)),
  });
  if (dataset.id !== 'policy-rate' || dataset.country !== 'CN' || dataset.frequency !== 'event'
    || dataset.chartType !== 'step' || dataset.unit !== '%' || dataset.metric !== 'rate'
    || dataset.source !== 'PBOC' || dataset.calculation !== 'published' || dataset.series
    || dataset.methodologyFingerprint !== POLICY_RATE_METHODOLOGY || dataset.methodologyEffectiveFrom !== '2024-07-22') {
    throw new IngestionContractError('Policy-rate dataset metadata/methodology mismatch');
  }
  validateDay(dataset.verifiedThrough ?? '');
  if (dataset.verifiedThrough! < dataset.data.at(-1)!.date) throw new IngestionContractError('Verification precedes latest event');
  const dates = new Set(dataset.data.map(point => point.date));
  dates.add(dataset.verifiedThrough!);
  const seen = new Set<string>();
  let previousSourceDate = '';
  for (const source of dataset.sources) {
    validatePublication(source);
    const match = source.coverage.match(DAY_COVERAGE)!;
    validateDay(match[1]);
    if (match[1] !== match[2] || !dates.has(match[1]) || seen.has(match[1]) || (source.role && source.role !== 'data')
      || (source.title.includes('交易') && source.sourceDate !== match[1])
      || source.sourceDate > match[1] || source.sourceDate < previousSourceDate) throw new IngestionContractError('Invalid or duplicate policy-rate provenance');
    previousSourceDate = source.sourceDate;
    seen.add(match[1]);
  }
  if (seen.size !== dates.size) throw new IngestionContractError('Missing policy-rate event/verification source');
  for (let index = 0; index < dataset.data.length; index++) {
    const point = dataset.data[index];
    if (point.value <= 0 || point.value >= 20) throw new IngestionContractError('Invalid policy-rate level');
    if (index && point.value === dataset.data[index - 1].value) throw new IngestionContractError('Unchanged rates must not create synthetic events');
  }
}
