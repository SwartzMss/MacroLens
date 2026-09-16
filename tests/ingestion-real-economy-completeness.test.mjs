import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { completeNbsRealEconomyRelease, compactRealEconomyCoverage } from '../scripts/ingest/fetch/nbs-real-economy.ts';
import { normalizeRealEconomyDataset } from '../scripts/ingest/normalize/real-economy.ts';
import { REAL_ECONOMY_METHODOLOGY_FINGERPRINTS } from '../scripts/ingest/types.ts';
const cases = [
  ['industrial-production', '2026年8月份规模以上工业增加值增长5.2%', '8月份，规模以上工业增加值同比实际增长5.2%（扣除价格因素）。1—8月份，规模以上工业增加值同比增长5.3%。', 5.2],
  ['retail-sales', '2026年1—8月份社会消费品零售总额增长1.1%', '1—8月份，社会消费品零售总额327569亿元，同比增长1.1%。8月份，社会消费品零售总额39824亿元，同比增长0.4%。注：未扣除价格因素的名义增速。', 0.4],
  ['fixed-asset-investment', '2026年1—8月份全国固定资产投资基本情况', '1—8月份，全国固定资产投资（不含农户）293092亿元，同比下降7.2%（按可比口径计算）。8月份固定资产投资（不含农户）环比下降0.5%。', -7.2],
];
function setup([id,title,body,value]) {
 const existing=JSON.parse(fs.readFileSync(new URL(`../data/indicators/${id}.json`,import.meta.url)));
 // Pin the fixture window so monthly automated updates cannot change the test setup.
 existing.data = existing.data.filter(point => Number(point.date.slice(0, 4)) < 2026 || (point.date.startsWith('2026-') && Number(point.date.slice(-2)) <= 7));
 existing.updatedAt = '2026-08-17';
 existing.sources = [{ title: '国家统计局：测试历史序列', url: 'https://data.stats.gov.cn/test-history', sourceDate: '2026-08-17', role: 'data', coverage: compactRealEconomyCoverage(existing.data.map(point => point.date), id) }];
 const date=id==='fixed-asset-investment'?'2026-01–08':'2026-08';
 const publication={title,url:'https://www.stats.gov.cn/sj/zxfb/202609/report.html',sourceDate:'2026-09-15',coverage:`${date} to ${date}`};
 const raw={id,publication,seriesCode:'test',seriesTitle:existing.title,unit:'%',frequency:'monthly',methodologyFingerprint:REAL_ECONOMY_METHODOLOGY_FINGERPRINTS[id],observations:structuredClone(existing.data),dataSources:existing.sources.filter(s=>s.role==='data').map(s=>({...s,sourceDate:publication.sourceDate}))};
 return {existing,raw,html:`<h1>${title}</h1><p>${body}</p>`,date,value};
}
for(const entry of cases) {
 test(`${entry[0]} supplements the correct published period with independent provenance`,()=>{
  const {raw,html,date,value,existing}=setup(entry);
  const result=completeNbsRealEconomyRelease(raw,html);
  assert.deepEqual(result.observations.at(-1),{date,value});
  assert.equal(result.dataSources.at(-1).url,raw.publication.url);
  assert.equal(result.dataSources.at(-1).coverage,`${date} to ${date}`);
  const normalized=normalizeRealEconomyDataset(result,existing,raw.id);
  for(const source of existing.sources.filter(s=>s.role==='data')) {
   assert.equal(normalized.sources.find(s=>s.url===source.url)?.sourceDate,source.sourceDate);
  }
  assert.equal(normalized.updatedAt,'2026-09-15');
  assert.deepEqual(normalizeRealEconomyDataset(result,normalized,raw.id),normalized);
 });
 test(`${entry[0]} refuses stale data, gaps, wrong publication identity and conflicts`,()=>{
  const {raw,html}=setup(entry);
  assert.throws(()=>completeNbsRealEconomyRelease(raw,''),/release|period/i);
  assert.throws(()=>completeNbsRealEconomyRelease(raw,html.replaceAll('8月份','9月份')),/release|period/i);
  const gap=structuredClone(raw);gap.observations.pop();
  assert.throws(()=>completeNbsRealEconomyRelease(gap,html),/period|adjacent/i);
  const bad=structuredClone(raw);bad.publication.url='https://example.com/report';
  assert.throws(()=>completeNbsRealEconomyRelease(bad,html),/official|identity/i);
  const complete=completeNbsRealEconomyRelease(raw,html);
  assert.doesNotThrow(()=>completeNbsRealEconomyRelease(complete,html));
  complete.observations.at(-1).value+=1;
  assert.throws(()=>completeNbsRealEconomyRelease(complete,html),/conflict/i);
 });
}

for (const entry of cases) {
 test(`${entry[0]} handles the year boundary without inventing a January observation`, () => {
  const {raw} = setup(entry);
  raw.observations = [{date: raw.id === 'fixed-asset-investment' ? '2026-01–12' : '2026-12', value: 1}];
  const title = raw.id === 'industrial-production' ? '2027年1—2月份规模以上工业增加值增长0.0%'
    : raw.id === 'retail-sales' ? '2027年1—2月份社会消费品零售总额增长0.0%' : '2027年1—2月份全国固定资产投资基本情况';
  raw.publication = { ...raw.publication, title, sourceDate: '2027-03-15', coverage: '2027-01–02 to 2027-01–02' };
  const body = raw.id === 'industrial-production' ? '1—2月份，规模以上工业增加值同比持平。扣除价格因素。'
    : raw.id === 'retail-sales' ? '1—2月份，社会消费品零售总额100亿元，同比持平。名义增速。'
    : '1—2月份，全国固定资产投资（不含农户）100亿元，同比持平。可比口径。';
  const result = completeNbsRealEconomyRelease(raw, `<h1>${title}</h1><p>${body}</p>`);
  assert.deepEqual(result.observations.at(-1), {date: '2027-01–02', value: 0});
  assert.equal(result.observations.length, 2);
 });
}

test('does not substitute cumulative retail growth or month-on-month industrial growth', () => {
 const retail = setup(cases[1]);
 assert.throws(() => completeNbsRealEconomyRelease(retail.raw, retail.html.replace('8月份，社会消费品零售总额39824亿元，同比增长0.4%。','')), /no verified value/);
 const industrial = setup(cases[0]);
 assert.throws(() => completeNbsRealEconomyRelease(industrial.raw, industrial.html.replace('同比实际增长5.2%', '环比增长5.2%')), /no verified value/);
 const investment = setup(cases[2]);
 assert.throws(() => completeNbsRealEconomyRelease(investment.raw, investment.html.replace('全国固定资产投资（不含农户）', '民间固定资产投资（不含农户）')), /no verified value/);
});

test('accepts explicit matching years and the official annual investment wording', () => {
 const { raw } = setup(cases[2]);
 raw.observations = [{ date: '2025-01–11', value: -2.6 }];
 raw.publication = {...raw.publication, title: '2025年全国固定资产投资基本情况', sourceDate: '2026-01-19', coverage: '2025-01–12 to 2025-01–12'};
 const html = `<h1>${raw.publication.title}</h1><p>2025年，全国固定资产投资（不含农户）485186亿元，比上年下降3.8%（按可比口径计算）。</p>`;
 assert.deepEqual(completeNbsRealEconomyRelease(raw, html).observations.at(-1), {date: '2025-01–12', value: -3.8});
 for(const entry of cases) {
  const {raw,html,date,value}=setup(entry);
  const explicit=html.replace(/([>。])(1—8月份，|8月份，)/g,'$12026年$2');
  assert.deepEqual(completeNbsRealEconomyRelease(raw,explicit).observations.at(-1),{date,value});
  const wrong=html.replace(/([>。])(1—8月份，|8月份，)/g,'$12025年$2');
  assert.throws(()=>completeNbsRealEconomyRelease(raw,wrong),/no verified value/);
 }
});
