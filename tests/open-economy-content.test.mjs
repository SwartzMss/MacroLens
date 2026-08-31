import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../src/content/concepts/', import.meta.url));
const approvedAbstractIds = new Set(['exchange-rate-formation']);
const specs = {
  'capital-controls': { category: 'external', order: 11, terms: ['经常账户可兑换', '资本账户可兑换', '宏观审慎', '行政性限制', '光谱'], urls: ['https://www.imf.org/en/Topics/Capital-Flows', 'https://www.safe.gov.cn/safe/2024/0412/24226.html'] },
  'impossible-trinity': { category: 'exchange', order: 6, terms: ['货币政策自主性', '汇率稳定', '资本流动自由', '程度', '管理浮动'] },
  'interest-rate-parity': { category: 'exchange', order: 7, terms: ['CIP', '无套利', '远期汇率', 'UIP', '不能保证短期预测'], urls: ['https://www.bis.org/publ/qtrpdf/r_qt1809e.htm', 'https://www.imf.org/en/publications/wp/issues/2016/12/31/uncovered-interest-parity-19096'] },
  'usd-cnh': { category: 'exchange', order: 8, terms: ['离岸', '在岸 CNY', '交易时段', '流动性', '不是另一种货币'] },
  'carry-trade': { category: 'exchange', order: 9, terms: ['借入低息货币', '投资高收益资产', '汇率风险', '融资风险', '尾部风险', '套期保值', '未套期保值'] },
};

function documentFor(id) {
  const path = `${directory}/${id}.md`;
  assert.ok(existsSync(path), `${id} page must exist`);
  return readFileSync(path, 'utf8');
}

function frontmatter(document) {
  const match = document.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, 'concept must have frontmatter');
  const result = {};
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    result[key.trim()] = rest.join(':').trim();
  }
  return result;
}

for (const [id, spec] of Object.entries(specs)) {
  test(`${id} has stable metadata and required distinctions`, () => {
    const document = documentFor(id);
    const metadata = frontmatter(document);
    assert.equal(metadata.id, id);
    assert.equal(metadata.category, spec.category);
    assert.equal(Number(metadata.order), spec.order);
    assert.match(metadata.source ?? '', /\S/);
    assert.match(metadata.related ?? '', /^\[/);
    assert.doesNotMatch(document.match(/^---\n([\s\S]*?)\n---/)[1], /^chart:/m);
    for (const term of spec.terms) assert.ok(document.includes(term), `${id} must explain ${term}`);
    for (const url of spec.urls ?? []) assert.ok(document.includes(url), `${id} must cite ${url}`);
  });
}

test('new concept related IDs resolve to pages or approved abstract nodes', () => {
  const pageIds = new Set(Object.keys(specs));
  for (const id of Object.keys(specs)) {
    const metadata = frontmatter(documentFor(id));
    const related = metadata.related.slice(1, -1).split(',').map(value => value.trim()).filter(Boolean);
    for (const relatedId of related) {
      assert.ok(pageIds.has(relatedId) || approvedAbstractIds.has(relatedId) || existsSync(`${directory}/${relatedId}.md`), `${id} related ID ${relatedId} must resolve`);
    }
  }
});
