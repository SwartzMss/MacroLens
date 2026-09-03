import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateRealEconomyDataset,
  validateRealEconomyObservations,
} from '../scripts/ingest/validate/real-economy.ts';
import {
  buildNbsQueryUrl,
  discoverLatestRealEconomyPublication,
  parseNbsGdpPublication,
  parseNbsRealEconomyResponse,
} from '../scripts/ingest/fetch/nbs-real-economy.ts';
import { normalizeRealEconomyDataset } from '../scripts/ingest/normalize/real-economy.ts';
import { IngestionContractError, MethodologyMismatchError, REAL_ECONOMY_CONTRACTS, REAL_ECONOMY_METHODOLOGY_FINGERPRINTS } from '../scripts/ingest/types.ts';
import { HistoricalMismatchError } from '../scripts/ingest/types.ts';
import { runRealEconomy } from '../scripts/ingest/real-economy-cli.ts';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (id) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'nbs', 'real-economy', `${id}.json`), 'utf8'));
const gdpFixture = () => fs.readFileSync(path.join(here, 'fixtures', 'nbs', 'real-economy', 'gdp-quarterly.html'), 'utf8');

function parseFixture(id) {
  if (id === 'gdp') {
    const payload = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'nbs', 'real-economy', 'gdp-quarterly.json'), 'utf8'));
    return parseNbsGdpPublication(payload.publication, gdpFixture());
  }
  const payload = fixture(id);
  return parseNbsRealEconomyResponse(payload, payload.publication, REAL_ECONOMY_CONTRACTS[id]);
}

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
  assert.deepEqual(REAL_ECONOMY_CONTRACTS.gdp.sourceCodes, []);
  assert.equal(REAL_ECONOMY_CONTRACTS.gdp.sourceKind, 'release-page');
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
    const parsed = parseFixture(id);
    assert.equal(parsed.id, id);
    assert.equal(parsed.unit, '%');
    assert.equal(parsed.methodologyFingerprint, REAL_ECONOMY_METHODOLOGY_FINGERPRINTS[id]);
    assert.deepEqual(parsed.observations.at(-1), {
      date: id === 'gdp' ? '2026-Q2' : id === 'fixed-asset-investment' ? '2025-01–04' : '2025-04',
      value: id === 'gdp' ? 4.3 : id === 'fixed-asset-investment' ? 4.0 : id === 'industrial-production' ? 6.1 : 5.1,
    });
  }
});

test('rejects a GDP release page that only exposes the current-quarter level table', () => {
  const publication = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'nbs', 'real-economy', 'gdp-quarterly.json'), 'utf8')).publication;
  const levelOnly = gdpFixture().replace('GDP同比增长速度', 'GDP当季值').replace('增长速度按不变价计算', '绝对额按现价计算');
  assert.throws(() => parseNbsGdpPublication(publication, levelOnly), MethodologyMismatchError);
});

test('rejects National Data responses without observable methodology metadata', () => {
  const payload = fixture('industrial-production');
  assert.throws(() => parseNbsRealEconomyResponse(
    { returndata: { datanodes: payload.returndata.datanodes } },
    { ...payload.publication, coverage: '' },
    REAL_ECONOMY_CONTRACTS['industrial-production'],
  ), MethodologyMismatchError);
});

test('discovers a latest official publication and builds a stable National Data URL', () => {
  const index = '<a href="/sj/zxfbhjd/202608/t20260817_1965055.html">2026年7月份规模以上工业增加值增长4.5%</a> 2026-08-17';
  const publication = discoverLatestRealEconomyPublication(index, 'industrial-production');
  assert.equal(publication.sourceDate, '2026-08-17');
  assert.equal(publication.url, 'https://www.stats.gov.cn/sj/zxfbhjd/202608/t20260817_1965055.html');
  const first = buildNbsQueryUrl(REAL_ECONOMY_CONTRACTS['industrial-production']);
  const second = buildNbsQueryUrl(REAL_ECONOMY_CONTRACTS['industrial-production']);
  assert.equal(first, second);
  assert.doesNotMatch(first, /k1=/);
});

test('rejects missing, malformed, duplicate, and invalid NBS observations', () => {
  const payload = fixture('industrial-production');
  const contract = REAL_ECONOMY_CONTRACTS['industrial-production'];
  assert.throws(() => parseNbsRealEconomyResponse({ ...payload, returndata: { datanodes: [] } }, payload.publication, contract), IngestionContractError);
  assert.throws(() => parseNbsRealEconomyResponse({ ...payload, returndata: { ...payload.returndata, datanodes: [{ ...payload.returndata.datanodes[0], data: { hasdata: false, data: '' } }] } }, payload.publication, contract), IngestionContractError);
  assert.throws(() => parseNbsRealEconomyResponse({ ...payload, returndata: { ...payload.returndata, datanodes: [{ ...payload.returndata.datanodes[0], data: { hasdata: true, data: '待定' } }] } }, payload.publication, contract), IngestionContractError);
  assert.throws(() => parseNbsRealEconomyResponse({ ...payload, returndata: { ...payload.returndata, datanodes: [...payload.returndata.datanodes, payload.returndata.datanodes[0]] } }, payload.publication, contract), IngestionContractError);
  assert.throws(() => parseNbsRealEconomyResponse({ ...payload, publication: { ...payload.publication, sourceDate: '2026-02-31' } }, { ...payload.publication, sourceDate: '2026-02-31' }, contract), IngestionContractError);
});

test('rejects cumulative code rows outside Jan-Feb instead of mixing them with monthly YoY rows', () => {
  const payload = fixture('industrial-production');
  const cumulativeMarch = {
    ...payload.returndata.datanodes[0],
    wds: payload.returndata.datanodes[0].wds.map((wd) => wd.wdcode === 'sj' ? { ...wd, valuecode: '202503', value: '2025年1—3月' } : wd),
  };
  assert.throws(() => parseNbsRealEconomyResponse({ ...payload, returndata: { ...payload.returndata, datanodes: [cumulativeMarch] } }, payload.publication, REAL_ECONOMY_CONTRACTS['industrial-production']), IngestionContractError);
});

test('rejects NBS source, code, and observable methodology mismatches', () => {
  const payload = fixture('industrial-production');
  const contract = REAL_ECONOMY_CONTRACTS['industrial-production'];
  assert.throws(() => parseNbsRealEconomyResponse(payload, { ...payload.publication, url: 'https://example.com/nbs.json' }, contract), IngestionContractError);
  const wrongCode = { ...payload, returndata: { ...payload.returndata, datanodes: payload.returndata.datanodes.map((node) => ({ ...node, wds: node.wds.map((wd) => wd.wdcode === 'zb' ? { ...wd, valuecode: 'A040102' } : wd) })) } };
  assert.throws(() => parseNbsRealEconomyResponse(wrongCode, payload.publication, contract), IngestionContractError);
  const changedMethod = {
    ...payload,
    returndata: {
      ...payload.returndata,
      wdnodes: payload.returndata.wdnodes.map((dimension) => ({
        ...dimension,
        nodes: dimension.nodes?.map((node) => ({ ...node, name: node.name?.replaceAll('扣除价格因素', '现价') })),
      })),
    },
  };
  assert.throws(() => parseNbsRealEconomyResponse(changedMethod, payload.publication, contract), MethodologyMismatchError);
});

test('rejects publication metadata whose declared coverage differs from returned observations', () => {
  const payload = fixture('retail-sales');
  const contract = REAL_ECONOMY_CONTRACTS['retail-sales'];
  const publication = { ...payload.publication, coverage: '2025-01–02 to 2025-03' };
  assert.throws(() => parseNbsRealEconomyResponse(payload, publication, contract), IngestionContractError);
});

function existingFor(id) {
  const parsed = parseFixture(id);
  const first = parsed.observations[0];
  return dataset(id, [first], {
    updatedAt: '2025-03-17',
    sources: [source(`${first.date} to ${first.date}`, '2025-03-17')],
  });
}

test('normalizes all four NBS datasets while preserving period semantics and truthful coverage', () => {
  for (const id of ['gdp', 'industrial-production', 'retail-sales', 'fixed-asset-investment']) {
    const raw = parseFixture(id);
    const normalized = normalizeRealEconomyDataset(raw, existingFor(id), id);
    assert.equal(normalized.id, id);
    assert.equal(normalized.updatedAt, raw.publication.sourceDate);
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
  const raw = parseFixture('gdp');
  const existing = normalizeRealEconomyDataset(raw, existingFor('gdp'), 'gdp');
  const older = { ...raw, publication: { ...raw.publication, sourceDate: '2025-03-17' } };
  assert.doesNotThrow(() => normalizeRealEconomyDataset(older, existing, 'gdp'));
});

test('rejects an incoming real-economy sequence with a gap before merging', () => {
  const payload = fixture('industrial-production');
  const raw = parseNbsRealEconomyResponse(payload, payload.publication, REAL_ECONOMY_CONTRACTS['industrial-production']);
  assert.throws(() => normalizeRealEconomyDataset({ ...raw, observations: raw.observations.filter(({ date }) => date !== '2025-03') }, existingFor('industrial-production'), 'industrial-production'), IngestionContractError);
});

function seedTargets(directory) {
  fs.mkdirSync(directory, { recursive: true });
  for (const id of ['gdp', 'industrial-production', 'retail-sales', 'fixed-asset-investment']) {
    const existing = existingFor(id);
    fs.writeFileSync(path.join(directory, `${id}.json`), `${JSON.stringify(existing, null, 2)}\n`);
  }
}

function seedFixtureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
  const names = {
    gdp: 'gdp-quarterly.json',
    'industrial-production': 'industrial-production.json',
    'retail-sales': 'retail-sales.json',
    'fixed-asset-investment': 'fixed-asset-investment.json',
  };
  for (const name of Object.values(names)) {
    const fixturePath = name === 'gdp-quarterly.json'
      ? path.join(here, 'fixtures', 'nbs', 'real-economy', name)
      : path.join(here, 'fixtures', 'nbs', 'real-economy', name);
    fs.copyFileSync(fixturePath, path.join(directory, name));
  }
  fs.copyFileSync(path.join(here, 'fixtures', 'nbs', 'real-economy', 'gdp-quarterly.html'), path.join(directory, 'gdp-quarterly.html'));
  const index = path.join(directory, 'index.json');
  fs.writeFileSync(index, `${JSON.stringify(names, null, 2)}\n`);
  return index;
}

async function captureOutput(callback) {
  const originalLog = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  try {
    await callback();
    return lines.join('\n');
  } finally {
    console.log = originalLog;
  }
}

test('runs the fixture CLI for all four targets and is idempotent', async () => {
  const targets = fs.mkdtempSync(path.join('/tmp', 'macrolens-nbs-real-economy-'));
  const fixtures = fs.mkdtempSync(path.join('/tmp', 'macrolens-nbs-real-economy-fixture-'));
  seedTargets(targets);
  const fixtureIndex = seedFixtureDirectory(fixtures);
  const args = ['--fixture-index', fixtureIndex, '--fixture-dir', fixtures, '--target-dir', targets];
  const firstOutput = await captureOutput(() => runRealEconomy(args));
  for (const id of ['gdp', 'industrial-production', 'retail-sales', 'fixed-asset-investment']) assert.match(firstOutput, new RegExp(`${id}.*Changed: true`));
  assert.equal(JSON.parse(fs.readFileSync(path.join(targets, 'gdp.json'), 'utf8')).data.at(-1).date, '2026-Q2');
  assert.equal(JSON.parse(fs.readFileSync(path.join(targets, 'industrial-production.json'), 'utf8')).data.at(-1).date, '2025-04');
  const snapshots = new Map(['gdp', 'industrial-production', 'retail-sales', 'fixed-asset-investment'].map((id) => [id, fs.readFileSync(path.join(targets, `${id}.json`), 'utf8')]));
  const secondOutput = await captureOutput(() => runRealEconomy(args));
  for (const id of ['gdp', 'industrial-production', 'retail-sales', 'fixed-asset-investment']) {
    assert.match(secondOutput, new RegExp(`${id}.*Changed: false`));
    assert.equal(fs.readFileSync(path.join(targets, `${id}.json`), 'utf8'), snapshots.get(id));
  }
});

test('does not write any target when one NBS series has a historical mismatch', async () => {
  const targets = fs.mkdtempSync(path.join('/tmp', 'macrolens-nbs-real-economy-atomic-'));
  const fixtures = fs.mkdtempSync(path.join('/tmp', 'macrolens-nbs-real-economy-atomic-fixture-'));
  seedTargets(targets);
  const fixtureIndex = seedFixtureDirectory(fixtures);
  const args = ['--fixture-index', fixtureIndex, '--fixture-dir', fixtures, '--target-dir', targets];
  await runRealEconomy(args);
  const before = new Map(['gdp', 'industrial-production', 'retail-sales', 'fixed-asset-investment'].map((id) => [id, fs.readFileSync(path.join(targets, `${id}.json`), 'utf8')]));
  const industrialPath = path.join(fixtures, 'industrial-production.json');
  const industrial = JSON.parse(fs.readFileSync(industrialPath, 'utf8'));
  industrial.returndata.datanodes[0].data.data = '9.9';
  fs.writeFileSync(industrialPath, `${JSON.stringify(industrial, null, 2)}\n`);
  await assert.rejects(() => runRealEconomy(args), HistoricalMismatchError);
  for (const id of ['gdp', 'industrial-production', 'retail-sales', 'fixed-asset-investment']) assert.equal(fs.readFileSync(path.join(targets, `${id}.json`), 'utf8'), before.get(id));
});

test('help exits before reading or writing real-economy targets', async () => {
  await assert.doesNotReject(() => runRealEconomy(['--help']));
});

test('wires NBS real-economy ingestion into the reviewable scheduled workflow', () => {
  const workflow = fs.readFileSync(path.join(here, '..', '.github', 'workflows', 'update-macro-data.yml'), 'utf8');
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /npm run ingest:pmi/);
  assert.match(workflow, /npm run ingest:pboc-money-supply/);
  assert.match(workflow, /npm run ingest:nbs-real-economy/);
  for (const id of ['gdp', 'industrial-production', 'retail-sales', 'fixed-asset-investment']) {
    assert.match(workflow, new RegExp(`data/indicators/${id}\\.json`));
  }
  assert.match(workflow, /create-pull-request/);
});
