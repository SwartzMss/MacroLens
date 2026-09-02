import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  discoverLatestPmiPublication,
  parsePmiPublication,
} from '../scripts/ingest/fetch/nbs-pmi.ts';
import { normalizePmiDataset } from '../scripts/ingest/normalize/pmi.ts';
import { validateIndicatorDataset } from '../scripts/ingest/validate/dataset.ts';
import { validatePmiDataset } from '../scripts/ingest/validate/pmi.ts';
import { mergeObservations, mergePmiObservations } from '../scripts/ingest/validate/overlap.ts';
import { HistoricalMismatchError, MethodologyMismatchError } from '../scripts/ingest/types.ts';
import { writeIndicatorDataset } from '../scripts/ingest/write/indicator.ts';
import { run as runPmiCli } from '../scripts/ingest/cli.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => fs.readFileSync(path.join(here, 'fixtures', 'nbs', name), 'utf8');
const existingDataset = JSON.parse(fs.readFileSync(path.join(here, '..', 'data', 'indicators', 'pmi.json'), 'utf8'));
const baselineDataset = {
  ...existingDataset,
  updatedAt: '2025-10-31',
  sources: [
    existingDataset.sources[0],
    {
      title: '国家统计局：2025年10月中国采购经理指数运行情况',
      url: 'https://www.stats.gov.cn/sj/zxfb/202510/t20251031_1961740.html',
      sourceDate: '2025-10-31',
      coverage: '2024-10 to 2025-10',
    },
  ],
  data: existingDataset.data.filter(({ date }) => date <= '2025-10'),
};

test('discovers the latest NBS PMI data publication and excludes interpretation links', () => {
  assert.deepEqual(discoverLatestPmiPublication(fixture('publication-index.html')), {
    title: '2026年8月中国采购经理指数运行情况',
    url: 'https://www.stats.gov.cn/sj/zxfbhjd/202608/t20260831_1965154.html',
    sourceDate: '2026-08-31',
  });
});

test('resolves the relative links used by the live NBS aggregation page', () => {
  const html = fixture('publication-index.html').replaceAll('/sj/zxfbhjd/202608/', './202608/');
  assert.equal(
    discoverLatestPmiPublication(html).url,
    'https://www.stats.gov.cn/sj/zxfbhjd/202608/t20260831_1965154.html',
  );
});

test('parses only the main manufacturing PMI column across 13 continuous months', () => {
  const publication = discoverLatestPmiPublication(fixture('publication-index.html'));
  const raw = parsePmiPublication(publication, fixture('pmi-2026-08.html'));

  assert.deepEqual(raw.observations.slice(-2), [
    { date: '2026-07', value: 49.2 },
    { date: '2026-08', value: 49.8 },
  ]);
  assert.equal(raw.observations.length, 13);
  assert.equal(raw.observations.some(({ value }) => value === 51.4), false);
});

test('accepts the spaced month labels used in the official table markup', () => {
  const publication = discoverLatestPmiPublication(fixture('publication-index.html'));
  const html = fixture('pmi-2026-08.html').replace('2026年8月</td>', '2026 年 8 月</td>');
  const raw = parsePmiPublication(publication, html);
  assert.deepEqual(raw.observations.at(-1), { date: '2026-08', value: 49.8 });
});

test('rejects a PMI methodology change even when the table shape is unchanged', () => {
  const publication = discoverLatestPmiPublication(fixture('publication-index.html'));
  const changedMethodology = fixture('pmi-2026-08.html').replace('新订单指数，权数为30%', '新订单指数，权数为35%');
  assert.throws(
    () => parsePmiPublication(publication, changedMethodology),
    MethodologyMismatchError,
  );
});

test('rejects an index containing only an interpretation link', () => {
  assert.throws(
    () => discoverLatestPmiPublication('<a href="/interpret.html">解读2026年8月中国采购经理指数</a><span>2026-08-31</span>'),
    /中国采购经理指数运行情况|publication/i,
  );
});

test('rejects a matching publication without a valid publication date', () => {
  assert.throws(
    () => discoverLatestPmiPublication('<a href="/pmi.html">2026年8月中国采购经理指数运行情况</a><span>待定</span>'),
    /date|日期/i,
  );
});

test('rejects a publication without the required table heading', () => {
  const publication = discoverLatestPmiPublication(fixture('publication-index.html'));
  assert.throws(
    () => parsePmiPublication(publication, fixture('pmi-2026-08.html').replace('表1 中国制造业PMI及构成指数', '表1 其他指数')),
    /表1 中国制造业PMI及构成指数/,
  );
});

test('rejects a publication without a PMI column', () => {
  const publication = discoverLatestPmiPublication(fixture('publication-index.html'));
  assert.throws(
    () => parsePmiPublication(publication, fixture('pmi-2026-08.html').replace('<th>PMI</th>', '<th>制造业指数</th>')),
    /PMI/,
  );
});

test('rejects a non-numeric main PMI cell', () => {
  const publication = discoverLatestPmiPublication(fixture('publication-index.html'));
  assert.throws(
    () => parsePmiPublication(publication, fixture('pmi-2026-08.html').replace('2026年8月</td><td>49.8', '2026年8月</td><td>—')),
    /numeric|数值|PMI/i,
  );
});

test('rejects a non-contiguous month sequence', () => {
  const publication = discoverLatestPmiPublication(fixture('publication-index.html'));
  assert.throws(
    () => parsePmiPublication(publication, fixture('pmi-2026-08.html').replace('2026年1月', '2026年3月')),
    /contiguous|连续|month|月份/i,
  );
});

test('merges agreeing overlaps and appends only new PMI observations', () => {
  const publication = discoverLatestPmiPublication(fixture('publication-index.html'));
  const raw = parsePmiPublication(publication, fixture('pmi-2026-08.html'));
  const merged = mergePmiObservations(existingDataset.data, raw.observations);

  assert.deepEqual(merged.slice(-3), [
    { date: '2026-06', value: 50.3 },
    { date: '2026-07', value: 49.2 },
    { date: '2026-08', value: 49.8 },
  ]);
  assert.equal(merged.length, 32);
});

test('hard-fails before merging a historical value mismatch', () => {
  assert.throws(
    () => mergePmiObservations(existingDataset.data, [{ date: '2025-09', value: 49.7 }]),
    HistoricalMismatchError,
  );
});

test('normalizes the publication into the existing indicator contract', () => {
  const publication = discoverLatestPmiPublication(fixture('publication-index.html'));
  const raw = parsePmiPublication(publication, fixture('pmi-2026-08.html'));
  const normalized = normalizePmiDataset(raw, existingDataset);

  assert.equal(normalized.id, existingDataset.id);
  assert.equal(normalized.country, existingDataset.country);
  assert.equal(normalized.frequency, 'monthly');
  assert.equal(normalized.unit, 'index');
  assert.equal(normalized.metric, 'index');
  assert.equal(normalized.calculation, existingDataset.calculation);
  assert.equal(normalized.definitionAsOf, existingDataset.definitionAsOf);
  assert.equal(normalized.updatedAt, '2026-08-31');
  assert.deepEqual(normalized.data.slice(-1), [{ date: '2026-08', value: 49.8 }]);
  assert.equal(normalized.sources.length, 3);
  assert.equal(normalized.sources[1].sourceDate, '2025-10-31');
  assert.equal(normalized.sources.at(-1).sourceDate, '2026-08-31');
  assert.equal(normalized.sources.at(-1).coverage, '2025-08 to 2026-08');
  assert.equal(normalized.sources.at(-1).url, 'https://www.stats.gov.cn/sj/zxfbhjd/202608/t20260831_1965154.html');
  assert.equal(normalized.methodologyFingerprint, raw.methodologyFingerprint);
});

test('validates the normalized indicator dataset', () => {
  const publication = discoverLatestPmiPublication(fixture('publication-index.html'));
  const normalized = normalizePmiDataset(parsePmiPublication(publication, fixture('pmi-2026-08.html')), existingDataset);
  assert.doesNotThrow(() => validatePmiDataset(normalized));
});

test('rejects an indicator dataset with an invalid series contract', () => {
  assert.throws(
    () => validatePmiDataset({ ...existingDataset, metric: 'rate' }),
    /metric/i,
  );
  assert.throws(
    () => validatePmiDataset({ ...existingDataset, data: [{ date: '2025-01', value: 101 }] }),
    /value|\[0, 100\]/i,
  );
  assert.throws(
    () => validatePmiDataset({ ...existingDataset, sources: [] }),
    /source/i,
  );
  assert.throws(
    () => validatePmiDataset({ ...existingDataset, data: [{ date: '2025-10', value: 49 }, { date: '2025-12', value: 50 }] }),
    /continuous|连续|month|月份/i,
  );
});

test('generic indicator validation accepts a monthly percentage dataset', () => {
  assert.doesNotThrow(() => validateIndicatorDataset({
    ...existingDataset,
    source: 'PBOC',
    unit: '%',
    metric: 'yoy',
    calculation: 'published',
  }));
});

test('generic observation merging reports the series label on mismatch', () => {
  assert.deepEqual(
    mergeObservations([{ date: '2025-01', value: 1 }], [{ date: '2025-02', value: 2 }], 'M1'),
    [{ date: '2025-01', value: 1 }, { date: '2025-02', value: 2 }],
  );
  assert.throws(
    () => mergeObservations([{ date: '2025-01', value: 1 }], [{ date: '2025-01', value: 2 }], 'M1'),
    /M1.*2025-01/i,
  );
});

test('rejects a publication older than the existing dataset update', () => {
  const publication = discoverLatestPmiPublication(fixture('publication-index.html'));
  const raw = parsePmiPublication(publication, fixture('pmi-2026-08.html'));
  const oldRaw = { ...raw, publication: { ...raw.publication, sourceDate: '2025-09-30' } };
  assert.throws(
    () => normalizePmiDataset(oldRaw, existingDataset),
    /older|source date|updatedAt/i,
  );
});

test('rejects a merged dataset with a missing month between existing and incoming data', () => {
  const publication = discoverLatestPmiPublication(fixture('publication-index.html'));
  const raw = parsePmiPublication(publication, fixture('pmi-2026-08.html'));
  const gapRaw = { ...raw, observations: raw.observations.filter(({ date }) => date >= '2025-12') };
  assert.throws(
    () => validatePmiDataset(normalizePmiDataset(gapRaw, baselineDataset)),
    /continuous|连续|month|月份/i,
  );
});

test('uses the incoming publication range for source coverage even when existing data is newer', () => {
  const publication = discoverLatestPmiPublication(fixture('publication-index.html'));
  const parsed = parsePmiPublication(publication, fixture('pmi-2026-08.html'));
  const raw = {
    ...parsed,
    publication: { ...parsed.publication, sourceDate: '2026-09-01' },
    observations: parsed.observations.filter(({ date }) => date <= '2026-07'),
  };
  const normalized = normalizePmiDataset(raw, existingDataset);
  assert.equal(normalized.sources.at(-1).coverage, '2025-08 to 2026-07');
});

test('writes stable two-space JSON and reports unchanged output on the second run', () => {
  const target = path.join(fs.mkdtempSync(path.join('/tmp', 'macrolens-pmi-')), 'pmi.json');
  const first = writeIndicatorDataset(target, existingDataset);
  assert.equal(first.changed, true);
  assert.equal(first.output, `${JSON.stringify(existingDataset, null, 2)}\n`);
  assert.equal(fs.readFileSync(target, 'utf8'), first.output);

  const second = writeIndicatorDataset(target, existingDataset);
  assert.equal(second.changed, false);
  assert.equal(second.output, first.output);
});

test('runs the fixture CLI idempotently and appends only the missing months', async () => {
  const directory = fs.mkdtempSync(path.join('/tmp', 'macrolens-pmi-cli-'));
  const target = path.join(directory, 'pmi.json');
  fs.writeFileSync(target, `${JSON.stringify(baselineDataset, null, 2)}\n`);
  const args = [
    '--fixture-index', 'tests/fixtures/nbs/publication-index.html',
    '--fixture-publication', 'tests/fixtures/nbs/pmi-2026-08.html',
    '--target', target,
  ];
  const firstOutput = await captureOutput(() => runPmiCli(args));
  const firstDataset = JSON.parse(fs.readFileSync(target, 'utf8'));
  assert.match(firstOutput, /Changed: true/);
  assert.deepEqual(firstDataset.data.slice(-10), [
    { date: '2025-11', value: 49.2 },
    { date: '2025-12', value: 50.1 },
    { date: '2026-01', value: 49.3 },
    { date: '2026-02', value: 49.0 },
    { date: '2026-03', value: 50.4 },
    { date: '2026-04', value: 50.3 },
    { date: '2026-05', value: 50.0 },
    { date: '2026-06', value: 50.3 },
    { date: '2026-07', value: 49.2 },
    { date: '2026-08', value: 49.8 },
  ]);
  assert.equal(firstDataset.sources.length, 3);
  const afterFirst = fs.readFileSync(target, 'utf8');
  const secondOutput = await captureOutput(() => runPmiCli(args));
  assert.match(secondOutput, /Changed: false/);
  assert.equal(fs.readFileSync(target, 'utf8'), afterFirst);
});

test('defines a scheduled and manually runnable reviewable data-update workflow', () => {
  const workflow = fs.readFileSync(path.join(here, '..', '.github', 'workflows', 'update-macro-data.yml'), 'utf8');
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /cron:\s*["']?30 2 1 \* \*["']?/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run ingest:pmi/);
  assert.match(workflow, /contents:\s*write/);
  assert.match(workflow, /pull-requests:\s*write/);
  assert.match(workflow, /peter-evans\/create-pull-request@v7/);
  assert.match(workflow, /data\/indicators\/pmi\.json/);
  assert.doesNotMatch(workflow, /playwright|puppeteer|browser/i);
  assert.match(workflow, /stats\.gov\.cn/);
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
