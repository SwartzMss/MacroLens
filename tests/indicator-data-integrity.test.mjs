import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { getIndicatorData } from '../src/data/indicatorRegistry.ts';
import { CUSTOMS_TRADE_ALLOWED_GAPS } from '../scripts/ingest/validate/customs-trade.ts';
import { validateRealEconomyObservations } from '../scripts/ingest/validate/real-economy.ts';
import { coversPeriod, isDataSource } from './helpers/coverage.mjs';

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
  'unemployment-rate': { frequency: 'monthly', unit: '%', metric: 'rate', calculation: 'published' },
  cpi: { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  'core-cpi': { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  ppi: { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  credit: { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  'social-financing': { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  lpr: { frequency: 'monthly', unit: '%', metric: 'rate', calculation: 'published' },
  'policy-rate': { frequency: 'event', chartType: 'step', unit: '%', metric: 'rate', calculation: 'published' },
  exports: { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  imports: { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
};

function readDataset(id) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, `${id}.json`), 'utf8'));
}

function dateKey(value, frequency) {
  if (frequency === 'event') {
    assert.ok(isIsoDate(value), `invalid event date: ${value}`);
    return Date.parse(value);
  }
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
    || hostname.endsWith('.pbc.gov.cn')
    || hostname === 'chinamoney.com.cn'
    || hostname.endsWith('.chinamoney.com.cn')
    || hostname === 'shibor.org'
    || hostname.endsWith('.shibor.org')
    || hostname === 'customs.gov.cn'
    || hostname.endsWith('.customs.gov.cn'));
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

function assertContinuous(data, next, id, allowedGaps = new Set()) {
  for (let index = 1; index < data.length; index += 1) {
    const previous = data[index - 1].date;
    const current = data[index].date;
    if (allowedGaps.has(`${previous} -> ${current}`)) continue;
    assert.equal(next(previous), current, `${id} gap before ${current}`);
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
  const exactMonthlyIds = ['m0', 'm1', 'm2', 'pmi', 'cpi', 'core-cpi', 'ppi', 'credit', 'social-financing', 'lpr', 'unemployment-rate', 'exports', 'imports'];
  for (const id of Object.keys(contracts)) {
    const dataset = getIndicatorData(id);
    assert.equal(dataset.id, id, `${id} must resolve through indicatorRegistry`);
  }
  for (const id of exactMonthlyIds) {
    const allowedGaps = ['exports', 'imports'].includes(id) ? CUSTOMS_TRADE_ALLOWED_GAPS : undefined;
    assertContinuous(getIndicatorData(id).data, nextMonth, id, allowedGaps);
  }
  assertContinuous(getIndicatorData('gdp').data, nextQuarter, 'gdp');
  for (const id of ['industrial-production', 'retail-sales', 'fixed-asset-investment', 'unemployment-rate']) {
    validateRealEconomyObservations(getIndicatorData(id).data, id);
  }
});

test('Customs continuity allows only the documented January 2026 gap', () => {
  assert.deepEqual([...CUSTOMS_TRADE_ALLOWED_GAPS], ['2025-12 -> 2026-02']);
  assert.doesNotThrow(() => assertContinuous(
    [{ date: '2025-12' }, { date: '2026-02' }],
    nextMonth,
    'exports',
    CUSTOMS_TRADE_ALLOWED_GAPS,
  ));
  assert.throws(
    () => assertContinuous(
      [{ date: '2025-12' }, { date: '2026-03' }],
      nextMonth,
      'exports',
      CUSTOMS_TRADE_ALLOWED_GAPS,
    ),
    /exports gap before 2026-03/,
  );
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
