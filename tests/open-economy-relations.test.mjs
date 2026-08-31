import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const graphPath = fileURLToPath(new URL('../data/relations/macro.json', import.meta.url));
const concepts = fileURLToPath(new URL('../src/content/concepts/', import.meta.url));
const elements = JSON.parse(readFileSync(graphPath, 'utf8'));
const nodes = elements.filter(item => 'id' in item.data).map(item => item.data);
const relations = elements.filter(item => 'source' in item.data).map(item => item.data);
const key = ({ source, target, type }) => `${source}\0${target}\0${type}`;
const expectedNodes = {
  'capital-controls': '资本流动管理',
  'impossible-trinity': '不可能三角',
  'interest-rate-parity': '利率平价',
  'usd-cnh': 'USD/CNH',
  'carry-trade': '套息交易',
  'open-economy-policy-tradeoffs': '开放经济政策权衡',
  'cross-currency-pricing-relations': '跨货币定价关系',
};
const expected = [
  ['capital-controls', 'cross-border-capital-flows', 'AFFECTS'],
  ['capital-controls', 'exchange-rate-formation', 'AFFECTS'],
  ['impossible-trinity', 'open-economy-policy-tradeoffs', 'REFLECTS'],
  ['interest-rate-parity', 'cross-currency-pricing-relations', 'REFLECTS'],
  ['usd-cnh', 'usd-cny', 'CORRELATES'],
  ['carry-trade', 'cross-border-capital-flows', 'AFFECTS'],
  ['carry-trade', 'exchange-rate', 'AFFECTS'],
].map(([source, target, type]) => key({ source, target, type })).sort();

test('registers five indicators and two abstract open-economy nodes', () => {
  assert.equal(new Set(nodes.map(node => node.id)).size, nodes.length);
  for (const [id, label] of Object.entries(expectedNodes)) assert.equal(nodes.find(node => node.id === id)?.label, label);
  for (const id of ['capital-controls', 'impossible-trinity', 'interest-rate-parity', 'usd-cnh', 'carry-trade']) {
    assert.equal(nodes.find(node => node.id === id)?.kind, 'indicator');
    assert.equal(existsSync(`${concepts}${id}.md`), true);
  }
  for (const id of ['open-economy-policy-tradeoffs', 'cross-currency-pricing-relations']) {
    assert.equal(Object.hasOwn(nodes.find(node => node.id === id), 'kind'), false);
    assert.equal(existsSync(`${concepts}${id}.md`), false);
  }
});

test('contains exactly the approved new relations without deterministic causes', () => {
  const actual = relations.filter(relation => expectedNodes[relation.source] || expectedNodes[relation.target]).map(key).sort();
  assert.deepEqual(actual, expected);
  assert.equal(new Set(relations.map(key)).size, relations.length);
  assert.equal(relations.some(relation => relation.type === 'CAUSES' && (expectedNodes[relation.source] || expectedNodes[relation.target])), false);
});
