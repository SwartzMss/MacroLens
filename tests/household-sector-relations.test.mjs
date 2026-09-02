import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const graphPath = fileURLToPath(new URL('../data/relations/macro.json', import.meta.url));
const elements = JSON.parse(readFileSync(graphPath, 'utf8'));
const nodes = elements.filter((item) => 'id' in item.data).map((item) => item.data);
const relations = elements.filter((item) => 'source' in item.data).map((item) => item.data);

const indicatorLabels = new Map([
  ['disposable-income', '居民人均可支配收入'],
  ['income-expectations', '收入预期'],
  ['household-consumption', '居民消费支出'],
  ['household-saving-rate', '居民储蓄率'],
  ['propensity-to-consume', '消费倾向'],
]);

const abstractLabels = new Map([
  ['household-income-conditions', '居民收入条件'],
  ['household-consumption-behavior', '居民消费行为'],
  ['household-saving-behavior', '居民储蓄行为'],
  ['saving-consumption-choice', '储蓄与消费选择'],
]);

const expectedRelations = [
  ['wages', 'household-income-conditions', 'AFFECTS'],
  ['employment', 'household-income-conditions', 'AFFECTS'],
  ['disposable-income', 'household-income-conditions', 'REFLECTS'],
  ['disposable-income', 'household-consumption', 'AFFECTS'],
  ['income-expectations', 'household-consumption', 'AFFECTS'],
  ['household-consumption', 'household-consumption-behavior', 'REFLECTS'],
  ['propensity-to-consume', 'household-consumption-behavior', 'REFLECTS'],
  ['household-consumption', 'economic-activity', 'COMPONENT_OF'],
  ['real-interest-rate', 'saving-consumption-choice', 'AFFECTS'],
  ['household-saving-rate', 'household-saving-behavior', 'REFLECTS'],
];

const canonicalRelationTypes = new Set([
  'CAUSES', 'AFFECTS', 'REFLECTS', 'CORRELATES', 'COMPONENT_OF',
  'IMPLEMENTS', 'USES', 'OVERLAPS_WITH', 'MEASURES', 'DERIVED_FROM',
]);

const relationKey = ({ source, target, type }) => `${source}\0${target}\0${type}`;
const hasRelation = (source, target, type) => relations.some(
  (relation) => relation.source === source && relation.target === target && relation.type === type,
);

test('registers household indicator and abstract graph nodes', () => {
  assert.equal(new Set(nodes.map((node) => node.id)).size, nodes.length, 'graph node IDs must be unique');
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  for (const [id, label] of [...indicatorLabels, ...abstractLabels]) {
    assert.equal(nodeById.get(id)?.label, label, `missing graph node ${id}`);
  }
  for (const id of indicatorLabels.keys()) assert.equal(nodeById.get(id)?.kind, 'indicator', `${id} must be an indicator node`);
  for (const id of abstractLabels.keys()) assert.equal(Object.hasOwn(nodeById.get(id), 'kind'), false, `${id} must be abstract`);
});

test('uses approved household measurement and mechanism relations', () => {
  assert.equal(new Set(relations.map(relationKey)).size, relations.length, 'graph relation triples must be unique');
  const nodeIds = new Set(nodes.map((node) => node.id));
  for (const relation of relations) {
    assert.ok(nodeIds.has(relation.source), `missing source node ${relation.source}`);
    assert.ok(nodeIds.has(relation.target), `missing target node ${relation.target}`);
    assert.ok(canonicalRelationTypes.has(relation.type), `unknown relation type ${relation.type}`);
  }

  for (const [source, target, type] of expectedRelations) {
    assert.equal(hasRelation(source, target, type), true, `missing relation ${source} ${type} ${target}`);
  }

  assert.equal(hasRelation('retail-sales', 'consumption-activity', 'REFLECTS'), true);
  assert.equal(hasRelation('retail-sales', 'household-consumption', 'COMPONENT_OF'), false);

  const householdNodeIds = new Set([...indicatorLabels.keys(), ...abstractLabels.keys()]);
  assert.equal(relations.some((relation) => householdNodeIds.has(relation.source) || householdNodeIds.has(relation.target)
    ? relation.type === 'CAUSES' : false), false, 'household relations must not claim deterministic causality');
});
