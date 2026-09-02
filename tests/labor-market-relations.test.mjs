import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const graphPath = fileURLToPath(new URL('../data/relations/macro.json', import.meta.url));
const conceptsPath = fileURLToPath(new URL('../src/content/concepts/', import.meta.url));
const elements = JSON.parse(readFileSync(graphPath, 'utf8'));
const rawNodes = elements.filter((item) => 'id' in item.data).map((item) => item.data);
const nodes = new Map(rawNodes.map((node) => [node.id, node]));
const relations = elements.filter((item) => 'source' in item.data).map((item) => item.data);

const canonicalRelationTypes = new Set(['CAUSES', 'AFFECTS', 'REFLECTS', 'CORRELATES', 'COMPONENT_OF', 'IMPLEMENTS', 'USES', 'OVERLAPS_WITH', 'MEASURES', 'DERIVED_FROM']);
const expectedNodes = new Map([
  ['employment', '就业'],
  ['unemployment-rate', '城镇调查失业率'],
  ['youth-unemployment', '青年失业率 / 分年龄组失业率'],
  ['labor-force-participation', '劳动参与率'],
  ['wages', '工资与劳动报酬'],
  ['labor-market-conditions', '劳动力市场状况'],
  ['labor-supply', '劳动力供给'],
]);
const expectedRelations = [
  ['employment', 'labor-market-conditions', 'REFLECTS'],
  ['employment', 'household-income-conditions', 'AFFECTS'],
  ['unemployment-rate', 'labor-market-conditions', 'REFLECTS'],
  ['youth-unemployment', 'labor-market-conditions', 'REFLECTS'],
  ['labor-force-participation', 'labor-supply', 'REFLECTS'],
  ['wages', 'consumer-price-pressure', 'AFFECTS'],
  ['wages', 'consumption-activity', 'AFFECTS'],
  ['wages', 'household-income-conditions', 'AFFECTS'],
  ['labor-market-conditions', 'economic-activity', 'AFFECTS'],
];
const relationKey = ({ source, target, type }) => `${source}\0${target}\0${type}`;
const expectedRelationKeys = expectedRelations.map(([source, target, type]) => relationKey({ source, target, type })).sort();

test('registers labor concept and abstract graph nodes', () => {
  assert.equal(new Set(rawNodes.map((node) => node.id)).size, rawNodes.length, 'graph node IDs must be unique');
  for (const [id, label] of expectedNodes) assert.equal(nodes.get(id)?.label, label, `missing graph node ${id}`);
  for (const id of ['labor-market-conditions', 'labor-supply']) {
    assert.equal(Object.hasOwn(nodes.get(id), 'kind'), false, `${id} must remain an abstract node`);
    assert.equal(existsSync(`${conceptsPath}${id}.md`), false, `${id} must not have a concept page`);
  }
});

test('uses only the approved labor-market relationships', () => {
  const relationKeys = relations.map(relationKey);
  assert.equal(new Set(relationKeys).size, relations.length, 'graph relation triples must be unique');
  for (const relation of relations) {
    assert.ok(nodes.has(relation.source), `missing source node ${relation.source}`);
    assert.ok(nodes.has(relation.target), `missing target node ${relation.target}`);
    assert.ok(canonicalRelationTypes.has(relation.type), `unknown relation type ${relation.type}`);
  }
  const laborRelations = relations.filter((relation) => expectedNodes.has(relation.source) || expectedNodes.has(relation.target));
  assert.deepEqual(laborRelations.map(relationKey).sort(), expectedRelationKeys);
  assert.equal(laborRelations.some((relation) => relation.type === 'CAUSES'), false);
  assert.equal(relations.some((relation) => relation.source === 'unemployment-rate' && relation.target === 'economic-activity'), false);
});
