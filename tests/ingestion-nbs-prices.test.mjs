import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
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
  fetchNbsPriceIndex,
  nbsPricePublicationIndex,
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

test('parses core CPI YoY from the official CPI table', () => {
  const fixture = priceFixture('core-cpi');
  const raw = parseNbsPricePublication(fixture.publication, fixture.html, 'core-cpi');
  assert.equal(raw.observations[0].value, 0.8);
});

test('rejects a publication when the observable price methodology marker changes', () => {
  for (const id of ['cpi', 'core-cpi', 'ppi']) {
    const fixture = priceFixture(id);
    assert.throws(
      () => parseNbsPricePublication(fixture.publication, fixture.html.replace('2025年为基期', '2024年为基期'), id),
      MethodologyMismatchError,
    );
  }
});

test('accepts the official PPI base-year wording variant', () => {
  const fixture = priceFixture('ppi');
  const variant = fixture.html.replace(
    '2026年1月起，工业生产者出厂价格指数以2025年为基期。',
    '2026年1月份开始编制和发布以2025年为基期的PPI。',
  );
  assert.doesNotThrow(() => parseNbsPricePublication(fixture.publication, variant, 'ppi'));
});

test('parses an official CPI publication that reports同比持平 as zero', () => {
  const fixture = priceFixture('cpi');
  const variant = fixture.html.replace(/同比上涨0\.2%/g, '同比持平');
  const raw = parseNbsPricePublication(fixture.publication, variant, 'cpi');
  assert.equal(raw.observations[0].value, 0);
});

test('parses an official PPI publication that reports同比持平 as zero', () => {
  const fixture = priceFixture('ppi');
  const variant = fixture.html.replace(/同比下降1\.4%/g, '同比持平');
  const raw = parseNbsPricePublication(fixture.publication, variant, 'ppi');
  assert.equal(raw.observations[0].value, 0);
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

test('discovers core CPI from the formal CPI release rather than an interpretation page', () => {
  const index = [
    '<a href="/sj/sjjd/202608/t20260809_1965009.html">2026年7月份居民消费价格同比上涨0.5%</a> 2026-08-09',
    '<a href="/sj/zxfbhjd/202608/t20260809_1965009.html">2026年7月份居民消费价格同比上涨0.5%解读</a> 2026-08-09',
  ].join(' ');
  const publication = discoverLatestPricePublication(index, 'core-cpi');
  assert.equal(publication.url, 'https://www.stats.gov.cn/sj/sjjd/202608/t20260809_1965009.html');
  assert.equal(publication.coverage, '2026-07 to 2026-07');
});

test('fetches the next official release-index page when the root page is stale', async () => {
  const requested = [];
  const pages = new Map([
    [nbsPricePublicationIndex, '<a href="/sj/zxfbhjd/202608/t20260817_1965010.html">2026年7月份国民经济运行情况</a> 2026-08-17'],
    [`${nbsPricePublicationIndex}index_1.html`, '<a href="/sj/zxfbhjd/202608/t20260817_1965055.html">2026年7月份规模以上工业增加值增长4.5%</a> 2026-08-17'],
    [`${nbsPricePublicationIndex}index_2.html`, '<a href="/sj/zxfbhjd/202608/t20260809_1965008.html">2026年7月份居民消费价格同比上涨0.5%</a> 2026-08-09 <a href="/sj/zxfbhjd/202608/t20260809_1965007.html">2026年7月份工业生产者出厂价格同比上涨3.5%</a> 2026-08-09'],
  ]);
  const combined = await fetchNbsPriceIndex(async (url) => {
    requested.push(url);
    return pages.get(url) ?? '';
  });
  assert.deepEqual(requested, [
    nbsPricePublicationIndex,
    `${nbsPricePublicationIndex}index_1.html`,
    `${nbsPricePublicationIndex}index_2.html`,
  ]);
  assert.match(combined, /2026年7月份居民消费价格同比上涨0\.5%/);
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

test('price normalization replaces a legacy same-coverage source with the incoming official release', () => {
  const legacyUrl = 'https://www.stats.gov.cn/sj/sjjd/202608/t20260809_1965009.html';
  const formalUrl = 'https://www.stats.gov.cn/sj/zxfbhjd/202608/t20260809_1965008.html';
  const existing = dataset('core-cpi', [{ date: '2026-07', value: 0.9 }], {
    sources: [{ ...source('2026-07 to 2026-07'), url: legacyUrl, role: 'data' }],
  });
  const incoming = rawPrice('core-cpi', [{ date: '2026-07', value: 0.9 }]);
  incoming.dataSources = [{ ...incoming.dataSources[0], url: formalUrl, role: 'data', coverage: '2026-07 to 2026-07' }];
  const normalized = normalizePriceDataset(incoming, existing, 'core-cpi');
  assert.deepEqual(normalized.sources.map(({ url }) => url), [formalUrl]);
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

test('price group writer restores all targets when backup fails mid-commit', async () => {
  const targetDir = fs.mkdtempSync('/tmp/macrolens-price-group-rollback-');
  try {
    const targets = ['cpi', 'core-cpi', 'ppi'].map((id) => path.join(targetDir, `${id}.json`));
    for (const target of targets) fs.writeFileSync(target, `old-${path.basename(target)}\n`);
    const outputs = new Map(targets.map((target) => [target, `new-${path.basename(target)}\n`]));
    let copies = 0;
    const failingFileSystem = {
      ...fsPromises,
      copyFile: async (...args) => {
        copies += 1;
        if (copies === 2) throw new Error('injected backup failure');
        return fsPromises.copyFile(...args);
      },
    };

    await assert.rejects(
      () => writeIndicatorDatasetGroup(outputs, failingFileSystem),
      /injected backup failure/,
    );
    assert.deepEqual(
      targets.map((target) => fs.readFileSync(target, 'utf8')),
      targets.map((target) => `old-${path.basename(target)}\n`),
    );
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
      fs.writeFileSync(path.join(targetDir, `${id}.json`), JSON.stringify(dataset(id, [{ date: '2026-01', value: id === 'ppi' ? -1.4 : id === 'core-cpi' ? 0.8 : 0.2 }]) , null, 2) + '\n');
    }
    const before = Object.fromEntries(['cpi', 'core-cpi', 'ppi'].map((id) => [id, fs.readFileSync(path.join(targetDir, `${id}.json`), 'utf8')]));
    const corePath = path.join(fixtureDir, 'core-cpi.json');
    const core = JSON.parse(fs.readFileSync(corePath, 'utf8'));
    core.html = core.html.replace('<td>0.8</td><td>0.8</td>', '<td>不可用值</td><td>不可用值</td>');
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

test('checked-in price datasets are complete monthly official series', () => {
  for (const id of ['cpi', 'core-cpi', 'ppi']) {
    const checkedIn = JSON.parse(fs.readFileSync(path.join(here, '..', 'data', 'indicators', `${id}.json`), 'utf8'));
    validatePriceDataset(checkedIn, id);
    assert.equal(checkedIn.data[0].date, '2026-01');
    assert.equal(checkedIn.data.at(-1).date, '2026-07');
    assert.equal(checkedIn.data.length, 7);
    assert.ok(checkedIn.sources.every((source) => source.url.includes('stats.gov.cn')));
    if (id === 'cpi' || id === 'core-cpi') {
      assert.equal(checkedIn.sources.at(-1).url, 'https://www.stats.gov.cn/sj/zxfbhjd/202608/t20260809_1965008.html');
      const april = checkedIn.sources.find((source) => source.coverage === '2026-04 to 2026-04');
      assert.deepEqual(
        { url: april.url, sourceDate: april.sourceDate },
        {
          url: 'https://www.stats.gov.cn/sj/zxfbhjd/202605/t20260511_1963659.html',
          sourceDate: '2026-05-11',
        },
      );
    }
  }
});

test('scheduled workflow runs and tracks all price datasets', () => {
  const workflow = fs.readFileSync(path.join(here, '..', '.github', 'workflows', 'update-macro-data.yml'), 'utf8');
  assert.match(workflow, /npm run ingest:nbs-prices/);
  for (const id of ['cpi', 'core-cpi', 'ppi']) assert.match(workflow, new RegExp(`data/indicators/${id}\\.json`));
});
