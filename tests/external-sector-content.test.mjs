import assert from 'node:assert/strict';
import test from 'node:test';
import { categories, categoryIds } from '../src/data/categories.ts';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const conceptDirectory = fileURLToPath(new URL('../src/content/concepts/', import.meta.url));

function readConcept(id) {
  const path = `${conceptDirectory}/${id}.md`;
  assert.ok(existsSync(path), `${id} concept page is missing`);
  return readFileSync(path, 'utf8');
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  return trimmed;
}

function parseFrontmatter(document) {
  const frontmatterMatch = document.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(frontmatterMatch, 'document must have leading YAML frontmatter');
  return Object.fromEntries(frontmatterMatch[1].split('\n').map((line) => {
    const colon = line.indexOf(':');
    assert.notEqual(colon, -1, `invalid frontmatter line: ${line}`);
    const key = line.slice(0, colon).trim();
    const rawValue = line.slice(colon + 1).trim();
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      const contents = rawValue.slice(1, -1).trim();
      return [key, contents ? contents.split(',').map(parseScalar) : []];
    }
    if (rawValue.startsWith('{') && rawValue.endsWith('}')) {
      const contents = rawValue.slice(1, -1).trim();
      const value = Object.fromEntries(contents ? contents.split(',').map((entry) => {
        const entryColon = entry.indexOf(':');
        assert.notEqual(entryColon, -1, `invalid inline map entry: ${entry}`);
        return [entry.slice(0, entryColon).trim(), parseScalar(entry.slice(entryColon + 1))];
      }) : []);
      return [key, value];
    }
    return [key, parseScalar(rawValue)];
  }));
}

const approvedMetadata = {
  'balance-of-payments': { id: 'balance-of-payments', name: '国际收支', subtitle: '记录居民与非居民在某一期间经济交易的统计报表，不是外部资产负债存量表', country: 'CN', category: 'external', source: '国家外汇管理局与国际货币基金组织', definition: { source: 'SAFE 与 IMF BPM6', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['current-account', 'financial-account', 'cross-border-capital-flows', 'foreign-exchange-reserves'], graph: 'macro', order: 1 },
  'current-account': { id: 'current-account', name: '经常账户', subtitle: '汇总货物和服务、初次收入与二次收入的跨境交易流量', country: 'CN', category: 'external', source: '国家外汇管理局与国际货币基金组织', definition: { source: 'SAFE 与 IMF BPM6', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['balance-of-payments', 'financial-account', 'cross-border-capital-flows', 'exchange-rate'], graph: 'macro', order: 2 },
  'financial-account': { id: 'financial-account', name: '金融账户', subtitle: '记录居民与非居民金融资产和负债交易，读正负号前必须确认列示方法', country: 'CN', category: 'external', source: '国家外汇管理局与国际货币基金组织', definition: { source: 'SAFE 与 IMF BPM6', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['balance-of-payments', 'current-account', 'cross-border-capital-flows', 'foreign-exchange-reserves'], graph: 'macro', order: 3 },
  'cross-border-capital-flows': { id: 'cross-border-capital-flows', name: '跨境资本流动', subtitle: '对多类跨境金融交易的分析性总称，不是一条统一口径的官方指标', country: 'CN', category: 'external', source: '国家外汇管理局与国际货币基金组织', definition: { source: 'SAFE 与 IMF BPM6', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['financial-account', 'balance-of-payments', 'current-account', 'exchange-rate', 'foreign-exchange-reserves'], graph: 'macro', order: 4 },
  'effective-exchange-rate': { id: 'effective-exchange-rate', name: '有效汇率（NEER / REER）', subtitle: '汇总本币相对一篮子货币变化的多边指数，并可进一步纳入相对价格', country: 'CN', category: 'external', source: '国际清算银行与中国外汇交易中心', definition: { source: 'BIS effective exchange rates methodology', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['exchange-rate', 'usd-cny', 'cfets-rmb-index', 'current-account'], graph: 'macro', order: 5 },
  exports: { id: 'exports', name: '出口', subtitle: '向非居民出售的货物或服务交易，必须先区分海关货物统计与国际收支口径', country: 'CN', category: 'external', source: '海关总署、国家外汇管理局与国际货币基金组织', definition: { source: '海关统计、SAFE 与 IMF BPM6', asOf: '2026-09' }, updatedAt: '2026-09-02', related: ['imports', 'trade-balance', 'trade-volume-and-price', 'exchange-rate', 'current-account'], graph: 'macro', order: 6, level: 'basic', topics: ['balance-of-payments'], prerequisites: ['exchange-rate'], featured: false },
  imports: { id: 'imports', name: '进口', subtitle: '从非居民取得的货物或服务交易，金额变化必须与数量、价格和估价口径分开阅读', country: 'CN', category: 'external', source: '海关总署、国家外汇管理局与国际货币基金组织', definition: { source: '海关统计、SAFE 与 IMF BPM6', asOf: '2026-09' }, updatedAt: '2026-09-02', related: ['exports', 'trade-balance', 'trade-volume-and-price', 'exchange-rate', 'current-account'], graph: 'macro', order: 7, level: 'basic', topics: ['balance-of-payments'], prerequisites: ['exchange-rate'], featured: false },
  'trade-balance': { id: 'trade-balance', name: '贸易差额', subtitle: '在明确货物、服务及统计口径后计算的出口减进口差额，不等同经常账户余额', country: 'CN', category: 'external', source: '海关总署、国家外汇管理局与国际货币基金组织', definition: { source: '海关统计、SAFE 与 IMF BPM6', asOf: '2026-09' }, updatedAt: '2026-09-02', related: ['exports', 'imports', 'current-account', 'trade-volume-and-price'], graph: 'macro', order: 8, level: 'basic', topics: ['balance-of-payments'], prerequisites: ['exports', 'imports'], featured: false },
  'trade-volume-and-price': { id: 'trade-volume-and-price', name: '贸易数量与价格拆分', subtitle: '把进出口金额变化拆解为数量和价格变化的分析框架', country: 'CN', category: 'external', source: '国家统计局、国家外汇管理局与国际货币基金组织', definition: { source: '国民经济核算、SAFE 与 IMF BPM6', asOf: '2026-09' }, updatedAt: '2026-09-02', related: ['exports', 'imports', 'trade-balance', 'terms-of-trade', 'current-account'], graph: 'macro', order: 9, level: 'basic', topics: ['balance-of-payments'], prerequisites: ['exports', 'imports'], featured: false },
  'terms-of-trade': { id: 'terms-of-trade', name: '贸易条件', subtitle: '出口价格相对进口价格的比值或指数，不是汇率或贸易差额', country: 'CN', category: 'external', source: '国家外汇管理局、国际货币基金组织与世界贸易组织', definition: { source: 'IMF BPM6 与 WTO trade methodology', asOf: '2026-09' }, updatedAt: '2026-09-02', related: ['trade-volume-and-price', 'exports', 'imports', 'trade-balance', 'exchange-rate'], graph: 'macro', order: 10, level: 'basic', topics: ['balance-of-payments'], prerequisites: ['trade-volume-and-price'], featured: false },
};

function assertConcept(id, terms, sourceUrls) {
  const document = readConcept(id);
  const metadata = parseFrontmatter(document);
  for (const [key, value] of Object.entries(approvedMetadata[id])) assert.deepEqual(metadata[key], value);
  for (const term of terms) assert.ok(document.includes(term), `${id} must explain ${term}`);
  for (const url of sourceUrls) assert.ok(document.includes(url), `${id} must cite ${url}`);
}

test('registers external as the category after exchange', () => {
  assert.deepEqual(categories.external, {
    label: '外部部门',
    description: '理解国际收支、跨境资金流动与一国对外经济联系。',
    order: 70,
  });
  assert.ok(categories.external.order > categories.exchange.order);
  assert.equal(categoryIds.indexOf('external'), categoryIds.indexOf('exchange') + 1);
});

test('all approved related concept IDs resolve to stable concept pages', () => {
  const conceptIds = new Set(readdirSync(conceptDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => parseFrontmatter(readFileSync(`${conceptDirectory}/${entry.name}`, 'utf8')).id));
  for (const metadata of Object.values(approvedMetadata)) {
    for (const relatedId of metadata.related) {
      assert.ok(conceptIds.has(relatedId), `${metadata.id} related ID ${relatedId} must resolve`);
    }
  }
});

test('balance-of-payments teaches the complete BPM6 accounting structure', () => {
  assertConcept('balance-of-payments', [
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
  assertConcept('current-account', [
    '货物和服务', '初次收入', '二次收入', '海关', '经济所有权',
    '离岸价格', '季度或年度流量', '并不保证人民币升值',
    '经常账户不等于货物贸易差额', '自然资源租金', '产品和生产的税收与补贴',
  ], [
    'https://www.safe.gov.cn/safe/2015/1230/6080.html',
    'https://www.safe.gov.cn/safe/zggjszphb/index.html',
  ]);
});

test('financial-account explains functional categories, balance sides, and signs', () => {
  assertConcept('financial-account', [
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
  assertConcept('cross-border-capital-flows', [
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
  assert.ok(readConcept('cross-border-capital-flows').includes(
    '在负债侧，同一笔交易从债权人视角看是非居民增加对本经济体的金融资产或债权，从债务人视角看则是境内主体对非居民的负债增加。',
  ));
});

test('effective-exchange-rate distinguishes bilateral and multilateral indexes', () => {
  assertConcept('effective-exchange-rate', [
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

test('exports and imports separate customs values from BOP flows and price-volume measures', () => {
  assertConcept('exports', [
    '海关统计', '国际收支', '货物', '服务', '出口金额', '出口数量', '出口价格',
    '名义出口增长不等于实际或数量增长', '月度', '季节性', '基数效应', 'FOB',
  ], ['https://www.customs.gov.cn/', 'https://www.safe.gov.cn/', 'https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm']);
  assertConcept('imports', [
    '海关统计', '国际收支', '货物', '服务', '进口金额', '进口数量', '进口价格',
    'CIF', '国内需求', '投入品', '月度', '季节性',
  ], ['https://www.customs.gov.cn/', 'https://www.safe.gov.cn/', 'https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm']);
  for (const id of ['exports', 'imports']) {
    assert.doesNotMatch(readConcept(id), /海关统计(?:的)?(?:出口|进口)与国际收支(?:经常账户)?(?:出口|进口)完全相同/);
  }
});

test('trade balance separates scope, bilateral aggregation, and current-account accounting', () => {
  assertConcept('trade-balance', [
    '出口减进口', '贸易差额', '货物贸易', '服务贸易', '经常账户', '双边贸易差额',
    '总体贸易差额', '不能直接等同', '月度', '季节性', '基数效应',
  ], ['https://www.customs.gov.cn/', 'https://www.safe.gov.cn/', 'https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm']);
  assert.doesNotMatch(readConcept('trade-balance'), /贸易顺差等于经常账户顺差/);
});

test('trade decomposition distinguishes nominal value from price and volume changes', () => {
  assertConcept('trade-volume-and-price', [
    '金额', '数量', '价格', '名义', '实际', '数量指数', '价格指数',
    '出口价值增长', '出口数量增长', '进口', '基数效应', '季节性',
  ], ['https://www.stats.gov.cn/', 'https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm']);
});

test('terms of trade is a relative-price measure distinct from exchange rates', () => {
  assertConcept('terms-of-trade', [
    '出口价格指数', '进口价格指数', '贸易条件', '不是汇率', '相对价格',
    'FOB', 'CIF', '不能机械推出',
  ], ['https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm', 'https://www.wto.org/english/res_e/statis_e/daily_update_e/merch_methodology_e.pdf']);
});
