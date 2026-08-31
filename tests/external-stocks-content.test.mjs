import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../src/content/concepts/', import.meta.url));
const expected = {
  'international-investment-position': { name: '国际投资头寸', order: 6, related: ['balance-of-payments', 'external-debt', 'reserve-assets', 'net-foreign-assets'] },
  'external-debt': { name: '外债', order: 7, related: ['international-investment-position', 'external-liabilities', 'government-debt', 'net-foreign-assets'] },
  'reserve-assets': { name: '官方储备资产', order: 8, related: ['international-investment-position', 'foreign-exchange-reserves', 'balance-of-payments'] },
  'capital-account': { name: '资本账户', order: 9, related: ['balance-of-payments', 'financial-account'] },
  'net-foreign-assets': { name: '对外净资产 / 净国际投资头寸', order: 10, related: ['international-investment-position', 'external-liabilities', 'balance-of-payments'] },
};

function page(id) {
  const path = `${dir}/${id}.md`;
  assert.ok(existsSync(path), `${id} page is missing`);
  return readFileSync(path, 'utf8');
}
function frontmatter(document) {
  const match = document.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, 'frontmatter missing');
  return Object.fromEntries(match[1].split('\n').map(line => {
    const colon = line.indexOf(':');
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    return [key, value.startsWith('[') ? value.slice(1, -1).split(',').map(item => item.trim()) : (/^\d+$/.test(value) ? Number(value) : value)];
  }));
}

test('external stock pages use external category, stable order, and no charts', () => {
  const files = new Set(readdirSync(dir));
  for (const [id, meta] of Object.entries(expected)) {
    const parsed = frontmatter(page(id));
    assert.equal(parsed.id, id);
    assert.equal(parsed.name, meta.name);
    assert.equal(parsed.country, 'CN');
    assert.equal(parsed.category, 'external');
    assert.equal(parsed.graph, 'macro');
    assert.equal(parsed.order, meta.order);
    assert.equal(parsed.updatedAt, '2026-08-31');
    assert.equal(Object.hasOwn(parsed, 'chart'), false);
    for (const related of meta.related) assert.ok(files.has(`${related}.md`) || ['external-liabilities'].includes(related), `${id} related ${related} missing`);
  }
});

const contracts = {
  'international-investment-position': [['时点', '存量', '国际收支', '交易', '估值变化', '其他数量变化', '对外金融资产', '对外负债', '债务核销', '债务减免', '资本转移'], ['https://www.safe.gov.cn/safe/2026/0327/27298.html', 'https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm']],
  'external-debt': [['全口径外债', '毛额', '债务人', '部门', '短期', '中长期', '原始期限', '剩余期限', '政府债务', '外币债务', '净外部头寸'], ['https://www.safe.gov.cn/safe/2026/0327/27301.html', 'https://data.imf.org/-/media/iData/External-Storage/Documents/73FBCD5B6CDE4D289C60B9B0CAA40622/en/2-bpm6.pdf']],
  'reserve-assets': [['储备资产', '外汇储备', '货币黄金', '特别提款权', '在国际货币基金组织的储备头寸', '更广', '子项'], ['https://www.safe.gov.cn/safe/2025/0206/25745.html', 'https://data.imf.org/-/media/iData/External-Storage/Documents/73FBCD5B6CDE4D289C60B9B0CAA40622/en/2-bpm6.pdf']],
  'capital-account': [['资本转移', '非生产非金融资产', '金融账户', '国际收支', '通常较小', 'BPM6', '自然资源', '契约、租约和许可', '营销资产', '专利和版权', '研发成果', '服务项目'], ['https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm', 'https://www.safe.gov.cn/safe/2015/1230/6080.html']],
  'net-foreign-assets': [['对外金融资产减去对外负债', '净国际投资头寸', '净资产', '净负债', '国民财富', '不是直接衡量'], ['https://www.safe.gov.cn/safe/2026/0327/27298.html', 'https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm']],
};
for (const [id, [terms, urls]] of Object.entries(contracts)) test(`${id} preserves stock-flow accounting semantics`, () => {
  const document = page(id);
  for (const term of terms) assert.ok(document.includes(term), `${id} must explain ${term}`);
  for (const url of urls) assert.ok(document.includes(url), `${id} must cite ${url}`);
});

test('keeps debt forgiveness, debt write-off, and NIIP definitions distinct', () => {
  const iip = page('international-investment-position');
  assert.match(iip, /债务减免[^。]*交易/);
  assert.match(iip, /债务核销[^。]*其他数量变化/);
  const debt = page('external-debt');
  assert.match(debt, /全部对外金融资产减去全部对外负债/);
  assert.doesNotMatch(debt, /外债是负债毛额，扣除可识别的对外资产后才进入净外部头寸/);
});

test('keeps patent/copyright research separate from marketing assets', () => {
  const capital = page('capital-account');
  assert.doesNotMatch(capital, /非生产非金融资产包括专利、版权/);
  assert.match(capital, /营销资产[^。]*资本账户/);
});
