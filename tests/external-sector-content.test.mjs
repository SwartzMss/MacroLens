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
};

function assertConcept(id, terms, sourceUrls) {
  const document = readConcept(id);
  assert.deepEqual(parseFrontmatter(document), approvedMetadata[id]);
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
