import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const elements = JSON.parse(readFileSync(fileURLToPath(new URL('../data/relations/macro.json', import.meta.url)), 'utf8'));
const conceptDirectory = fileURLToPath(new URL('../src/content/concepts/', import.meta.url));
const nodes = new Map(elements.filter((item) => 'id' in item.data).map((item) => [item.data.id, item.data]));
const relations = elements.filter((item) => 'source' in item.data).map((item) => item.data);
const expectedNodes = new Map([
  ['local-government-finance', '地方财政'],
  ['local-government-debt', '地方政府债务'],
  ['local-government-special-bonds', '地方政府专项债'],
  ['land-transfer-revenue', '国有土地使用权出让收入'],
  ['lgfv', '地方政府融资平台（LGFV / 城投平台）'],
  ['local-fiscal-space', '地方财政空间'],
  ['market-financing', '市场化融资'],
  ['local-fiscal-and-investment-conditions', '地方财政与投资条件'],
]);
const expected = [
  ['local-government-finance', 'fiscal-conditions', 'COMPONENT_OF'],
  ['land-market', 'land-transfer-revenue', 'AFFECTS'],
  ['land-transfer-revenue', 'local-government-finance', 'AFFECTS'],
  ['local-government-debt', 'local-fiscal-space', 'AFFECTS'],
  ['local-government-special-bonds', 'local-government-debt', 'COMPONENT_OF'],
  ['lgfv', 'market-financing', 'USES'],
  ['lgfv', 'local-fiscal-and-investment-conditions', 'CORRELATES'],
];
const key = ({ source, target, type }) => `${source}\0${target}\0${type}`;

test('registers local-government-finance concepts and abstract graph nodes', () => {
  assert.equal(new Set(nodes.keys()).size, nodes.size);
  for (const [id, label] of expectedNodes) assert.equal(nodes.get(id)?.label, label, `missing node ${id}`);
  for (const id of ['local-government-finance', 'local-government-debt', 'local-government-special-bonds', 'land-transfer-revenue', 'lgfv']) {
    assert.equal(nodes.get(id)?.kind, undefined);
    assert.equal(existsSync(`${conceptDirectory}${id}.md`), true);
  }
  for (const id of ['local-fiscal-space', 'market-financing', 'local-fiscal-and-investment-conditions']) {
    assert.equal(Object.hasOwn(nodes.get(id), 'kind'), false);
    assert.equal(existsSync(`${conceptDirectory}${id}.md`), false);
  }
});

test('stores only cautious local-government finance relations', () => {
  assert.equal(new Set(relations.map(key)).size, relations.length);
  for (const relation of relations) {
    assert.ok(nodes.has(relation.source), `missing source ${relation.source}`);
    assert.ok(nodes.has(relation.target), `missing target ${relation.target}`);
  }
  const clusterIds = new Set(expectedNodes.keys());
  const cluster = relations.filter((relation) => clusterIds.has(relation.source) || clusterIds.has(relation.target));
  assert.deepEqual(cluster.map(key).sort(), expected.map(([source, target, type]) => key({ source, target, type })).sort());
  assert.equal(cluster.some((relation) => relation.type === 'CAUSES'), false);
  assert.equal(cluster.some((relation) => relation.source === 'lgfv' && relation.target === 'local-government-debt'), false);
});
