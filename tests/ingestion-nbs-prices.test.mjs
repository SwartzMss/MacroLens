import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IngestionContractError,
  MethodologyMismatchError,
  PRICE_CONTRACTS,
  PRICE_METHODOLOGY_FINGERPRINTS,
} from '../scripts/ingest/types.ts';
import {
  validatePriceDataset,
  validatePriceObservations,
} from '../scripts/ingest/validate/prices.ts';

const source = (coverage = '2026-01 to 2026-03') => ({
  title: '国家统计局：官方价格数据',
  url: 'https://data.stats.gov.cn/dg/website/page.html?cid=official',
  sourceDate: '2026-08-09',
  coverage,
});

function dataset(id, data, overrides = {}) {
  const contract = PRICE_CONTRACTS[id];
  return {
    id,
    country: 'CN',
    frequency: 'monthly',
    unit: '%',
    metric: 'yoy',
    label: id,
    chartTitle: id,
    source: 'NBS',
    calculation: 'published',
    updatedAt: '2026-08-09',
    comparabilityNote: '官方公布的月度同比价格指标。',
    methodologyFingerprint: PRICE_METHODOLOGY_FINGERPRINTS[id],
    sources: [source()],
    data,
    ...overrides,
  };
}

test('price contracts are monthly published YoY percentages', () => {
  assert.deepEqual(Object.keys(PRICE_CONTRACTS), ['cpi', 'core-cpi', 'ppi']);
  for (const id of Object.keys(PRICE_CONTRACTS)) {
    assert.equal(PRICE_CONTRACTS[id].frequency, 'monthly');
    assert.equal(PRICE_CONTRACTS[id].unit, '%');
    assert.equal(PRICE_CONTRACTS[id].metric, 'yoy');
    assert.equal(PRICE_CONTRACTS[id].calculation, 'published');
  }
  assert.match(PRICE_CONTRACTS['core-cpi'].sourceTitle, /食品.*能源/);
});

test('price observations require every calendar month', () => {
  assert.doesNotThrow(() => validatePriceObservations([
    { date: '2026-01', value: 0.2 },
    { date: '2026-02', value: 0.3 },
    { date: '2026-03', value: 0.1 },
  ], 'cpi'));
  assert.throws(() => validatePriceObservations([
    { date: '2026-01', value: 0.2 },
    { date: '2026-03', value: 0.1 },
  ], 'cpi'), IngestionContractError);
  assert.throws(() => validatePriceObservations([
    { date: '2026-01', value: 0.2 },
    { date: '2026-01', value: 0.3 },
  ], 'cpi'), IngestionContractError);
});

test('price dataset validation enforces exact fields and methodology', () => {
  const data = [
    { date: '2026-01', value: 0.2 },
    { date: '2026-02', value: 0.3 },
    { date: '2026-03', value: 0.1 },
  ];
  assert.doesNotThrow(() => validatePriceDataset(dataset('cpi', data), 'cpi'));
  assert.throws(
    () => validatePriceDataset(dataset('cpi', data, { metric: 'index' }), 'cpi'),
    IngestionContractError,
  );
  assert.throws(
    () => validatePriceDataset(dataset('cpi', data, { methodologyFingerprint: 'changed' }), 'cpi'),
    MethodologyMismatchError,
  );
  assert.throws(
    () => validatePriceDataset(dataset('cpi', data, { sources: [{ ...source(), coverage: '' }] }), 'cpi'),
    IngestionContractError,
  );
});
