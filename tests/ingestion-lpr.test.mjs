import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  discoverLprArchivePageLinks,
  discoverLprPublications,
  parseLprAnnouncement,
} from '../scripts/ingest/fetch/lpr.ts';
import { normalizeLprDataset } from '../scripts/ingest/normalize/lpr.ts';
import { validateLprDataset, validateLprPublications } from '../scripts/ingest/validate/lpr.ts';
import { runLpr, PBOC_LPR_ARCHIVE_URL } from '../scripts/ingest/lpr-cli.ts';
import { HistoricalMismatchError, IngestionContractError, LPR_METHODOLOGY_FINGERPRINT } from '../scripts/ingest/types.ts';
import { getIndicatorData } from '../src/data/indicatorRegistry.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(here, 'fixtures', 'pboc', 'lpr');
const indexFixture = fs.readFileSync(path.join(fixtureDir, 'publication-index.html'), 'utf8');
const publications = discoverLprPublications(indexFixture, PBOC_LPR_ARCHIVE_URL);
const julyPublication = publications.find(({ month }) => month === '2026-07');
const augustPublication = publications.find(({ month }) => month === '2026-08');
const julyHtml = fs.readFileSync(path.join(fixtureDir, 'lpr-2026-07.html'), 'utf8');
const augustHtml = fs.readFileSync(path.join(fixtureDir, 'lpr-2026-08.html'), 'utf8');

assert.ok(julyPublication);
assert.ok(augustPublication);

const existing = {
  id: 'lpr', country: 'CN', frequency: 'monthly', unit: '%', metric: 'rate',
  label: '贷款市场报价利率（LPR）', chartTitle: '贷款市场报价利率（LPR）', source: 'PBOC',
  calculation: 'published', updatedAt: '2026-06-22',
  comparabilityNote: '两条期限序列均为央行公告中的月度利率水平；不合成利差。',
  methodologyFingerprint: LPR_METHODOLOGY_FINGERPRINT,
  sources: [{
    title: '中国人民银行：2026年6月22日全国银行间同业拆借中心受权公布贷款市场报价利率（LPR）公告',
    url: 'https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125440/3876551/2026062208495122562/index.html',
    sourceDate: '2026-06-22', coverage: '2026-06 to 2026-06',
  }],
  data: [{ date: '2026-06', value: 3 }],
  series: [
    { id: '1y', label: '1年期 LPR', data: [{ date: '2026-06', value: 3 }] },
    { id: '5y-plus', label: '5年期以上 LPR', data: [{ date: '2026-06', value: 3.5 }] },
  ],
};

test('discovers paginated PBOC archive links and monthly announcements', () => {
  assert.deepEqual(discoverLprArchivePageLinks(indexFixture, PBOC_LPR_ARCHIVE_URL), [
    'https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125440/3876551/de24575c-2.html',
  ]);
  assert.deepEqual(publications.map(({ sourceDate, month }) => ({ sourceDate, month })), [
    { sourceDate: '2026-07-20', month: '2026-07' },
    { sourceDate: '2026-08-20', month: '2026-08' },
  ]);
});

test('parses both LPR tenors from an official announcement without ordering assumptions', () => {
  assert.deepEqual(parseLprAnnouncement(julyPublication, julyHtml).values, { '1y': 3, '5y-plus': 3.5 });
  assert.deepEqual(parseLprAnnouncement(augustPublication, augustHtml.replace('3.00%，5年期以上LPR为3.50%', '3.60%，5年期以上LPR为3.50%')).values, { '1y': 3.6, '5y-plus': 3.5 });
});

test('rejects missing, duplicate, malformed, renamed, and misidentified announcement fields', () => {
  assert.throws(() => parseLprAnnouncement(julyPublication, julyHtml.replace('1年期LPR为3.00%', '1年期LPR待定')), /Missing 1Y/);
  assert.throws(() => parseLprAnnouncement(julyPublication, `${julyHtml} 1年期LPR为3.00%`), /Duplicate 1Y/);
  assert.throws(() => parseLprAnnouncement(julyPublication, julyHtml.replace('1年期LPR为3.00%', '1年期LPR为待定%')), /Invalid 1Y/);
  assert.throws(() => parseLprAnnouncement(julyPublication, julyHtml.replace('5年期以上LPR', '5年期LPR')), /Missing 5Y/);
  assert.throws(() => parseLprAnnouncement(julyPublication, julyHtml.replaceAll('贷款市场报价利率（LPR）', '贷款市场报价利率')), /identity/);
  assert.throws(() => parseLprAnnouncement({ ...julyPublication, month: '2026-08' }, julyHtml), /mismatch/);
});

test('normalizes deterministic multi-series data and protects historical overlap', () => {
  const july = parseLprAnnouncement(julyPublication, julyHtml);
  const august = parseLprAnnouncement(augustPublication, augustHtml);
  const normalized = normalizeLprDataset([july, august], existing);
  assert.deepEqual(normalized.data.at(-1), { date: '2026-08', value: 3 });
  assert.deepEqual(normalized.series.map(({ id, data }) => ({ id, last: data.at(-1) })), [
    { id: '1y', last: { date: '2026-08', value: 3 } },
    { id: '5y-plus', last: { date: '2026-08', value: 3.5 } },
  ]);
  assert.deepEqual(normalized.sources.map(({ url, coverage }) => ({ url, coverage })), [
    ...existing.sources.map(({ url, coverage }) => ({ url, coverage })),
    { url: julyPublication.url, coverage: '2026-07 to 2026-07' },
    { url: augustPublication.url, coverage: '2026-08 to 2026-08' },
  ]);
  assert.equal(JSON.stringify(normalizeLprDataset([july, august], normalized)), JSON.stringify(normalized));
  assert.doesNotThrow(() => validateLprDataset(normalized));
  assert.throws(() => validateLprPublications([july, { ...august, publication: { ...august.publication, month: '2026-09' } }]), IngestionContractError);
  const mismatchExisting = {
    ...normalized,
    data: [...normalized.data],
    series: normalized.series.map((series) => ({ ...series, data: [...series.data] })),
  };
  const changedAugust = parseLprAnnouncement(augustPublication, augustHtml.replace('5年期以上LPR为3.50%', '5年期以上LPR为3.40%'));
  assert.throws(() => normalizeLprDataset([july, changedAugust], mismatchExisting), HistoricalMismatchError);
});

test('fixture CLI is idempotent, reads official announcement files, and writes both LPR series', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'macrolens-lpr-'));
  const target = path.join(directory, 'lpr.json');
  const copiedFixtures = path.join(directory, 'fixtures');
  fs.mkdirSync(copiedFixtures);
  fs.writeFileSync(target, `${JSON.stringify(existing, null, 2)}\n`);
  for (const name of ['publication-index.html', 'lpr-2026-07.html', 'lpr-2026-08.html']) {
    fs.copyFileSync(path.join(fixtureDir, name), path.join(copiedFixtures, name));
  }
  await runLpr(['--fixture-dir', copiedFixtures, '--target', target]);
  const first = fs.readFileSync(target, 'utf8');
  assert.equal(JSON.parse(first).series.length, 2);
  await runLpr(['--fixture-dir', copiedFixtures, '--target', target]);
  assert.equal(fs.readFileSync(target, 'utf8'), first);
  fs.writeFileSync(path.join(copiedFixtures, 'lpr-2026-08.html'), augustHtml.replace('5年期以上LPR为3.50%', '5年期以上LPR为3.40%'));
  await assert.rejects(() => runLpr(['--fixture-dir', copiedFixtures, '--target', target]), HistoricalMismatchError);
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
  assert.equal(dataset.source, 'PBOC');
  assert.ok(dataset.sources.every(({ url }) => url.startsWith('https://www.pbc.gov.cn/')));
  const chart = fs.readFileSync(path.join(here, '..', 'src', 'components', 'IndicatorChart.astro'), 'utf8');
  const workflow = fs.readFileSync(path.join(here, '..', '.github', 'workflows', 'update-macro-data.yml'), 'utf8');
  const page = fs.readFileSync(path.join(here, '..', 'src', 'content', 'concepts', 'lpr.md'), 'utf8');
  const adapter = fs.readFileSync(path.join(here, '..', 'src', 'data', 'indicatorPresentationAdapter.ts'), 'utf8');
  const fetchSource = fs.readFileSync(path.join(here, '..', 'scripts', 'ingest', 'fetch', 'lpr.ts'), 'utf8');
  assert.match(chart, /indicator\.series/);
  assert.match(chart, /legend/);
  assert.match(workflow, /npm run ingest:lpr/);
  assert.match(workflow, /data\/indicators\/lpr\.json/);
  assert.match(page, /^chart: lpr$/m);
  assert.match(adapter, /率水平按数据集公布/);
  assert.doesNotMatch(adapter, /月度 LPR/);
  assert.doesNotMatch(fetchSource, /chinamoney\.com\.cn/);
});
