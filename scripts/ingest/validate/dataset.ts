import { IngestionContractError } from '../types.ts';
import type { IndicatorDataset, IndicatorSource, Observation } from '../types.ts';

const DATE_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COVERAGE_PATTERN = /^(\d{4}-(?:0[1-9]|1[0-2]))\s+to\s+(\d{4}-(?:0[1-9]|1[0-2]))$/;

export type DatasetValidationOptions = {
  coveragePattern?: RegExp;
  validateObservations?: (observations: Observation[]) => void;
  coverageCoversDates?: (sources: IndicatorSource[], dates: string[]) => boolean;
};

function fail(message: string): never {
  throw new IngestionContractError(message);
}

export function nextMonth(date: string): string {
  const [year, month] = date.split('-').map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function validateMonthlyObservations(observations: Observation[], label: string): void {
  if (!Array.isArray(observations) || observations.length === 0) fail(`${label} dataset requires observations`);
  let previousDate = '';
  for (const observation of observations) {
    if (!DATE_PATTERN.test(observation.date)) fail(`Invalid ${label} observation date: ${observation.date}`);
    if (observation.date <= previousDate) fail(`${label} observations must be sorted and unique: ${observation.date}`);
    if (previousDate && nextMonth(previousDate) !== observation.date) {
      fail(`${label} observations must be continuous: ${previousDate} -> ${observation.date}`);
    }
    if (!Number.isFinite(observation.value)) fail(`Invalid ${label} observation value: ${observation.date}=${observation.value}`);
    previousDate = observation.date;
  }
}

export function validateIndicatorDataset(dataset: IndicatorDataset, options: DatasetValidationOptions = {}): void {
  for (const field of ['id', 'country', 'frequency', 'unit', 'metric', 'label', 'chartTitle', 'source', 'calculation', 'updatedAt', 'comparabilityNote', 'methodologyFingerprint']) {
    if (typeof dataset[field as keyof IndicatorDataset] !== 'string' || !dataset[field as keyof IndicatorDataset]) {
      fail(`Missing indicator field: ${field}`);
    }
  }
  if (!Array.isArray(dataset.sources) || dataset.sources.length === 0) fail('Indicator dataset requires source provenance');
  for (const source of dataset.sources) {
    const coverage = source.coverage.match(options.coveragePattern ?? COVERAGE_PATTERN);
    if (!source.title || !/^https:\/\//.test(source.url) || !coverage || (coverage[2] !== undefined && coverage[1] > coverage[2])) {
      fail(`Invalid indicator source: ${source.url}`);
    }
    if (!ISO_DATE_PATTERN.test(source.sourceDate)) fail(`Invalid indicator source date: ${source.sourceDate}`);
  }
  (options.validateObservations ?? ((observations) => validateMonthlyObservations(observations, 'Indicator')))(dataset.data);
  const coverageCovers = options.coverageCoversDates ?? coverageCoversDates;
  if (!coverageCovers(dataset.sources, dataset.data.map((observation) => observation.date))) {
    fail('Indicator source coverage union does not fully cover the dataset');
  }
  if (!ISO_DATE_PATTERN.test(dataset.updatedAt)) fail(`Invalid indicator updatedAt: ${dataset.updatedAt}`);
  const latestSource = dataset.sources.at(-1);
  if (latestSource?.sourceDate !== dataset.updatedAt) {
    fail(`Indicator updatedAt must match the latest source date: ${dataset.updatedAt} != ${latestSource?.sourceDate}`);
  }
}

function monthsBetween(start: string, end: string): string[] {
  const result: string[] = [];
  let current = start;
  while (current <= end) {
    result.push(current);
    current = nextMonth(current);
  }
  return result;
}

export function coverageCoversDates(sources: IndicatorSource[], dates: string[]): boolean {
  return dates.every((date) => sources.some((source) => {
    const match = source.coverage.match(COVERAGE_PATTERN);
    return match !== null && monthsBetween(match[1], match[2]).includes(date);
  }));
}

export function pruneSources(sources: IndicatorSource[], dates: string[]): IndicatorSource[] {
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
