import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { getIndicatorData } from '../src/data/indicatorRegistry.ts';
import { validateRealEconomyObservations } from '../scripts/ingest/validate/real-economy.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', 'data', 'indicators');

const contracts = {
  m0: { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  m1: { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  m2: { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  pmi: { frequency: 'monthly', unit: 'index', metric: 'index', calculation: 'published' },
  gdp: { frequency: 'quarterly', unit: '%', metric: 'yoy', calculation: 'published' },
  'industrial-production': { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  'retail-sales': { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  'fixed-asset-investment': { frequency: 'monthly', unit: '%', metric: 'cumulative_yoy', calculation: 'published' },
  cpi: { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  'core-cpi': { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  ppi: { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
};

function readDataset(id) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, `${id}.json`), 'utf8'));
}

function dateKey(value, frequency) {
  if (frequency === 'quarterly') {
    const match = value.match(/^(\d{4})-Q([1-4])$/);
    assert.ok(match, `invalid quarterly period: ${value}`);
    return Number(match[1]) * 10 + Number(match[2]);
  }

  const month = value.match(/^(\d{4})-(\d{2})$/);
  if (month) return Number(month[1]) * 100 + Number(month[2]);

  const combined = value.match(/^(\d{4})-(\d{2})–(\d{2})$/);
  assert.ok(combined, `invalid monthly period: ${value}`);
  assert.ok(Number(combined[3]) >= Number(combined[2]), `invalid combined period: ${value}`);
  return Number(combined[1]) * 100 + Number(combined[3]);
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isOfficialHost(value) {
  const { protocol, hostname } = new URL(value);
  return protocol === 'https:' && (hostname === 'stats.gov.cn'
    || hostname.endsWith('.stats.gov.cn')
    || hostname === 'pbc.gov.cn'
    || hostname.endsWith('.pbc.gov.cn'));
}

function isDataSource(source) {
  return (source.role ?? 'data') === 'data';
}

function periodRank(period) {
  const quarter = period.match(/^(\d{4})-Q([1-4])$/);
  if (quarter) return Number(quarter[1]) * 4 + Number(quarter[2]);

  const combined = period.match(/^(\d{4})-(\d{2})–(\d{2})$/);
  if (combined) return Number(combined[1]) * 12 + Number(combined[3]);

  const month = period.match(/^(\d{4})-(\d{2})$/);
  if (month) return Number(month[1]) * 12 + Number(month[2]);

  return null;
}

function coverageSegments(coverage) {
  return coverage.split(';').map((part) => {
    const annual = part.trim().match(/^(.+?)\s+to\s+(.+?)\s+\(annual\)$/);
    if (annual) return { start: annual[1], end: annual[2], annual: true };
    const range = part.trim().match(/^(.+?)\s+to\s+(.+)$/);
    return range
      ? { start: range[1], end: range[2], annual: false }
      : { start: part.trim(), end: part.trim(), annual: false };
  });
}

function coversPeriod(coverage, period) {
  const targetRank = periodRank(period);
  if (targetRank === null) return false;

  return coverageSegments(coverage).some(({ start, end, annual }) => {
    const startRank = periodRank(start);
    const endRank = periodRank(end);
    if (startRank === null || endRank === null || startRank > endRank) return false;
    if (annual && period.slice(5) !== start.slice(5)) return false;
    return startRank <= targetRank && targetRank <= endRank;
  });
}

function nextMonth(value) {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  assert.ok(match, `expected an exact monthly period: ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}`;
}

function nextQuarter(value) {
  const match = value.match(/^(\d{4})-Q([1-4])$/);
  assert.ok(match, `expected a quarterly period: ${value}`);
  const year = Number(match[1]);
  const quarter = Number(match[2]);
  return quarter === 4 ? `${year + 1}-Q1` : `${year}-Q${quarter + 1}`;
}

function assertContinuous(data, next, id) {
  for (let index = 1; index < data.length; index += 1) {
    assert.equal(next(data[index - 1].date), data[index].date, `${id} gap before ${data[index].date}`);
  }
}

test('all V1 indicator datasets satisfy the explicit data contract', () => {
  assert.deepEqual(Object.keys(contracts).sort(), fs.readdirSync(dataDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -5))
    .sort());

  for (const [id, contract] of Object.entries(contracts)) {
    const dataset = getIndicatorData(id);
    assert.equal(dataset.id, id);
    assert.equal(dataset.country, 'CN');
    for (const [field, value] of Object.entries(contract)) assert.equal(dataset[field], value, `${id}.${field}`);
    assert.ok(isIsoDate(dataset.updatedAt), `${id}.updatedAt`);
    assert.ok(dataset.comparabilityNote.length > 0, `${id}.comparabilityNote`);
    assert.ok(dataset.methodologyFingerprint.length > 0, `${id}.methodologyFingerprint`);
    assert.ok(dataset.data.length >= 2, `${id}.data must contain history`);

    const keys = dataset.data.map(({ date }) => dateKey(date, dataset.frequency));
    assert.deepEqual([...keys].sort((a, b) => a - b), keys, `${id}.data must be ordered`);
    assert.equal(new Set(keys).size, keys.length, `${id}.data must not duplicate periods`);
    assert.ok(dataset.data.every(({ value }) => Number.isFinite(value)), `${id}.data values must be finite`);

    const sourceKeys = new Set();
    for (const source of dataset.sources) {
      assert.ok(source.title.length > 0, `${id} source title`);
      assert.ok(isOfficialHost(source.url), `${id} source host: ${source.url}`);
      assert.ok(isIsoDate(source.sourceDate), `${id} source date: ${source.url}`);
      assert.ok(source.coverage.length > 0, `${id} source coverage: ${source.url}`);
      assert.ok(!source.role || ['data', 'methodology'].includes(source.role), `${id} source role`);
      const key = `${source.role ?? 'data'}|${source.coverage}`;
      assert.ok(!sourceKeys.has(key), `${id} duplicate source coverage: ${key}`);
      sourceKeys.add(key);
    }
    for (const observation of dataset.data) {
      const covered = dataset.sources.some((source) => (
        isDataSource(source) && coversPeriod(source.coverage, observation.date)
      ));
      assert.ok(covered, `${id} ${observation.date} missing data provenance`);
    }
  }
});

test('registry resolves every V1 dataset and observations are continuous by semantics', () => {
  const exactMonthlyIds = ['m0', 'm1', 'm2', 'pmi', 'cpi', 'core-cpi', 'ppi'];
  for (const id of Object.keys(contracts)) {
    const dataset = getIndicatorData(id);
    assert.equal(dataset.id, id, `${id} must resolve through indicatorRegistry`);
  }
  for (const id of exactMonthlyIds) assertContinuous(getIndicatorData(id).data, nextMonth, id);
  assertContinuous(getIndicatorData('gdp').data, nextQuarter, 'gdp');
  for (const id of ['industrial-production', 'retail-sales', 'fixed-asset-investment']) {
    validateRealEconomyObservations(getIndicatorData(id).data, id);
  }
});

test('price datasets use the formal monthly release as data provenance', () => {
  for (const id of ['cpi', 'core-cpi', 'ppi']) {
    const dataset = readDataset(id);
    for (const observation of dataset.data) {
      const source = dataset.sources.find((candidate) => (
        isDataSource(candidate)
        && candidate.coverage === `${observation.date} to ${observation.date}`
      ));
      assert.ok(source, `${id} missing exact source for ${observation.date}`);
      assert.doesNotMatch(source.title, /解读|国民经济运行总体平稳/, `${id} ${observation.date} source title`);
    }
  }
});
