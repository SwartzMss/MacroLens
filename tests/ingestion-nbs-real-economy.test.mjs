import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateRealEconomyDataset,
  validateRealEconomyObservations,
} from '../scripts/ingest/validate/real-economy.ts';
import { IngestionContractError, MethodologyMismatchError, REAL_ECONOMY_METHODOLOGY_FINGERPRINTS } from '../scripts/ingest/types.ts';

const source = (coverage) => ({
  title: '国家统计局：官方数据',
  url: 'https://data.stats.gov.cn/easyquery.htm?m=QueryData',
  sourceDate: '2026-08-17',
  coverage,
});

const metadata = {
  country: 'CN',
  unit: '%',
  label: '测试指标',
  chartTitle: '测试指标',
  calculation: 'published',
  source: 'NBS',
  updatedAt: '2026-08-17',
  comparabilityNote: '官方公布值，口径变化需要人工复核。',
  sources: [source('2025-01–02 to 2026-07')],
};

function dataset(id, data, overrides = {}) {
  const defaults = {
    ...metadata,
    sources: [source(id === 'gdp' ? '2025-Q1 to 2025-Q2' : id === 'fixed-asset-investment' ? '2025-01–02 to 2026-01–07' : '2025-01–02 to 2026-07')],
    id,
    frequency: id === 'gdp' ? 'quarterly' : 'monthly',
    metric: id === 'fixed-asset-investment' ? 'cumulative_yoy' : 'yoy',
    methodologyFingerprint: REAL_ECONOMY_METHODOLOGY_FINGERPRINTS[id],
    data,
  };
  return { ...defaults, ...overrides };
}

test('validates all four exact real-economy dataset contracts', () => {
  assert.doesNotThrow(() => validateRealEconomyDataset(dataset('gdp', [
    { date: '2025-Q1', value: 5.4 },
    { date: '2025-Q2', value: 5.2 },
  ], { sources: [source('2025-Q1 to 2025-Q2')] }), 'gdp'));
  for (const id of ['industrial-production', 'retail-sales']) {
    assert.doesNotThrow(() => validateRealEconomyDataset(dataset(id, [
      { date: '2025-01–02', value: 5.9 },
      { date: '2025-03', value: 6.1 },
      { date: '2025-04', value: 5.8 },
    ]), id));
  }
  assert.doesNotThrow(() => validateRealEconomyDataset(dataset('fixed-asset-investment', [
    { date: '2025-01–02', value: 4.1 },
    { date: '2025-01–03', value: 4.2 },
    { date: '2025-01–04', value: 4.0 },
  ]), 'fixed-asset-investment'));
});

test('accepts the missing January and February single-month periods only for combined monthly series', () => {
  for (const id of ['industrial-production', 'retail-sales']) {
    assert.doesNotThrow(() => validateRealEconomyObservations([
      { date: '2025-01–02', value: 1 },
      { date: '2025-03', value: 2 },
    ], id));
    assert.throws(() => validateRealEconomyObservations([
      { date: '2025-03', value: 2 },
    ], id), IngestionContractError);
  }
});

test('requires cumulative year-to-date progression for fixed-asset investment', () => {
  assert.throws(() => validateRealEconomyObservations([
    { date: '2025-01–02', value: 1 },
    { date: '2025-02', value: 2 },
  ], 'fixed-asset-investment'), IngestionContractError);
  assert.doesNotThrow(() => validateRealEconomyObservations([
    { date: '2025-01–02', value: 1 },
    { date: '2025-01–03', value: 2 },
    { date: '2025-01–04', value: 3 },
  ], 'fixed-asset-investment'));
});

test('validates quarters without applying monthly continuity rules', () => {
  assert.doesNotThrow(() => validateRealEconomyObservations([
    { date: '2025-Q4', value: 1 },
    { date: '2026-Q1', value: 2 },
  ], 'gdp'));
  assert.throws(() => validateRealEconomyObservations([
    { date: '2025-Q1', value: 1 },
    { date: '2025-Q3', value: 2 },
  ], 'gdp'), IngestionContractError);
});

test('rejects exact field and source contract mismatches', () => {
  for (const [field, value] of [
    ['id', 'other'],
    ['country', 'US'],
    ['frequency', 'quarterly'],
    ['unit', 'index'],
    ['metric', 'index'],
    ['source', 'PBOC'],
    ['calculation', 'computed'],
  ]) {
    assert.throws(
      () => validateRealEconomyDataset(dataset('industrial-production', [
        { date: '2025-01–02', value: 1 },
        { date: '2025-03', value: 2 },
      ], { [field]: value }), 'industrial-production'),
      IngestionContractError,
      field,
    );
  }
  assert.throws(
    () => validateRealEconomyDataset(dataset('industrial-production', [
      { date: '2025-01–02', value: 1 },
      { date: '2025-03', value: 2 },
    ], { methodologyFingerprint: 'changed' }), 'industrial-production'),
    MethodologyMismatchError,
  );
  assert.throws(
    () => validateRealEconomyDataset(dataset('industrial-production', [
      { date: '2025-01–02', value: 1 },
      { date: '2025-03', value: 2 },
    ], { sources: [source('2025-01 to 2025-03')] }), 'industrial-production'),
    IngestionContractError,
  );
});
