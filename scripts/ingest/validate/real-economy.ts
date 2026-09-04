import { IngestionContractError, MethodologyMismatchError } from '../types.ts';
import {
  REAL_ECONOMY_CONTRACTS,
  REAL_ECONOMY_METHODOLOGY_FINGERPRINTS,
} from '../types.ts';
import type { IndicatorDataset, IndicatorSource, Observation, RealEconomyDatasetId } from '../types.ts';
import { validateIndicatorDataset } from './dataset.ts';

const REAL_COVERAGE_PATTERN = /^.+$/;

function fail(message: string): never {
  throw new IngestionContractError(message);
}

function periodRank(date: string, id: RealEconomyDatasetId): number {
  const quarter = date.match(/^(\d{4})-Q([1-4])$/);
  if (quarter) return Number(quarter[1]) * 4 + Number(quarter[2]);
  const combined = date.match(/^(\d{4})-01–02$/);
  if (combined) return Number(combined[1]) * 12 + 1;
  const cumulative = date.match(/^(\d{4})-01–(0[3-9]|1[0-2])$/);
  if (cumulative) return Number(cumulative[1]) * 12 + Number(cumulative[2]);
  const month = date.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (month) return Number(month[1]) * 12 + Number(month[2]);
  fail(`Invalid ${id} period: ${date}`);
}

function validPeriod(date: string, id: RealEconomyDatasetId): boolean {
  if (id === 'gdp') return /^\d{4}-Q[1-4]$/.test(date);
  if (id === 'fixed-asset-investment') return /^\d{4}-01–(?:02|0[3-9]|1[0-2])$/.test(date);
  return /^\d{4}-(?:01–02|0[3-9]|1[0-2])$/.test(date);
}

function nextPeriod(date: string, id: RealEconomyDatasetId): string {
  if (id === 'gdp') {
    const match = date.match(/^(\d{4})-Q([1-4])$/)!;
    const quarter = Number(match[2]);
    return quarter === 4 ? `${Number(match[1]) + 1}-Q1` : `${match[1]}-Q${quarter + 1}`;
  }
  const year = Number(date.slice(0, 4));
  const month = id === 'fixed-asset-investment'
    ? Number(date.slice(-2))
    : date.includes('01–02') ? 2 : Number(date.slice(-2));
  if (month === 12) return `${year + 1}-01–02`;
  if (month === 2) return id === 'fixed-asset-investment' ? `${year}-01–03` : `${year}-03`;
  return id === 'fixed-asset-investment' ? `${year}-01–${String(month + 1).padStart(2, '0')}` : `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function validateRealEconomyObservations(
  observations: Observation[],
  id: RealEconomyDatasetId,
  options: { requireYearStart?: boolean } = {},
): void {
  if (!Array.isArray(observations) || observations.length === 0) fail(`${id} dataset requires observations`);
  if (options.requireYearStart !== false && id !== 'gdp' && observations[0]?.date.match(/^\d{4}-01–02$/) === null) {
    fail(`${id} observations must start with the official Jan-Feb combined period`);
  }
  let previous = '';
  for (const observation of observations) {
    if (!validPeriod(observation.date, id)) fail(`Invalid ${id} observation period: ${observation.date}`);
    if (previous && nextPeriod(previous, id) !== observation.date) {
      fail(`${id} observations are not contiguous: ${previous} -> ${observation.date}`);
    }
    if (!Number.isFinite(observation.value)) fail(`Invalid ${id} observation value: ${observation.date}`);
    previous = observation.date;
  }
}

type CoverageRange = { start: string; end: string; annual: boolean };

function coverageRanges(source: IndicatorSource, id: RealEconomyDatasetId): CoverageRange[] {
  const ranges = source.coverage.split(';').map((part): CoverageRange => {
    const annualRange = part.trim().match(/^(.+?)\s+to\s+(.+?)\s+\(annual\)$/);
    if (annualRange) return { start: annualRange[1], end: annualRange[2], annual: true };
    const range = part.trim().match(/^(.+?)\s+to\s+(.+)$/);
    return range
      ? { start: range[1], end: range[2], annual: false }
      : { start: part.trim(), end: part.trim(), annual: false };
  });
  if (ranges.some(({ start, end, annual }) => (
    !validPeriod(start, id)
    || !validPeriod(end, id)
    || periodRank(start, id) > periodRank(end, id)
    || (annual && start.slice(5) !== end.slice(5))
  ))) {
    return [];
  }
  return ranges;
}

export function realEconomyCoverageCoversDates(
  sources: IndicatorSource[],
  dates: string[],
  id: RealEconomyDatasetId,
): boolean {
  return dates.every((date) => sources.some((source) => {
    return coverageRanges(source, id).some(({ start, end, annual }) => {
      if (annual) {
        const startYear = Number(start.slice(0, 4));
        const endYear = Number(end.slice(0, 4));
        const dateYear = Number(date.slice(0, 4));
        return date.slice(5) === start.slice(5) && startYear <= dateYear && dateYear <= endYear;
      }
      return periodRank(start, id) <= periodRank(date, id) && periodRank(date, id) <= periodRank(end, id);
    });
  }));
}

export function validateRealEconomyDataset(dataset: IndicatorDataset, id: RealEconomyDatasetId): void {
  const contract = REAL_ECONOMY_CONTRACTS[id];
  validateIndicatorDataset(dataset, {
    coveragePattern: REAL_COVERAGE_PATTERN,
    validateObservations: (observations) => validateRealEconomyObservations(observations, id),
    coverageCoversDates: (sources, dates) => realEconomyCoverageCoversDates(sources, dates, id),
  });
  if (dataset.sources.some((source) => coverageRanges(source, id).length === 0)) {
    fail(`Invalid ${id} source coverage`);
  }
  if (dataset.id !== id) fail(`Real-economy dataset id mismatch: ${dataset.id} != ${id}`);
  if (dataset.country !== 'CN') fail(`Real-economy country must be CN, got ${dataset.country}`);
  if (dataset.frequency !== contract.frequency) fail(`${id} frequency must be ${contract.frequency}, got ${dataset.frequency}`);
  if (dataset.unit !== contract.unit) fail(`${id} unit must be ${contract.unit}, got ${dataset.unit}`);
  if (dataset.metric !== contract.metric) fail(`${id} metric must be ${contract.metric}, got ${dataset.metric}`);
  if (dataset.source !== 'NBS') fail(`${id} source must be NBS, got ${dataset.source}`);
  if (dataset.calculation !== contract.calculation) fail(`${id} calculation must be published, got ${dataset.calculation}`);
  if (dataset.methodologyFingerprint !== REAL_ECONOMY_METHODOLOGY_FINGERPRINTS[id]) {
    throw new MethodologyMismatchError(`${id} methodology fingerprint differs from the expected contract`);
  }
  for (const source of dataset.sources) {
    if (!/^https:\/\/(?:data\.|www\.)?stats\.gov\.cn\//.test(source.url)) {
      fail(`Invalid official NBS source for ${id}: ${source.url}`);
    }
  }
}
