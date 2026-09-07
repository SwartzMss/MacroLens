import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  POLICY_RATE_ARCHIVES, discoverPolicyRatePublications, nextPolicyRateArchivePage,
  parsePolicyRatePublication, NonPolicyRatePublication, validateOfficialPolicyRateUrl,
} from '../scripts/ingest/fetch/policy-rate.ts';
import { combinePolicyRatePublications, normalizePolicyRateDataset } from '../scripts/ingest/normalize/policy-rate.ts';
import { validatePolicyRateDataset, validateEventObservations } from '../scripts/ingest/validate/policy-rate.ts';
import { POLICY_RATE_BASELINE, readPolicyRateArchive, runPolicyRate } from '../scripts/ingest/policy-rate-cli.ts';
import { HistoricalMismatchError } from '../scripts/ingest/types.ts';
import { getIndicatorData } from '../src/data/indicatorRegistry.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixtureDir = path.join(root, 'tests/fixtures/pboc/policy-rate');
const publications = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'publications.json'), 'utf8'));
const pub = id => publications.find(item => item.url.split('/').at(-2) === id);
const html = id => fs.readFileSync(path.join(fixtureDir, `${id}.html`), 'utf8');
const parsed = id => parsePolicyRatePublication(pub(id), html(id));
const historicalIds = ['5409133', '5409998', '5468922', '5699842', '2026090108544487779'];
const history = () => combinePolicyRatePublications(historicalIds.map(parsed));
const canonical = () => normalizePolicyRateDataset(history(), POLICY_RATE_BASELINE);
const indexHtml = items => `<a href="/">Navigation</a>${items.map(item => `<font><a title="${item.title}" href="${item.url}">${item.title}</a></font><span>${item.sourceDate}</span>`).join('\n')}`;

test('extracts exact 7-day rates by named columns, including mixed MLF and overnight tables', () => {
  for (const [id, value] of [['5409133', 1.8], ['5410037', 1.7], ['5413256', 1.7], ['5701904', 1.4], ['2026082709072028572', 1.4]]) {
    assert.equal(parsed(id).value, value);
    assert.equal(parsed(id).date, pub(id).sourceDate);
  }
  const unchanged = parsed('2026090108544487779');
  assert.equal(unchanged.value, 1.4);
  assert.equal(unchanged.kind, 'operation');
});

test('preserves real effective dates, separately from publication dates', () => {
  assert.deepEqual(historicalIds.slice(1, 4).map(id => {
    const item = parsed(id);
    return [item.date, item.value, item.previousValue, item.publication.sourceDate];
  }), [
    ['2024-07-22', 1.7, 1.8, '2024-07-22'],
    ['2024-09-27', 1.5, 1.7, '2024-09-27'],
    ['2025-05-08', 1.4, 1.5, '2025-05-07'],
  ]);
  assert.throws(() => parsed('5468962'), NonPolicyRatePublication); // Only 14-day operations on the change day.
});

test('rejects other instruments, wrong tenors and zero operations without inventing a rate', () => {
  for (const id of ['5468962', '5425164', '2026090408480534617', '2026082511570951777', '5444387', '2026061709231276552']) {
    assert.throws(() => parsed(id), NonPolicyRatePublication);
  }
  assert.throws(() => parsePolicyRatePublication(pub('5410037'), html('5410037').replaceAll('逆回购', '正回购')), /instrument/);
  assert.throws(() => parsePolicyRatePublication(pub('5410037'), html('5410037').replace('>7</span>', '>17</span>')), /tenor/);
});

test('validates exact official origin, publication URL, identity and calendar dates', () => {
  for (const url of ['https://pbc.gov.cn.evil.test/x', 'https://evil.test/www.pbc.gov.cn/', 'http://www.pbc.gov.cn/x', `${pub('5410037').url}?redirect=x`, 'https://user@www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/x']) {
    assert.throws(() => validateOfficialPolicyRateUrl(url));
  }
  const item = pub('5410037'), source = html('5410037');
  assert.throws(() => parsePolicyRatePublication({ ...item, url: pub('5409133').url }, source), /identity/);
  assert.throws(() => parsePolicyRatePublication({ ...item, title: 'LPR' }, source), /title/);
  assert.throws(() => parsePolicyRatePublication({ ...item, sourceDate: '2024-02-30' }, source), /date/);
  assert.throws(() => parsePolicyRatePublication(item, source.replace('2024-07-22', '2024-07-23')), /identity/);
  assert.throws(() => parsePolicyRatePublication(item, source.replace('2024年7月22日', '2024年7月23日')), /operation date/);
  assert.throws(() => parsePolicyRatePublication(item, source.replace('中国人民银行公开市场业务操作室', 'Other publisher')), /signature/);
  assert.throws(() => parsePolicyRatePublication(pub('5699842'), html('5699842').replace('2025年5月8日', '2025年2月30日')), /date/);
});

test('fails closed on missing, duplicate, malformed and ambiguously scoped rates', () => {
  const item = pub('5410037'), source = html('5410037');
  for (const replacement of ['待定%', '1.7.0%', '-1.7%', 'NaN%', '170%', '1.70']) {
    assert.throws(() => parsePolicyRatePublication(item, source.replace('1.70%', replacement)), /rate/);
  }
  assert.throws(() => parsePolicyRatePublication(item, source.replace('利率</span>', '收益率</span>')), /rate column/);
  assert.throws(() => parsePolicyRatePublication(item, source.replace('逆回购操作情况', 'MLF操作情况')), /instrument/);
  const table = source.match(/<table\b[^>]*>[\s\S]*?<\/table>/)[0];
  assert.throws(() => parsePolicyRatePublication(item, source.replace('</table>', `</table><p>逆回购操作情况</p>${table}`)), /Duplicate/);
  const decision = html('5699842');
  assert.throws(() => parsePolicyRatePublication(pub('5699842'), decision.replace('调整为1.40%', '调整为待定%')), /rate/);
  assert.throws(() => parsePolicyRatePublication(pub('5699842'), decision.replace('从2025年5月8日起', '未来起')), /malformed/);
});

test('rejects duplicate dates/conflicts while explicitly corroborating a decision with its operation', () => {
  const operation = parsed('5410037'), decision = parsed('5409998');
  assert.deepEqual(combinePolicyRatePublications([operation, decision]), [decision]);
  assert.throws(() => combinePolicyRatePublications([operation, { ...decision, value: 1.6 }]), HistoricalMismatchError);
  assert.throws(() => combinePolicyRatePublications([operation, operation]), /duplicate/);
  assert.throws(() => combinePolicyRatePublications([operation, { ...operation, publication: pub('5413256') }]), /Duplicate.*date/);
  assert.throws(() => normalizePolicyRateDataset(history().reverse(), POLICY_RATE_BASELINE), /chronologically/);
  assert.throws(() => validateEventObservations([{ date: '2025-05-08', value: 1.4 }, { date: '2025-05-08', value: 1.4 }]), /unique/);
});

test('protects every recorded event and unchanged historical overlap, including source identity', () => {
  const existing = canonical();
  assert.deepEqual(normalizePolicyRateDataset(history(), existing), existing);
  assert.throws(() => normalizePolicyRateDataset(history().filter(item => item.date !== '2024-09-27'), existing), HistoricalMismatchError);
  for (const patch of [{ value: 1.6 }, { date: '2024-09-28' }, { previousValue: 1.6 }]) {
    const changed = history().map(item => item.date === '2024-09-27' ? { ...item, ...patch } : item);
    assert.throws(() => normalizePolicyRateDataset(changed, existing), HistoricalMismatchError);
  }
  const changedSource = history().map(item => item.date === '2025-05-08' ? { ...item, publication: { ...item.publication, sourceDate: '2025-05-06' } } : item);
  assert.throws(() => normalizePolicyRateDataset(changedSource, existing), HistoricalMismatchError);
  const unexpectedHistorical = { ...parsed('5413256'), value: 1.6 };
  assert.throws(() => normalizePolicyRateDataset(combinePolicyRatePublications([...history(), unexpectedHistorical]), existing), HistoricalMismatchError);
});

test('canonical history contains only baseline and real changes with exact official provenance', () => {
  const dataset = getIndicatorData('policy-rate');
  const fixtureHistory = canonical();
  validatePolicyRateDataset(dataset);
  assert.deepEqual(dataset.data, fixtureHistory.data);
  assert.deepEqual(dataset.sources.slice(0, fixtureHistory.sources.length - 1), fixtureHistory.sources.slice(0, -1));
  assert.deepEqual(dataset.data, [
    { date: '2024-07-19', value: 1.8 }, { date: '2024-07-22', value: 1.7 },
    { date: '2024-09-27', value: 1.5 }, { date: '2025-05-08', value: 1.4 },
  ]);
  assert.ok(dataset.verifiedThrough >= fixtureHistory.verifiedThrough);
  assert.equal(dataset.updatedAt, dataset.sources.at(-1).sourceDate);
  assert.equal(dataset.sources.at(-1).coverage, `${dataset.verifiedThrough} to ${dataset.verifiedThrough}`);
  assert.match(dataset.sources.at(-1).url, new RegExp(dataset.verifiedThrough.replaceAll('-', '')));
  assert.equal(dataset.methodologyEffectiveFrom, '2024-07-22');
  assert.match(dataset.comparabilityNote, /并非首次执行/);
  assert.match(dataset.comparabilityNote, /LPR、DR007、R007/);
  assert.throws(() => validatePolicyRateDataset({ ...dataset, data: [...dataset.data, { date: dataset.verifiedThrough, value: 1.4 }] }), /synthetic/);
});

test('new unchanged-rate confirmations update provenance without adding events', () => {
  const before = normalizePolicyRateDataset(history().slice(0, -1), POLICY_RATE_BASELINE);
  const after = normalizePolicyRateDataset(history(), before);
  assert.deepEqual(after.data, before.data);
  assert.equal(after.verifiedThrough, '2026-09-01');
  assert.equal(after.updatedAt, '2026-09-01');
  assert.equal(after.sources.length, before.sources.length + 1);
  assert.equal(JSON.stringify(normalizePolicyRateDataset(history(), after)), JSON.stringify(after));
});

test('discovers all archive entries, follows pagination, and rejects gaps or archive regression', async () => {
  const first = pub('2026090408480534617');
  const second = { ...pub('2026090108544487779'), sourceDate: '2026-09-03', title: '公开市场业务交易公告 [2026]第172号' };
  const older = { ...pub('5410037'), sourceDate: '2026-08-31', title: '公开市场业务交易公告 [2026]第169号' };
  const next = POLICY_RATE_ARCHIVES[1].replace('index.html', '17081-2.html');
  const page = `${indexHtml([first])}<a tagname="${next}">下一页</a>`;
  assert.deepEqual(discoverPolicyRatePublications(page, POLICY_RATE_ARCHIVES[1]), [first]);
  assert.equal(nextPolicyRateArchivePage(page, POLICY_RATE_ARCHIVES[1]), next);
  assert.deepEqual(await readPolicyRateArchive(POLICY_RATE_ARCHIVES[1], '2026-09-03', async url => url === next ? indexHtml([second, older]) : page), [second, first]);
  await assert.rejects(() => readPolicyRateArchive(POLICY_RATE_ARCHIVES[1], '2026-09-01', async () => indexHtml([first, pub('2026090108544487779'), older])), /numbered/);
  await assert.rejects(() => readPolicyRateArchive(POLICY_RATE_ARCHIVES[1], '2026-09-01', async () => indexHtml([first])), /overlap/);
  assert.throws(() => discoverPolicyRatePublications(indexHtml([second, first]), POLICY_RATE_ARCHIVES[1]), /chronologically/);
  assert.throws(() => discoverPolicyRatePublications(indexHtml([first, first]), POLICY_RATE_ARCHIVES[1]), /Duplicate/);
  assert.throws(() => discoverPolicyRatePublications(indexHtml([first]).replace('<span>2026-09-04', '<span>missing-date'), POLICY_RATE_ARCHIVES[1]), /identity\/date/);
});

test('CLI re-fetches provenance, is byte-idempotent on unchanged and zero operations, and writes nothing on failure', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'macrolens-policy-rate-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const target = path.join(directory, 'policy-rate.json');
  const dataset = canonical();
  fs.writeFileSync(target, `${JSON.stringify(dataset, null, 2)}\n`);
  const business = [pub('5699842'), pub('5468922'), pub('5409998')];
  const olderBusiness = { ...pub('5409998'), sourceDate: '2024-07-08', title: '公开市场业务公告 ［2024］第3号', url: pub('5409998').url.replace('5409998', '5392190') };
  const olderOperation = { ...pub('2026090108544487779'), sourceDate: '2026-08-31', title: '公开市场业务交易公告 [2026]第169号', url: pub('2026090108544487779').url.replace('2026090108544487779', '2026083108481886588') };
  const unchangedHtml = html('2026090108544487779');
  let corrupt = false;
  const requests = [];
  const read = async url => {
    requests.push(url);
    if (url === POLICY_RATE_ARCHIVES[0]) return indexHtml([...business, olderBusiness]);
    if (url === POLICY_RATE_ARCHIVES[1]) return indexHtml([
      pub('2026090408480534617'), pub('2026090308483817494'), pub('2026090208530223391'),
      pub('2026090108544487779'), olderOperation,
    ]);
    const id = url.split('/').at(-2);
    if (id === '2026090108544487779') return corrupt ? unchangedHtml.replace('>40</span>', '>30</span>') : unchangedHtml;
    return html(id);
  };
  const before = fs.readFileSync(target, 'utf8');
  await runPolicyRate(['--target', target, '--as-of', '2026-09-07'], read);
  await runPolicyRate(['--target', target, '--as-of', '2026-10-07'], read);
  assert.equal(fs.readFileSync(target, 'utf8'), before);
  for (const source of dataset.sources) assert.ok(requests.includes(source.url));
  corrupt = true;
  await assert.rejects(() => runPolicyRate(['--target', target], read), HistoricalMismatchError);
  assert.equal(fs.readFileSync(target, 'utf8'), before);
  await assert.rejects(() => runPolicyRate(['--target', target, '--bootstrap'], read), /refusing/);
});

test('registry, concept and reviewable scheduled workflow reuse the canonical policy-rate node', () => {
  assert.equal(getIndicatorData('policy-rate').id, 'policy-rate');
  const page = fs.readFileSync(path.join(root, 'src/content/concepts/policy-rate.md'), 'utf8');
  assert.match(page, /^chart: policy-rate$/m);
  assert.match(page, /^id: policy-rate$/m);
  assert.match(page, /MLF 的角色如何变化/);
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/update-macro-data.yml'), 'utf8');
  assert.match(workflow, /npm run ingest:policy-rate -- --target data\/indicators\/policy-rate.json/);
  assert.match(workflow, /add-paths:[\s\S]*data\/indicators\/policy-rate.json/);
  assert.match(workflow, /peter-evans\/create-pull-request/);
});
