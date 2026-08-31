import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { categories, categoryIds } from '../src/data/categories.ts';

const conceptDirectory = fileURLToPath(new URL('../src/content/concepts/', import.meta.url));
const metadata = {
  'real-estate-investment': { id: 'real-estate-investment', name: '房地产开发投资', category: 'housing', graph: 'macro', order: 1, related: ['property-sales', 'house-price-index', 'mortgage', 'land-market', 'investment-activity'] },
  'property-sales': { id: 'property-sales', name: '商品房销售', category: 'housing', graph: 'macro', order: 2, related: ['real-estate-investment', 'house-price-index', 'mortgage', 'economic-activity'] },
  'house-price-index': { id: 'house-price-index', name: '房价指数 / 70城住宅价格指数', category: 'housing', graph: 'macro', order: 3, related: ['property-sales', 'real-estate-investment', 'mortgage'] },
  mortgage: { id: 'mortgage', name: '个人住房贷款 / 按揭', category: 'housing', graph: 'macro', order: 4, related: ['property-sales', 'house-price-index', 'lpr', 'credit'] },
  'land-market': { id: 'land-market', name: '土地市场与土地出让收入', category: 'housing', graph: 'macro', order: 5, related: ['real-estate-investment', 'property-sales', 'fiscal-revenue', 'fiscal-conditions'] },
};

function parse(document) {
  const match = document.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, 'concept must have frontmatter');
  const result = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    result[key] = value.startsWith('[') ? value.slice(1, -1).split(',').map(item => item.trim()) : (/^\d+$/.test(value) ? Number(value) : value);
  }
  return result;
}

function page(id) {
  const path = `${conceptDirectory}/${id}.md`;
  assert.ok(existsSync(path), `${id} page is missing`);
  return readFileSync(path, 'utf8');
}

test('registers housing category between growth and fiscal', () => {
  assert.ok(categoryIds.includes('housing'));
  assert.equal(categories.housing.label, '房地产');
  assert.equal(categories.housing.order, 45);
  assert.ok(categories.growth.order < categories.housing.order);
  assert.ok(categories.housing.order < categories.fiscal.order);
});

test('housing pages have stable metadata and no charts', () => {
  const ids = new Set(readdirSync(conceptDirectory).filter(name => name.endsWith('.md')));
  for (const [id, expected] of Object.entries(metadata)) {
    const document = page(id);
    const parsed = parse(document);
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(parsed[key], value, `${id} ${key} mismatch`);
    assert.equal(parsed.country, 'CN');
    assert.equal(parsed.updatedAt, '2026-08-31');
    assert.equal(Object.hasOwn(parsed, 'chart'), false);
    for (const related of expected.related) assert.ok(ids.has(`${related}.md`), `${id} related ${related} missing`);
  }
});

const contracts = {
  'real-estate-investment': [['房地产开发投资', '累计数据', '单月', '规模以上', '固定资产投资', '名义', '实际建设工程量'], ['https://www.stats.gov.cn/sj/zxfbhjd/202601/t20260119_1962324.html']],
  'property-sales': [['销售面积', '销售额', '隐含均价', '合同总面积', '累计', '基数效应', '新建商品房', '二手房', '不能混'], ['https://www.stats.gov.cn/zs/tjws/tjzb/202301/t20230101_1903764.html', 'https://www.stats.gov.cn/sj/zxfbhjd/202601/t20260119_1962324.html']],
  'house-price-index': [['70个大中城市', '环比', '同比', '新建商品住宅', '二手住宅', '不是全国交易均价', '城市层面'], ['https://www.stats.gov.cn/sj/zxfbhjd/202601/t20260119_1962319.html']],
  mortgage: [['个人住房贷款利率', 'LPR', '存量', '新增', '偿还', '一般住户贷款', '定价'], ['https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125440/3876551/5625437/index.html', 'https://www.pbc.gov.cn/goutongjiaoliu/113456/113469/2025092212554091417/index.html']],
  'land-market': [['土地出让', '成交价款', '土地出让收入', '政府性基金预算', '一般公共预算', '不属于一般公共预算收入', '房地产开发投资', '财政收入'], ['https://gks.mof.gov.cn/tongjishuju/202601/t20260130_3982923.htm', 'https://yss.mof.gov.cn/xiazaizhongxin/202510/P020251022648527813584.pdf']],
};

for (const [id, [terms, urls]] of Object.entries(contracts)) test(`${id} preserves its statistical boundaries`, () => {
  const document = page(id);
  for (const term of terms) assert.ok(document.includes(term), `${id} must explain ${term}`);
  for (const url of urls) assert.ok(document.includes(url), `${id} must cite ${url}`);
});
