import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateRealEconomyDataset,
  validateRealEconomyObservations,
} from '../scripts/ingest/validate/real-economy.ts';
import { parseNbsRealEconomyResponse } from '../scripts/ingest/fetch/nbs-real-economy.ts';
import { normalizeRealEconomyDataset } from '../scripts/ingest/normalize/real-economy.ts';
import { IngestionContractError, MethodologyMismatchError, REAL_ECONOMY_CONTRACTS, REAL_ECONOMY_METHODOLOGY_FINGERPRINTS } from '../scripts/ingest/types.ts';
import { HistoricalMismatchError } from '../scripts/ingest/types.ts';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (id) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'nbs', 'real-economy', `${id}.json`), 'utf8'));

const source = (coverage, sourceDate = '2026-08-17') => ({
  title: '国家统计局：官方数据',
  url: 'https://data.stats.gov.cn/easyquery.htm?m=QueryData',
  sourceDate,
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

test('parses official-shaped NBS responses for all four target series', () => {
  for (const id of ['gdp', 'industrial-production', 'retail-sales', 'fixed-asset-investment']) {
    const payload = fixture(id === 'gdp' ? 'gdp-quarterly' : id);
    const parsed = parseNbsRealEconomyResponse(payload, payload.publication, REAL_ECONOMY_CONTRACTS[id]);
    assert.equal(parsed.id, id);
    assert.equal(parsed.unit, '%');
    assert.equal(parsed.methodologyFingerprint, REAL_ECONOMY_METHODOLOGY_FINGERPRINTS[id]);
    assert.deepEqual(parsed.observations.at(-1), {
      date: id === 'gdp' ? '2026-Q2' : id === 'fixed-asset-investment' ? '2025-01–04' : '2025-04',
      value: id === 'gdp' ? 4.3 : id === 'fixed-asset-investment' ? 4.0 : id === 'industrial-production' ? 6.1 : 5.1,
    });
  }
});

test('rejects missing, malformed, duplicate, and invalid NBS observations', () => {
  const payload = fixture('industrial-production');
  const contract = REAL_ECONOMY_CONTRACTS['industrial-production'];
  assert.throws(() => parseNbsRealEconomyResponse({ ...payload, returndata: { datanodes: [] } }, payload.publication, contract), IngestionContractError);
  assert.throws(() => parseNbsRealEconomyResponse({ ...payload, returndata: { datanodes: [{ ...payload.returndata.datanodes[0], data: { hasdata: false, data: '' } }] } }, payload.publication, contract), IngestionContractError);
  assert.throws(() => parseNbsRealEconomyResponse({ ...payload, returndata: { datanodes: [{ ...payload.returndata.datanodes[0], data: { hasdata: true, data: '待定' } }] } }, payload.publication, contract), IngestionContractError);
  assert.throws(() => parseNbsRealEconomyResponse({ ...payload, returndata: { datanodes: [...payload.returndata.datanodes, payload.returndata.datanodes[0]] } }, payload.publication, contract), IngestionContractError);
  assert.throws(() => parseNbsRealEconomyResponse({ ...payload, publication: { ...payload.publication, sourceDate: '2026-02-31' } }, { ...payload.publication, sourceDate: '2026-02-31' }, contract), IngestionContractError);
});

test('rejects NBS source, code, and observable methodology mismatches', () => {
  const payload = fixture('industrial-production');
  const contract = REAL_ECONOMY_CONTRACTS['industrial-production'];
  assert.throws(() => parseNbsRealEconomyResponse(payload, { ...payload.publication, url: 'https://example.com/nbs.json' }, contract), IngestionContractError);
  const wrongCode = { ...payload, returndata: { datanodes: payload.returndata.datanodes.map((node) => ({ ...node, wds: node.wds.map((wd) => wd.wdcode === 'zb' ? { ...wd, valuecode: 'A040102' } : wd) })) } };
  assert.throws(() => parseNbsRealEconomyResponse(wrongCode, payload.publication, contract), IngestionContractError);
  assert.throws(() => parseNbsRealEconomyResponse({ ...payload, series: { ...payload.series, priceTreatment: '按现价计算' } }, payload.publication, contract), MethodologyMismatchError);
});

function existingFor(id) {
  const payload = fixture(id === 'gdp' ? 'gdp-quarterly' : id);
  const parsed = parseNbsRealEconomyResponse(payload, payload.publication, REAL_ECONOMY_CONTRACTS[id]);
  const first = parsed.observations[0];
  return dataset(id, [first], {
    updatedAt: '2025-03-17',
    sources: [source(`${first.date} to ${first.date}`, '2025-03-17')],
  });
}

test('normalizes all four NBS datasets while preserving period semantics and truthful coverage', () => {
  for (const id of ['gdp', 'industrial-production', 'retail-sales', 'fixed-asset-investment']) {
    const payload = fixture(id === 'gdp' ? 'gdp-quarterly' : id);
    const raw = parseNbsRealEconomyResponse(payload, payload.publication, REAL_ECONOMY_CONTRACTS[id]);
    const normalized = normalizeRealEconomyDataset(raw, existingFor(id), id);
    assert.equal(normalized.id, id);
    assert.equal(normalized.updatedAt, payload.publication.sourceDate);
    assert.equal(normalized.sources.at(-1).coverage, `${raw.observations[0].date} to ${raw.observations.at(-1).date}`);
    assert.deepEqual(normalized.data.at(-1), raw.observations.at(-1));
  }
});

test('fails loudly when an NBS observation disagrees with historical data', () => {
  const payload = fixture('retail-sales');
  const raw = parseNbsRealEconomyResponse(payload, payload.publication, REAL_ECONOMY_CONTRACTS['retail-sales']);
  const existing = existingFor('retail-sales');
  assert.throws(() => normalizeRealEconomyDataset(raw, {
    ...existing,
    data: [{ ...existing.data[0], value: existing.data[0].value + 0.1 }],
  }, 'retail-sales'), HistoricalMismatchError);
});

test('allows an older publication when it only verifies existing periods', () => {
  const payload = fixture('gdp-quarterly');
  const raw = parseNbsRealEconomyResponse(payload, payload.publication, REAL_ECONOMY_CONTRACTS.gdp);
  const existing = normalizeRealEconomyDataset(raw, existingFor('gdp'), 'gdp');
  const older = { ...raw, publication: { ...raw.publication, sourceDate: '2025-03-17' } };
  assert.doesNotThrow(() => normalizeRealEconomyDataset(older, existing, 'gdp'));
});

test('rejects an incoming real-economy sequence with a gap before merging', () => {
  const payload = fixture('industrial-production');
  const raw = parseNbsRealEconomyResponse(payload, payload.publication, REAL_ECONOMY_CONTRACTS['industrial-production']);
  assert.throws(() => normalizeRealEconomyDataset({ ...raw, observations: raw.observations.filter(({ date }) => date !== '2025-03') }, existingFor('industrial-production'), 'industrial-production'), IngestionContractError);
});
