import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { categories, categoryIds } from '../src/data/categories.ts';

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
  const match = document.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, 'document must have leading YAML frontmatter');
  return Object.fromEntries(match[1].split('\n').map((line) => {
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
      return [key, Object.fromEntries(contents ? contents.split(',').map((entry) => {
        const entryColon = entry.indexOf(':');
        assert.notEqual(entryColon, -1, `invalid inline map entry: ${entry}`);
        return [entry.slice(0, entryColon).trim(), parseScalar(entry.slice(entryColon + 1))];
      }) : [])];
    }
    return [key, parseScalar(rawValue)];
  }));
}

const approvedMetadata = {
  'interbank-rate': { id: 'interbank-rate', name: '银行间资金利率（DR007 / R007）', subtitle: '市场成交形成的短期资金价格，不等于央行政策操作利率', country: 'CN', category: 'markets', source: '中国人民银行与全国银行间同业拆借中心', definition: { source: 'CFETS 质押式回购指标口径', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['policy-rate', 'omo', 'lpr', 'credit'], graph: 'macro', order: 1 },
  'government-bond-yield': { id: 'government-bond-yield', name: '国债收益率', subtitle: '由债券价格和现金流共同决定的市场贴现率，不是票面利率或债券价格', country: 'CN', category: 'markets', source: '财政部与中央国债登记结算有限责任公司', definition: { source: '财政部-中国国债收益率曲线编制说明', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['yield-curve', 'real-interest-rate', 'credit-spread', 'government-debt'], graph: 'macro', order: 2 },
};

function assertConcept(id, terms, sourceUrls) {
  const document = readConcept(id);
  assert.deepEqual(parseFrontmatter(document), approvedMetadata[id]);
  assert.doesNotMatch(document, /^chart:/m);
  for (const term of terms) assert.ok(document.includes(term), `${id} must explain ${term}`);
  for (const url of sourceUrls) assert.ok(document.includes(url), `${id} must cite ${url}`);
}

test('registers markets after labor', () => {
  assert.equal(categoryIds.at(-1), 'markets');
  assert.deepEqual(categories.markets, {
    label: '金融市场',
    description: '理解政策锚如何传导到资金利率、债券收益率、实际利率与信用利差。',
    order: 90,
  });
  assert.equal(categoryIds.indexOf('markets'), categoryIds.indexOf('labor') + 1);
});

test('interbank rates distinguish policy operations, DR007, and R007', () => {
  assertConcept('interbank-rate', [
    '7天期逆回购操作利率', '市场成交利率', 'DR007', 'R007', '存款类机构',
    '利率债', '质押', '交易主体', '抵押品', '不会机械地一比一同步',
  ], [
    'https://www.chinamoney.com.cn/chinese/bkfrr/',
    'https://www.pbc.gov.cn/zhengcehuobisi/125207/125227/125957/5347949/2025100917195573922/2025081217013923839.pdf',
  ]);
});

test('government bond yield separates coupon, price, issuance, and maturity', () => {
  assertConcept('government-bond-yield', [
    '票面利率', '发行收益率', '二级市场', '债券价格', '到期收益率', '反向',
    '剩余期限', '基点', '估值', '拟合', '最后一笔成交',
  ], [
    'https://indices.chinabond.com.cn/cbweb-czb-web/czb/bzcxsmDown?locale=',
    'https://yield.chinabond.com.cn/cbweb-pbc-web/pbc/more?locale=cn_ZH',
  ]);
});
