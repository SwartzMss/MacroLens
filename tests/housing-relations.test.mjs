import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const elements = JSON.parse(readFileSync(fileURLToPath(new URL('../data/relations/macro.json', import.meta.url)), 'utf8'));
const conceptDirectory = fileURLToPath(new URL('../src/content/concepts/', import.meta.url));
const nodes = new Map(elements.filter(item => 'id' in item.data).map(item => [item.data.id, item.data]));
const relations = elements.filter(item => 'source' in item.data).map(item => item.data);
const expectedNodes = new Map([
  ['real-estate-investment', '房地产开发投资'], ['property-sales', '商品房销售'],
  ['house-price-index', '房价指数 / 70城住宅价格指数'], ['mortgage', '个人住房贷款 / 按揭'],
  ['land-market', '土地市场与土地出让收入'], ['housing-market-prices', '住房市场价格'],
  ['fiscal-conditions', '财政条件'],
]);
const expected = [
  ['mortgage', 'property-sales', 'AFFECTS'],
  ['property-sales', 'real-estate-investment', 'AFFECTS'],
  ['house-price-index', 'housing-market-prices', 'REFLECTS'],
  ['real-estate-investment', 'investment-activity', 'COMPONENT_OF'],
  ['land-market', 'fiscal-conditions', 'AFFECTS'],
  ['property-sales', 'economic-activity', 'AFFECTS'],
];
const key = ({ source, target, type }) => `${source}\0${target}\0${type}`;

test('registers housing indicators and abstract nodes', () => {
  assert.equal(new Set(nodes.keys()).size, nodes.size);
  for (const [id, label] of expectedNodes) assert.equal(nodes.get(id)?.label, label, `missing node ${id}`);
  for (const id of ['housing-market-prices', 'fiscal-conditions']) {
    assert.equal(Object.hasOwn(nodes.get(id), 'kind'), false);
    assert.equal(existsSync(`${conceptDirectory}${id}.md`), false);
  }
  for (const id of ['real-estate-investment', 'property-sales', 'house-price-index', 'mortgage', 'land-market']) assert.equal(nodes.get(id)?.kind, 'indicator');
});

test('stores only approved non-deterministic housing relations', () => {
  assert.equal(new Set(relations.map(key)).size, relations.length);
  for (const relation of relations) {
    assert.ok(nodes.has(relation.source), `missing source ${relation.source}`);
    assert.ok(nodes.has(relation.target), `missing target ${relation.target}`);
  }
  const housingConceptIds = new Set(['real-estate-investment', 'property-sales', 'house-price-index', 'mortgage', 'land-market']);
  const housing = relations.filter(relation => (housingConceptIds.has(relation.source) || housingConceptIds.has(relation.target)) && relation.target !== 'land-transfer-revenue');
  assert.deepEqual(housing.map(key).sort(), expected.map(([source, target, type]) => key({ source, target, type })).sort());
  assert.equal(housing.some(relation => relation.type === 'CAUSES'), false);
});
