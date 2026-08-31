import assert from 'node:assert/strict';
import test from 'node:test';
import { categories, categoryIds } from '../src/data/categories.ts';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const conceptDirectory = fileURLToPath(new URL('../src/content/concepts/', import.meta.url));

function readConcept(id) {
  const path = `${conceptDirectory}/${id}.md`;
  assert.ok(existsSync(path), `${id} concept page is missing`);
  return readFileSync(path, 'utf8');
}

function assertConcept(id, order, terms, sourceUrls) {
  const document = readConcept(id);
  const frontmatterMatch = document.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(frontmatterMatch, `${id} must have leading YAML frontmatter`);
  const frontmatter = frontmatterMatch[1];
  assert.match(frontmatter, new RegExp(`^id: ${id}$`, 'm'));
  assert.match(frontmatter, /^category: external$/m);
  assert.match(frontmatter, /^graph: macro$/m);
  assert.match(frontmatter, new RegExp(`^order: ${order}$`, 'm'));
  assert.doesNotMatch(frontmatter, /^chart:/m);
  for (const term of terms) assert.ok(document.includes(term), `${id} must explain ${term}`);
  for (const url of sourceUrls) assert.ok(document.includes(url), `${id} must cite ${url}`);
}

test('registers external as the category after exchange', () => {
  assert.equal(categoryIds.at(-1), 'external');
  assert.deepEqual(categories.external, {
    label: '外部部门',
    description: '理解国际收支、跨境资金流动与一国对外经济联系。',
    order: 70,
  });
  assert.ok(categories.external.order > categories.exchange.order);
});

test('balance-of-payments teaches the complete BPM6 accounting structure', () => {
  assertConcept('balance-of-payments', 1, [
    '居民与非居民', '国籍', '某一期间', '国际投资头寸', '估值变化',
    '经常账户', '资本账户', '金融账户', '净误差与遗漏',
    '净获得金融资产', '净发生负债', '会计恒等',
    '居民按经济利益中心判断，不等于公民身份或国籍',
    '国际收支记录某一期间的交易流量',
    '国际投资头寸（IIP）记录某一时点的对外金融资产和负债存量',
    '对外金融资产净增加记为负值、净减少记为正值',
    '对外负债净增加记为正值、净减少记为负值',
    'SAFE 可能使用“资本与金融账户”作为汇总标题',
  ], [
    'https://www.safe.gov.cn/safe/2015/1230/6080.html',
    'https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm',
  ]);
});

test('current-account separates BOP flows from customs trade data', () => {
  assertConcept('current-account', 2, [
    '货物和服务', '初次收入', '二次收入', '海关', '经济所有权',
    '离岸价格', '季度或年度流量', '并不保证人民币升值',
    '经常账户不等于货物贸易差额', '自然资源租金', '产品和生产的税收与补贴',
  ], [
    'https://www.safe.gov.cn/safe/2015/1230/6080.html',
    'https://www.safe.gov.cn/safe/zggjszphb/index.html',
  ]);
});

test('financial-account explains functional categories, balance sides, and signs', () => {
  assertConcept('financial-account', 3, [
    '直接投资', '证券投资', '金融衍生工具', '其他投资', '储备资产',
    '资本账户', '净获得金融资产', '净发生负债', '总流量', '估值变化',
    'BPM6 金融账户差额采用净获得金融资产减去净发生负债',
    '对外金融资产净增加记为负值、净减少记为正值',
    '对外负债净增加记为正值、净减少记为负值',
    '总量指标在合并为净差额前保留资产侧和负债侧信息',
    '总流入、总流出等标签必须遵循具体数据集的方向约定',
  ], [
    'https://www.safe.gov.cn/safe/2015/1230/6080.html',
    'https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm',
  ]);
});

test('cross-border-capital-flows names the dataset before interpreting a flow', () => {
  assertConcept('cross-border-capital-flows', 4, [
    '分析性总称', '国际收支金融账户', '直接投资', '证券投资',
    '银行结售汇', '银行代客涉外收付款', '总流入', '总流出',
    '净流量', '居民增加境外资产', '非居民增加对本经济体的金融资产',
    '境内主体对非居民的负债增加',
  ], [
    'https://www.safe.gov.cn/safe/2018/0419/8806.html',
    'https://www.safe.gov.cn/safe/zggjszphb/index.html',
    'https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm',
  ]);
  assert.doesNotMatch(
    readConcept('cross-border-capital-flows'),
    /非居民增加境内负债/,
    'cross-border-capital-flows must not reverse the debtor perspective',
  );
});

test('effective-exchange-rate distinguishes bilateral and multilateral indexes', () => {
  assertConcept('effective-exchange-rate', 5, [
    'NEER', 'REER', '多边指数',
    '指数采用几何加权，并通过随时间变化的制造业贸易权重考虑直接贸易和第三方市场竞争',
    'BIS 公布的 REER 使用居民消费价格指数（CPI）调整',
    '不是一条通用算术公式',
    'USD/CNY 是每美元对应多少人民币的双边价格',
    'CFETS 人民币汇率指数是中国外汇交易中心按其货币篮子和规则编制的多边指数',
    'BIS NEER 和 REER 则使用 BIS 的跨经济体统一方法',
    '指数点位本身没有兑换含义',
    '从 100 到 102 才可据此计算相对变化',
    '基期、频率、宽口径或窄口径篮子以及方法版本',
    'NEER 上升表示名义有效升值，REER 上升表示实际有效升值',
    '不等于竞争力按同一百分比恶化',
    '不能从 REER 上升机械推出出口或经济活动必然下降',
    '接入前需要把提供者、宽窄口径、频率、基期和更新方式写入数据注册表',
  ], [
    'https://data.bis.org/topics/EER',
    'https://www.bis.org/statistics/dataportal/exr.htm',
    'https://www.chinamoney.com.cn/chinese/zxpl/20211231/2276204.html',
  ]);
});
