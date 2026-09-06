import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseLprHistoryResponse } from '../scripts/ingest/fetch/lpr.ts';
import { normalizeLprDataset } from '../scripts/ingest/normalize/lpr.ts';
import { validateLprDataset } from '../scripts/ingest/validate/lpr.ts';
import { runLpr, LPR_HISTORY_URL } from '../scripts/ingest/lpr-cli.ts';
import { HistoricalMismatchError, IngestionContractError, LPR_METHODOLOGY_FINGERPRINT } from '../scripts/ingest/types.ts';
import { getIndicatorData } from '../src/data/indicatorRegistry.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(here, 'fixtures', 'chinamoney', 'lpr-history.json');
const fixture = fs.readFileSync(fixturePath, 'utf8');

const existing = {
  id: 'lpr', country: 'CN', frequency: 'monthly', unit: '%', metric: 'rate',
  label: '贷款市场报价利率（LPR）', chartTitle: '贷款市场报价利率（LPR）', source: 'CFETS',
  calculation: 'published', updatedAt: '2026-06-22',
  comparabilityNote: '两条期限序列均为全国银行间同业拆借中心公布的月度利率水平；不合成利差。',
  methodologyFingerprint: LPR_METHODOLOGY_FINGERPRINT,
  sources: [{ title: '全国银行间同业拆借中心：2026-06 LPR 历史数据', url: LPR_HISTORY_URL, sourceDate: '2026-06-22', coverage: '2026-06 to 2026-06' }],
  data: [{ date: '2026-06', value: 3 }],
  series: [
    { id: '1y', label: '1年期 LPR', data: [{ date: '2026-06', value: 3 }] },
    { id: '5y-plus', label: '5年期以上 LPR', data: [{ date: '2026-06', value: 3.5 }] },
  ],
};

test('parses both official LPR tenors and publication months exactly', () => {
  const publications = parseLprHistoryResponse(fixture, LPR_HISTORY_URL);
  assert.deepEqual(publications.map(({ publication, values }) => ({
    date: publication.sourceDate, month: publication.month, values,
  })), [
    { date: '2026-07-20', month: '2026-07', values: { '1y': 3, '5y-plus': 3.5 } },
    { date: '2026-08-20', month: '2026-08', values: { '1y': 3, '5y-plus': 3.5 } },
  ]);
});

test('rejects missing, duplicate, malformed, renamed, and misordered tenor fields', () => {
  assert.throws(() => parseLprHistoryResponse(JSON.stringify({ data: { csv: 'date,c1,c2,c3,c4,c5,lpr1y\n2026-08-20,,,,,,3.00' } }), LPR_HISTORY_URL), /columns|Malformed/);
  assert.throws(() => parseLprHistoryResponse(fixture.replace('2026-08-20,,,,,,3.00,3.50', '2026-07-20,,,,,,3.00,3.50'), LPR_HISTORY_URL), /duplicate|重复/i);
  assert.throws(() => parseLprHistoryResponse(fixture.replace('3.00,3.50', '待定,3.50'), LPR_HISTORY_URL), /Invalid|数值/);
  assert.throws(() => parseLprHistoryResponse(fixture.replace('2026-07-20', '2026-07-xx'), LPR_HISTORY_URL), /date|日期/);
  assert.throws(() => parseLprHistoryResponse(fixture.replace('3.00,3.50', '3.60,3.50'), LPR_HISTORY_URL), /exceeds|大于/);
  assert.throws(() => parseLprHistoryResponse(fixture.replace('lpr5y', 'renamed-tenor'), LPR_HISTORY_URL), /renamed|missing|tenor|期限/i);
});

test('normalizes deterministic multi-series data and protects historical overlap', () => {
  const normalized = normalizeLprDataset(parseLprHistoryResponse(fixture, LPR_HISTORY_URL), existing);
  assert.deepEqual(normalized.data.at(-1), { date: '2026-08', value: 3 });
  assert.deepEqual(normalized.series.map(({ id, data }) => ({ id, last: data.at(-1) })), [
    { id: '1y', last: { date: '2026-08', value: 3 } },
    { id: '5y-plus', last: { date: '2026-08', value: 3.5 } },
  ]);
  assert.equal(JSON.stringify(normalizeLprDataset(parseLprHistoryResponse(fixture, LPR_HISTORY_URL), normalized)), JSON.stringify(normalized));
  assert.doesNotThrow(() => validateLprDataset(normalized));
  const mismatchExisting = {
    ...normalized,
    data: [...normalized.data],
    series: normalized.series.map((series) => ({ ...series, data: [...series.data] })),
  };
  assert.throws(() => normalizeLprDataset(parseLprHistoryResponse(fixture.replace('2026-08-08', '2026-08-08').replace('2026-08-20,,,,,,3.00,3.50', '2026-08-20,,,,,,3.10,3.50'), LPR_HISTORY_URL), mismatchExisting), HistoricalMismatchError);
  assert.throws(() => normalizeLprDataset(parseLprHistoryResponse(fixture.replace('2026-08-20', '2026-09-20'), LPR_HISTORY_URL), existing), IngestionContractError);
});

test('fixture CLI is idempotent and writes both LPR series', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'macrolens-lpr-'));
  const target = path.join(directory, 'lpr.json');
  const fixtureCopy = path.join(directory, 'lpr-history.json');
  fs.writeFileSync(target, `${JSON.stringify(existing, null, 2)}\n`);
  fs.copyFileSync(fixturePath, fixtureCopy);
  await runLpr(['--fixture', fixtureCopy, '--target', target]);
  const first = fs.readFileSync(target, 'utf8');
  assert.equal(JSON.parse(first).series.length, 2);
  await runLpr(['--fixture', fixtureCopy, '--target', target]);
  assert.equal(fs.readFileSync(target, 'utf8'), first);
});

test('LPR is registered, rendered by the generic multi-series chart, and scheduled', () => {
  const dataset = getIndicatorData('lpr');
  assert.equal(dataset.series?.length, 2);
  assert.deepEqual(dataset.series?.map(({ id }) => id), ['1y', '5y-plus']);
  assert.deepEqual(dataset.series?.[0].data.find(({ date }) => date === '2020-01'), { date: '2020-01', value: 4.15 });
  assert.deepEqual(dataset.series?.[0].data.find(({ date }) => date === '2021-01'), { date: '2021-01', value: 3.85 });
  assert.deepEqual(dataset.series?.[1].data.find(({ date }) => date === '2024-02'), { date: '2024-02', value: 3.95 });
  assert.deepEqual(dataset.series?.[0].data.at(-1), { date: '2026-08', value: 3 });
  assert.deepEqual(dataset.series?.[1].data.at(-1), { date: '2026-08', value: 3.5 });
  const chart = fs.readFileSync(path.join(here, '..', 'src', 'components', 'IndicatorChart.astro'), 'utf8');
  const workflow = fs.readFileSync(path.join(here, '..', '.github', 'workflows', 'update-macro-data.yml'), 'utf8');
  const page = fs.readFileSync(path.join(here, '..', 'src', 'content', 'concepts', 'lpr.md'), 'utf8');
  assert.match(chart, /indicator\.series/);
  assert.match(chart, /legend/);
  assert.match(workflow, /npm run ingest:lpr/);
  assert.match(workflow, /data\/indicators\/lpr\.json/);
  assert.match(page, /^chart: lpr$/m);
});
