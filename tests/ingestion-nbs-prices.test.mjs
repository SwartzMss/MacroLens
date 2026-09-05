import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  IngestionContractError,
  HistoricalMismatchError,
  MethodologyMismatchError,
  PRICE_CONTRACTS,
  PRICE_METHODOLOGY_FINGERPRINTS,
} from '../scripts/ingest/types.ts';
import {
  validatePriceDataset,
  validatePriceObservations,
} from '../scripts/ingest/validate/prices.ts';
import {
  discoverLatestPricePublication,
  parseNbsPricePublication,
} from '../scripts/ingest/fetch/nbs-prices.ts';
import { normalizePriceDataset } from '../scripts/ingest/normalize/prices.ts';
import { writeIndicatorDatasetGroup } from '../scripts/ingest/write/group.ts';
import { runPrices } from '../scripts/ingest/price-cli.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const priceFixture = (id) => JSON.parse(fs.readFileSync(
  path.join(here, 'fixtures', 'nbs', 'prices', `${id}.json`),
  'utf8',
));

const source = (coverage = '2026-01 to 2026-03', sourceDate = '2026-08-09') => ({
  title: '国家统计局：官方价格数据',
  url: 'https://data.stats.gov.cn/dg/website/page.html?cid=official',
  sourceDate,
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

test('parses the official published CPI, core CPI, and PPI YoY series', () => {
  for (const id of ['cpi', 'core-cpi', 'ppi']) {
    const fixture = priceFixture(id);
    const raw = parseNbsPricePublication(fixture.publication, fixture.html, id);
    assert.equal(raw.id, id);
    assert.equal(raw.unit, '%');
    assert.equal(raw.frequency, 'monthly');
    assert.equal(raw.metric, 'yoy');
    assert.equal(raw.observations.length, 1);
    assert.equal(raw.observations[0].date, '2026-01');
    assert.equal(raw.dataSources[0].url, fixture.publication.url);
    assert.equal(raw.dataSources[0].role, 'data');
  }
});

test('requires the official core CPI phrase rather than deriving it', () => {
  const fixture = priceFixture('core-cpi');
  assert.throws(
    () => parseNbsPricePublication(fixture.publication, fixture.html.replace('扣除食品和能源', '扣除食品'), 'core-cpi'),
    /core CPI|食品和能源|official/i,
  );
});

test('discovers the newest official monthly price publication per dataset', () => {
  const index = [
    '<a href="/sj/zxfbhjd/202602/t20260210_1962001.html">2026年1月份居民消费价格同比上涨0.2%</a> 2026-02-10',
    '<a href="/sj/zxfbhjd/202603/t20260310_1963001.html">2026年2月份居民消费价格同比上涨0.3%</a> 2026-03-10',
  ].join(' ');
  const publication = discoverLatestPricePublication(index, 'cpi');
  assert.equal(publication.sourceDate, '2026-03-10');
  assert.equal(publication.coverage, '2026-02 to 2026-02');
  assert.equal(publication.url, 'https://www.stats.gov.cn/sj/zxfbhjd/202603/t20260310_1963001.html');
});

function rawPrice(id, observations, sourceDate = '2026-08-09') {
  const contract = PRICE_CONTRACTS[id];
  return {
    publication: {
      title: '2026年3月份官方价格数据',
      url: 'https://www.stats.gov.cn/sj/zxfbhjd/202604/t20260410_1964001.html',
      sourceDate,
      coverage: '2026-03 to 2026-03',
    },
    id,
    seriesCode: contract.sourceCode,
    seriesTitle: contract.sourceTitle,
    unit: '%',
    frequency: 'monthly',
    metric: 'yoy',
    methodologyFingerprint: contract.methodologyFingerprint,
    dataSources: [{
      ...source('2026-03 to 2026-03', sourceDate),
      url: `https://www.stats.gov.cn/sj/zxfbhjd/${sourceDate.replaceAll('-', '')}.html`,
    }],
    observations,
  };
}

test('price normalization preserves exact overlap and appends new months', () => {
  const normalized = normalizePriceDataset(
    rawPrice('cpi', [
      { date: '2026-02', value: 0.3 },
      { date: '2026-03', value: 0.1 },
    ]),
    dataset('cpi', [
      { date: '2026-01', value: 0.2 },
      { date: '2026-02', value: 0.3 },
    ], { sources: [source('2026-01 to 2026-02', '2026-08-01')], updatedAt: '2026-08-01' }),
    'cpi',
  );
  assert.deepEqual(normalized.data.map(({ date }) => date), ['2026-01', '2026-02', '2026-03']);
  assert.equal(normalized.updatedAt, '2026-08-09');
});

test('price normalization rejects a changed historical value', () => {
  assert.throws(
    () => normalizePriceDataset(
      rawPrice('cpi', [{ date: '2026-02', value: 9 }]),
      dataset('cpi', [{ date: '2026-02', value: 0.3 }]),
      'cpi',
    ),
    HistoricalMismatchError,
  );
});

test('price group writer is idempotent when every output is unchanged', async () => {
  const targetDir = fs.mkdtempSync('/tmp/macrolens-price-group-');
  try {
    const outputs = new Map([
      [path.join(targetDir, 'cpi.json'), '{"id":"cpi"}\n'],
      [path.join(targetDir, 'core-cpi.json'), '{"id":"core-cpi"}\n'],
      [path.join(targetDir, 'ppi.json'), '{"id":"ppi"}\n'],
    ]);
    assert.equal((await writeIndicatorDatasetGroup(outputs)).changed, true);
    const first = [...outputs.keys()].map((file) => fs.readFileSync(file, 'utf8'));
    assert.equal((await writeIndicatorDatasetGroup(outputs)).changed, false);
    assert.deepEqual([...outputs.keys()].map((file) => fs.readFileSync(file, 'utf8')), first);
  } finally {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
});

test('price CLI validates all candidates before changing any target', async () => {
  const targetDir = fs.mkdtempSync('/tmp/macrolens-price-cli-target-');
  const fixtureDir = fs.mkdtempSync('/tmp/macrolens-price-cli-fixtures-');
  try {
    const fixtureIndex = path.join(fixtureDir, 'index.json');
    fs.writeFileSync(fixtureIndex, JSON.stringify({ cpi: 'cpi.json', 'core-cpi': 'core-cpi.json', ppi: 'ppi.json' }));
    for (const id of ['cpi', 'core-cpi', 'ppi']) {
      fs.copyFileSync(path.join(here, 'fixtures', 'nbs', 'prices', `${id}.json`), path.join(fixtureDir, `${id}.json`));
      fs.writeFileSync(path.join(targetDir, `${id}.json`), JSON.stringify(dataset(id, [{ date: '2026-01', value: id === 'ppi' ? -1.5 : id === 'core-cpi' ? 0.4 : 0.2 }]) , null, 2) + '\n');
    }
    const before = Object.fromEntries(['cpi', 'core-cpi', 'ppi'].map((id) => [id, fs.readFileSync(path.join(targetDir, `${id}.json`), 'utf8')]));
    const corePath = path.join(fixtureDir, 'core-cpi.json');
    const core = JSON.parse(fs.readFileSync(corePath, 'utf8'));
    core.html = core.html.replace('核心CPI同比上涨0.4%', '核心CPI为不可用值');
    fs.writeFileSync(corePath, JSON.stringify(core));
    await assert.rejects(() => runPrices([
      '--fixture-index', fixtureIndex,
      '--fixture-dir', fixtureDir,
      '--target-dir', targetDir,
    ]), /core CPI|official/i);
    assert.deepEqual(
      Object.fromEntries(['cpi', 'core-cpi', 'ppi'].map((id) => [id, fs.readFileSync(path.join(targetDir, `${id}.json`), 'utf8')])),
      before,
    );
  } finally {
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});
