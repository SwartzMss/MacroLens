import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  discoverPBOCFinancialStatisticsPublications,
  discoverPBOCCreditPublications,
  discoverPBOCSocialFinancingPublications,
  parsePBOCCreditReport,
  parsePBOCSocialFinancingReport,
} from '../scripts/ingest/fetch/pboc-credit-social-financing.ts';
import { normalizePBOCFinancialDataset } from '../scripts/ingest/normalize/pboc-credit-social-financing.ts';
import { validatePBOCFinancialDataset } from '../scripts/ingest/validate/pboc-credit-social-financing.ts';
import { runPBOCFinancial } from '../scripts/ingest/pboc-financial-cli.ts';
import { getIndicatorData } from '../src/data/indicatorRegistry.ts';
import {
  HistoricalMismatchError,
  IngestionContractError,
  MethodologyMismatchError,
  PBOC_FINANCIAL_METHODOLOGY_FINGERPRINTS,
} from '../scripts/ingest/types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

const indexHtml = `<!doctype html><html><body>
  <a href="/diaochatongjisi/116219/116225/2025121217132789688/index.html">2025年11月金融统计数据报告</a><span>2025-12-12</span>
  <a href="/diaochatongjisi/116219/116225/2025121216000000004/index.html">2025年11月社会融资规模存量统计数据报告</a><span>2025-12-12</span>
  <a href="/diaochatongjisi/116219/116225/2026011516000000004/index.html">2025年12月社会融资规模存量统计数据报告</a><span>2026-01-15</span>
  <a href="/diaochatongtongjisi/ignored.html">不是目标报告</a><span>2026-01-01</span>
</body></html>`;

const moneyPublication = {
  title: '2025年11月金融统计数据报告',
  url: 'https://www.pbc.gov.cn/diaochatongjisi/116219/116225/2025121217132789688/index.html',
  sourceDate: '2025-12-12',
  month: '2025-11',
};

const socialPublication = {
  title: '2025年11月社会融资规模存量统计数据报告',
  url: 'https://www.pbc.gov.cn/diaochatongjisi/116219/116225/2025121216000000004/index.html',
  sourceDate: '2025-12-12',
  month: '2025-11',
};

const creditHtml = `<html><body><h2>${moneyPublication.title}</h2><p>文章来源：2025-12-12 17:00:01</p><p>金融机构人民币各项贷款余额为271万亿元，同比增长6.4%。</p><p>修订后的M1包括：流通中货币（M0）、单位活期存款、个人活期存款、非银行支付机构客户备付金。</p></body></html>`;
const socialHtml = `<html><body><h2>${socialPublication.title}</h2><p>文章来源：2025-12-12 16:00:00</p><p>11月末，社会融资规模存量为440.07万亿元，同比增长8.5%。</p></body></html>`;

function datasetBeforeNovember(id) {
  const historicalValues = id === 'credit'
    ? [10.4, 10.1, 9.6, 9.6, 9.3, 8.8, 8.7, 8.5, 8.1, 8.0, 7.7, 7.6, 7.5, 7.3, 7.4, 7.2, 7.1, 7.1, 6.9, 6.8, 6.6, 6.5]
    : [9.5, 9.0, 8.7, 8.3, 8.4, 8.1, 8.2, 8.1, 8.0, 7.8, 7.8, 8.0, 8.0, 8.2, 8.4, 8.7, 8.7, 8.9, 9.0, 8.8, 8.7, 8.5];
  return {
    id,
    country: 'CN',
    frequency: 'monthly',
    unit: '%',
    metric: 'yoy',
    label: id === 'credit' ? '人民币贷款余额同比' : '社会融资规模存量同比',
    chartTitle: id === 'credit' ? '金融机构人民币各项贷款余额同比增速' : '社会融资规模存量同比增速',
    source: 'PBOC',
    calculation: 'published',
    ...(id === 'credit' ? { calculationEffectiveFrom: '2025-12' } : {}),
    updatedAt: '2025-12-15',
    comparabilityNote: id === 'credit'
      ? '2025-11 及以前同比增速由官方余额计算；自 2025-12 起采用央行官方公布值；统计口径或覆盖范围变化时停止自动合并并更新可比性说明。'
      : '官方公布同比增速；统计口径或覆盖范围变化时停止自动合并并更新可比性说明。',
    methodologyFingerprint: PBOC_FINANCIAL_METHODOLOGY_FINGERPRINTS[id],
    sources: [{
      title: '中国人民银行官方统计表',
      url: id === 'credit'
        ? 'https://www.pbc.gov.cn/diaochatongjisi/attachDir/2025/11/2025111817163388840.htm'
        : 'https://www.pbc.gov.cn/diaochatongjisi/attachDir/2025/12/2025121517152654772.pdf',
      sourceDate: id === 'credit' ? '2025-11-18' : '2025-12-15',
      coverage: id === 'credit' ? '2023-01 to 2023-12' : '2024-01 to 2025-11',
      ...(id === 'credit' ? { role: 'methodology' } : {}),
    }, ...(id === 'credit' ? [{
      title: '中国人民银行官方统计表（2024-2025）',
      url: 'https://www.pbc.gov.cn/diaochatongjisi/attachDir/2025/12/2025121517273312027.pdf',
      sourceDate: '2025-12-15',
      coverage: '2024-01 to 2025-11',
    }] : [])],
    data: historicalValues.map((value, index) => {
      const year = 2024 + Math.floor(index / 12);
      const month = String((index % 12) + 1).padStart(2, '0');
      return { date: `${year}-${month}`, value };
    }),
  };
}

test('shares official PBOC publication discovery across money, credit, and social-financing reports', () => {
  const all = discoverPBOCFinancialStatisticsPublications(indexHtml);
  assert.deepEqual(all.map(({ kind, month }) => `${kind}:${month}`), [
    'money-supply:2025-11', 'social-financing:2025-11', 'social-financing:2025-12',
  ]);
  assert.equal(discoverPBOCCreditPublications(indexHtml).length, 1);
  assert.deepEqual(discoverPBOCSocialFinancingPublications(indexHtml).map(({ month }) => month), ['2025-11', '2025-12']);
});

test('parses the exact broad RMB-loan balance YoY and social-financing stock YoY fields', () => {
  const credit = parsePBOCCreditReport(moneyPublication, creditHtml);
  const social = parsePBOCSocialFinancingReport(socialPublication, socialHtml);
  assert.equal(credit.values.credit, 6.4);
  assert.equal(credit.creditBalance, 271);
  assert.equal(parsePBOCCreditReport(moneyPublication, creditHtml.replace('271万亿元', '2710000亿元')).creditBalance, 271);
  assert.throws(() => parsePBOCCreditReport(moneyPublication, creditHtml.replace('271万亿元', '待定万亿元')), /balance/);
  assert.equal(social.values['social-financing'], 8.5);
  assert.equal(credit.methodologyFingerprints.credit, PBOC_FINANCIAL_METHODOLOGY_FINGERPRINTS.credit);
  assert.equal(social.methodologyFingerprints['social-financing'], PBOC_FINANCIAL_METHODOLOGY_FINGERPRINTS['social-financing']);
});

test('parses credit and social-financing from the same official financial-statistics report', () => {
  const julyPublication = {
    title: '2026年7月金融统计数据报告',
    url: 'https://www.pbc.gov.cn/diaochatongjisi/116219/116225/2026081416320925645/index.html',
    sourceDate: '2026-08-14',
    month: '2026-07',
  };
  const report = fs.readFileSync(path.join(here, 'fixtures', 'pboc', 'report-2026-07.html'), 'utf8');
  assert.equal(parsePBOCCreditReport(julyPublication, report).values.credit, 5.1);
  assert.equal(parsePBOCSocialFinancingReport(julyPublication, report).values['social-financing'], 7.4);
});

test('rejects narrower, missing, duplicate, malformed, and methodology-changed fields', () => {
  assert.throws(() => parsePBOCCreditReport(moneyPublication, creditHtml.replace('金融机构人民币各项贷款', '对实体经济发放的人民币贷款')), /credit|贷款|Missing/i);
  assert.throws(() => parsePBOCSocialFinancingReport(socialPublication, socialHtml.replace('同比增长8.5%', '同比增长待定%')), /numeric|数值/i);
  assert.throws(() => parsePBOCSocialFinancingReport(socialPublication, `${socialHtml}<p>社会融资规模存量为440.07万亿元，同比增长8.5%。</p>`), /duplicate|重复|social/i);
  assert.throws(() => parsePBOCCreditReport(moneyPublication, creditHtml.replace('金融机构人民币各项贷款余额', '金融机构人民币各项贷款余额（含其他范围）')), MethodologyMismatchError);
  assert.throws(() => parsePBOCCreditReport({ ...moneyPublication, month: '2025-12' }, creditHtml), /month|月份/i);
  assert.throws(() => parsePBOCSocialFinancingReport(socialPublication, socialHtml.replace('2025年11月社会融资规模存量统计数据报告', '2025年12月社会融资规模存量统计数据报告')), /title|标题|month|月份/i);
});

test('normalizes both datasets with continuity, official provenance, and overlap protection', () => {
  const creditExisting = datasetBeforeNovember('credit');
  const socialExisting = datasetBeforeNovember('social-financing');
  const creditRaw = parsePBOCCreditReport(moneyPublication, creditHtml);
  const socialRaw = parsePBOCSocialFinancingReport(socialPublication, socialHtml);
  const credit = normalizePBOCFinancialDataset([creditRaw], creditExisting, 'credit');
  const social = normalizePBOCFinancialDataset([socialRaw], socialExisting, 'social-financing');
  assert.deepEqual(credit.data.at(-1), { date: '2025-11', value: 6.4 });
  assert.deepEqual(credit.balance.data.at(-1), { date: '2025-11', value: 271 });
  assert.throws(() => normalizePBOCFinancialDataset([{ ...creditRaw, creditBalance: 272 }], credit, 'credit'), HistoricalMismatchError);
  assert.deepEqual(social.data.at(-1), { date: '2025-11', value: 8.5 });
  assert.equal(credit.sources.some(({ role, coverage }) => role === 'methodology' && coverage === '2023-01 to 2023-12'), true);
  assert.doesNotThrow(() => validatePBOCFinancialDataset(credit, 'credit'));
  assert.doesNotThrow(() => validatePBOCFinancialDataset(social, 'social-financing'));
  const creditExistingThroughNovember = {
    ...creditExisting,
    updatedAt: '2025-12-12',
    sources: [...creditExisting.sources, {
      title: '中国人民银行：2025年11月金融统计数据报告',
      url: moneyPublication.url,
      sourceDate: moneyPublication.sourceDate,
      coverage: '2025-11 to 2025-11',
    }],
    data: [...creditExisting.data, { date: '2025-11', value: 6.3 }],
  };
  assert.throws(() => normalizePBOCFinancialDataset([{ ...creditRaw, values: { credit: 6.4 } }], creditExistingThroughNovember, 'credit'), HistoricalMismatchError);
  assert.throws(() => normalizePBOCFinancialDataset([{ ...creditRaw, publication: { ...creditRaw.publication, month: '2025-12' } }], creditExisting, 'credit'), IngestionContractError);
});

test('fixture CLI is idempotent and validates both targets before writing', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'macrolens-pboc-financial-'));
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'macrolens-pboc-financial-fixtures-'));
  fs.writeFileSync(path.join(fixtureDir, 'publication-index.html'), indexHtml);
  fs.writeFileSync(path.join(fixtureDir, 'report-2025-11.html'), creditHtml);
  fs.writeFileSync(path.join(fixtureDir, 'social-financing-2025-11.html'), socialHtml);
  for (const id of ['credit', 'social-financing']) fs.writeFileSync(path.join(directory, `${id}.json`), `${JSON.stringify(datasetBeforeNovember(id), null, 2)}\n`);
  const args = ['--fixture-index', path.join(fixtureDir, 'publication-index.html'), '--fixture-dir', fixtureDir, '--target-dir', directory];
  await runPBOCFinancial(args);
  const first = new Map(['credit', 'social-financing'].map((id) => [id, fs.readFileSync(path.join(directory, `${id}.json`), 'utf8')]));
  assert.equal(JSON.parse(first.get('credit')).data.at(-1).date, '2025-11');
  assert.equal(JSON.parse(first.get('social-financing')).data.at(-1).date, '2025-11');
  await runPBOCFinancial(args);
  for (const id of ['credit', 'social-financing']) assert.equal(fs.readFileSync(path.join(directory, `${id}.json`), 'utf8'), first.get(id));
  fs.writeFileSync(path.join(fixtureDir, 'social-financing-2025-11.html'), socialHtml.replace('同比增长8.5%', '同比增长1.1%'));
  await assert.rejects(() => runPBOCFinancial(args), HistoricalMismatchError);
  for (const id of ['credit', 'social-financing']) assert.equal(fs.readFileSync(path.join(directory, `${id}.json`), 'utf8'), first.get(id));
});

test('registers both datasets, charts both concept pages, and tracks both workflow paths', () => {
  assert.equal(getIndicatorData('credit').id, 'credit');
  assert.equal(getIndicatorData('social-financing').id, 'social-financing');
  const creditPage = fs.readFileSync(path.join(here, '..', 'src', 'content', 'concepts', 'credit.md'), 'utf8');
  const socialPage = fs.readFileSync(path.join(here, '..', 'src', 'content', 'concepts', 'social-financing.md'), 'utf8');
  const workflow = fs.readFileSync(path.join(here, '..', '.github', 'workflows', 'update-macro-data.yml'), 'utf8');
  assert.match(creditPage, /^chart: credit$/m);
  assert.match(socialPage, /^chart: social-financing$/m);
  assert.match(workflow, /npm run ingest:pboc-financial/);
  assert.match(workflow, /data\/indicators\/credit\.json/);
  assert.match(workflow, /data\/indicators\/social-financing\.json/);
});

test('checked-in financial datasets use the official integrated report values and provenance', () => {
  const credit = getIndicatorData('credit');
  const social = getIndicatorData('social-financing');
  assert.deepEqual(credit.data.at(-1), { date: '2026-07', value: 5.1 });
  assert.deepEqual(social.data.at(-1), { date: '2026-07', value: 7.4 });
  assert.equal(credit.data.find(({ date }) => date === '2024-04')?.value, 9.6);
  assert.equal(credit.calculation, 'published');
  assert.equal(credit.calculationEffectiveFrom, '2025-12');
  assert.equal(credit.methodologyFingerprint, 'pboc-credit|financial-institutions-rmb-loans|month-end-balance-yoy');
  assert.equal(credit.sources.some(({ coverage, url }) => coverage === '2023-01 to 2023-12' && url.includes('2025111817163388840')), true);
  assert.equal(social.data.find(({ date }) => date === '2024-01')?.value, 9.5);
  assert.match(credit.sources.at(-1).url, /2026081416320925645/);
  assert.equal(social.sources.at(-1).url, credit.sources.at(-1).url);
  assert.equal(social.sources.some(({ url }) => url.includes('16000000004')), false);
});
