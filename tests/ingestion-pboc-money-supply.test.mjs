import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  discoverPBOCMoneySupplyPublications,
  parsePBOCMoneySupplyReport,
} from '../scripts/ingest/fetch/pboc-money-supply.ts';
import { normalizeMoneySupplyDataset } from '../scripts/ingest/normalize/money-supply.ts';
import { validateMoneySupplyDataset } from '../scripts/ingest/validate/money-supply.ts';
import {
  IngestionContractError,
  MethodologyMismatchError,
  HistoricalMismatchError,
  MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS,
} from '../scripts/ingest/types.ts';
import { runMoneySupply, selectPublications } from '../scripts/ingest/money-supply-cli.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => fs.readFileSync(path.join(here, 'fixtures', 'pboc', name), 'utf8');
const publications = discoverPBOCMoneySupplyPublications(fixture('publication-index.html'));
const rawReports = publications.map((publication) => parsePBOCMoneySupplyReport(
  publication,
  fixture(`report-${publication.month}.html`),
));
const existing = JSON.parse(fs.readFileSync(path.join(here, '..', 'data', 'indicators', 'm1.json'), 'utf8'));
const existingWithFingerprint = {
  ...existing,
  methodologyFingerprint: MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS.m1,
};

test('discovers monthly, annual, quarterly, and half-year PBOC reports', () => {
  assert.deepEqual(publications.map(({ month }) => month), [
    '2025-10', '2025-11', '2025-12', '2026-01', '2026-02',
    '2026-03', '2026-04', '2026-05', '2026-06', '2026-07',
  ]);
  assert.equal(publications[2].title, '2025年金融统计数据报告');
  assert.equal(publications[2].month, '2025-12');
  assert.equal(publications[5].title, '2026年一季度金融统计数据报告');
  assert.equal(publications[5].month, '2026-03');
  assert.equal(publications[8].title, '2026年上半年金融统计数据报告');
  assert.equal(publications[8].month, '2026-06');
  assert.equal(publications[2].url, 'https://www.pbc.gov.cn/diaochatongjisi/116219/116225/2026011515015720511/index.html');
});

test('parses M0 M1 and M2 from one official report', () => {
  const parsed = parsePBOCMoneySupplyReport(publications[1], fixture('report-2025-11.html'));
  assert.deepEqual(parsed.values, { m0: 10.6, m1: 4.9, m2: 8.0 });
  assert.deepEqual(parsed.methodologyFingerprints, MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS);
});

test('maps the annual report to December and parses real punctuation variants', () => {
  const parsed = parsePBOCMoneySupplyReport(publications[2], fixture('report-2025-12.html'));
  assert.deepEqual(parsed.values, { m0: 10.2, m1: 3.8, m2: 8.5 });
  const fullWidth = parsePBOCMoneySupplyReport(publications[9], fixture('report-2026-07.html'));
  assert.deepEqual(fullWidth.values, { m0: 11.6, m1: 4.0, m2: 7.7 });
});

test('preserves the sign of a published decline without reading the M1 history note', () => {
  const html = fixture('report-2025-12.html').replace('同比增长3.8%', '同比下降1.2%');
  const parsed = parsePBOCMoneySupplyReport(publications[2], html);
  assert.equal(parsed.values.m1, -1.2);
});

test('rejects missing, malformed, duplicate, and methodology-changed series', () => {
  const html = fixture('report-2025-11.html');
  assert.throws(() => parsePBOCMoneySupplyReport(publications[1], html.replace('流通中货币(M0)余额', '现金余额')), /M0|series/i);
  assert.throws(() => parsePBOCMoneySupplyReport(publications[1], html.replace('同比增长10.6%', '同比增长待定%')), /numeric|数值/i);
  assert.throws(() => parsePBOCMoneySupplyReport(publications[1], `${html}<p>广义货币(M2)余额335.13万亿元，同比增长8.0%。</p>`), /duplicate|重复|M2/i);
  assert.throws(() => parsePBOCMoneySupplyReport(publications[1], html.replace('单位活期存款', '单位活期及结构性存款')), MethodologyMismatchError);
});

test('rejects invalid publication metadata', () => {
  assert.throws(() => discoverPBOCMoneySupplyPublications('<a href="/report.html">2025年11月金融统计数据报告</a><span>待定</span>'), /date|日期/i);
  assert.throws(() => discoverPBOCMoneySupplyPublications('<a href="https://example.com/report.html">2025年11月金融统计数据报告</a><span>2025-12-12</span>'), /PBOC|official|官方/i);
  assert.throws(() => discoverPBOCMoneySupplyPublications('<a href="/report.html">2025年二季度金融统计数据报告</a><span>2025-12-12</span>'), /monthly|月份|报告/i);
  assert.throws(() => parsePBOCMoneySupplyReport(publications[1], fixture('report-2025-11.html').replace('2025年11月金融统计数据报告', '2025年12月金融统计数据报告')), /month|月份|title|标题/i);
  assert.throws(() => parsePBOCMoneySupplyReport(publications[1], fixture('report-2025-11.html').replace('流通中货币(M0)余额13.74万亿元，同比增长10.6%', '流通中货币(M0)余额13.74万亿元')), IngestionContractError);
});

test('normalizes one PBOC report sequence into the existing M1 dataset contract', () => {
  const normalized = normalizeMoneySupplyDataset(rawReports, existingWithFingerprint, 'm1');
  assert.equal(normalized.unit, '%');
  assert.equal(normalized.metric, 'yoy');
  assert.equal(normalized.calculation, existing.calculation);
  assert.equal(normalized.methodologyFingerprint, MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS.m1);
  assert.deepEqual(normalized.data.at(-1), { date: '2026-07', value: 4.0 });
  assert.equal(normalized.sources.at(-1).coverage, '2026-07 to 2026-07');
  assert.equal(normalized.sources.some(({ coverage }) => coverage === '2024-01 to 2025-10'), true);
});

test('makes the published YoY calculation boundary explicit for M0 and M2', () => {
  for (const id of ['m0', 'm2']) {
    const dataset = JSON.parse(fs.readFileSync(path.join(here, '..', 'data', 'indicators', `${id}.json`), 'utf8'));
    dataset.methodologyFingerprint = MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS[id];
    const normalized = normalizeMoneySupplyDataset(rawReports, dataset, id);
    assert.equal(normalized.calculation, 'published');
    assert.equal(normalized.calculationEffectiveFrom, '2025-11');
    assert.match(normalized.comparabilityNote, /2025-11/);
  }
});

test('only claims M0 and M2 methodology anchors verified by monthly reports', () => {
  assert.equal(MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS.m0, 'pboc-m0|currency-in-circulation|published-yoy');
  assert.equal(MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS.m2, 'pboc-m2|broad-money|published-yoy');
});

test('validates normalized PBOC dataset values without applying the PMI range', () => {
  const normalized = normalizeMoneySupplyDataset(rawReports, existingWithFingerprint, 'm1');
  assert.doesNotThrow(() => validateMoneySupplyDataset(normalized, 'm1'));
  assert.doesNotThrow(() => validateMoneySupplyDataset({ ...normalized, data: [{ ...normalized.data[0], value: -1.2 }] }, 'm1'));
});

test('rejects money-supply field and methodology mismatches before merging', () => {
  assert.throws(() => normalizeMoneySupplyDataset(rawReports, { ...existingWithFingerprint, unit: 'index' }, 'm1'), /unit/i);
  assert.throws(() => normalizeMoneySupplyDataset(rawReports, { ...existingWithFingerprint, frequency: 'quarterly' }, 'm1'), /frequency/i);
  assert.throws(() => normalizeMoneySupplyDataset(rawReports, { ...existingWithFingerprint, metric: 'index' }, 'm1'), /metric/i);
  assert.throws(() => normalizeMoneySupplyDataset(rawReports, { ...existingWithFingerprint, methodologyFingerprint: 'changed' }, 'm1'), MethodologyMismatchError);
  assert.throws(() => normalizeMoneySupplyDataset(
    [{ ...rawReports[0], methodologyFingerprints: { ...rawReports[0].methodologyFingerprints, m0: 'changed' } }],
    { ...existingWithFingerprint, id: 'm0', methodologyFingerprint: MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS.m0 },
    'm0',
  ), MethodologyMismatchError);
});

test('accepts an index that includes the existing latest month before new reports', () => {
  const overlap = { ...publications[0], month: '2025-10' };
  assert.deepEqual(
    selectPublications([overlap, ...publications.slice(1)], '2025-10').map(({ month }) => month),
    publications.map(({ month }) => month),
  );
});

test('rejects incoming gaps, final gaps, and historical mismatches', () => {
  assert.throws(() => normalizeMoneySupplyDataset([rawReports[0], rawReports[2]], existingWithFingerprint, 'm1'), /continuous|连续|month/i);
  assert.throws(() => normalizeMoneySupplyDataset([rawReports[2]], existingWithFingerprint, 'm1'), /continuous|连续|month/i);
  const mismatch = { ...rawReports[1], publication: { ...rawReports[1].publication, month: '2025-10' } };
  assert.throws(() => normalizeMoneySupplyDataset([mismatch], existingWithFingerprint, 'm1'), HistoricalMismatchError);
});

test('allows an older publication date when the report only verifies an existing month', () => {
  const existingThroughNovember = {
    ...existingWithFingerprint,
    updatedAt: '2026-01-31',
    sources: [
      ...existingWithFingerprint.sources,
      {
        title: '中国人民银行：2025年11月金融统计数据报告',
        url: 'https://www.pbc.gov.cn/diaochatongjisi/116219/116225/2025111216000000001/index.html',
        sourceDate: '2026-01-31',
        coverage: '2025-11 to 2025-11',
      },
    ],
    data: [...existingWithFingerprint.data, { date: '2025-11', value: 4.9 }],
  };
  const overlap = {
    ...rawReports[0],
    publication: { ...rawReports[0].publication, sourceDate: '2025-12-12' },
  };
  assert.doesNotThrow(() => normalizeMoneySupplyDataset([overlap], existingThroughNovember, 'm1'));
});

function seedTargets(directory) {
  fs.mkdirSync(directory, { recursive: true });
  for (const id of ['m0', 'm1', 'm2']) {
    const dataset = JSON.parse(fs.readFileSync(path.join(here, '..', 'data', 'indicators', `${id}.json`), 'utf8'));
    dataset.methodologyFingerprint = MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS[id];
    fs.writeFileSync(path.join(directory, `${id}.json`), `${JSON.stringify(dataset, null, 2)}\n`);
  }
}

test('runs the fixture CLI for all three targets and is idempotent', async () => {
  const directory = fs.mkdtempSync(path.join('/tmp', 'macrolens-pboc-cli-'));
  seedTargets(directory);
  const args = [
    '--fixture-index', path.join(here, 'fixtures', 'pboc', 'publication-index.html'),
    '--fixture-dir', path.join(here, 'fixtures', 'pboc'),
    '--target-dir', directory,
  ];
  const firstOutput = await captureOutput(() => runMoneySupply(args));
  assert.match(firstOutput, /m0.*Changed: true/s);
  assert.match(firstOutput, /m1.*Changed: true/s);
  assert.match(firstOutput, /m2.*Changed: true/s);
  for (const id of ['m0', 'm1', 'm2']) {
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, `${id}.json`), 'utf8')).data.at(-1).date, '2026-07');
  }
  const snapshots = new Map(['m0', 'm1', 'm2'].map((id) => [id, fs.readFileSync(path.join(directory, `${id}.json`), 'utf8')]));
  const secondOutput = await captureOutput(() => runMoneySupply(args));
  assert.match(secondOutput, /m0.*Changed: false/s);
  assert.match(secondOutput, /m1.*Changed: false/s);
  assert.match(secondOutput, /m2.*Changed: false/s);
  for (const id of ['m0', 'm1', 'm2']) assert.equal(fs.readFileSync(path.join(directory, `${id}.json`), 'utf8'), snapshots.get(id));
});

test('does not write any target when one fetched series has a historical mismatch', async () => {
  const directory = fs.mkdtempSync(path.join('/tmp', 'macrolens-pboc-atomic-'));
  const fixtures = fs.mkdtempSync(path.join('/tmp', 'macrolens-pboc-fixture-'));
  for (const name of [
    'publication-index.html',
    ...['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07']
      .map((month) => `report-${month}.html`),
  ]) {
    fs.copyFileSync(path.join(here, 'fixtures', 'pboc', name), path.join(fixtures, name));
  }
  seedTargets(directory);
  const args = ['--fixture-index', path.join(fixtures, 'publication-index.html'), '--fixture-dir', fixtures, '--target-dir', directory];
  await runMoneySupply(args);
  const before = new Map(['m0', 'm1', 'm2'].map((id) => [id, fs.readFileSync(path.join(directory, `${id}.json`), 'utf8')]));
  fs.writeFileSync(path.join(fixtures, 'report-2026-07.html'), fixture('report-2026-07.html').replace('同比增长11.6%', '同比增长9.9%'));
  await assert.rejects(() => runMoneySupply(args), HistoricalMismatchError);
  for (const id of ['m0', 'm1', 'm2']) assert.equal(fs.readFileSync(path.join(directory, `${id}.json`), 'utf8'), before.get(id));
});

test('help exits before reading or writing indicator data', async () => {
  await assert.doesNotReject(() => runMoneySupply(['--help']));
});

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
