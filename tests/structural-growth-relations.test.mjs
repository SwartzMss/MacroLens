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

const canonicalRelationTypes = new Set([
  'CAUSES', 'AFFECTS', 'REFLECTS', 'CORRELATES', 'COMPONENT_OF',
  'IMPLEMENTS', 'USES', 'OVERLAPS_WITH', 'MEASURES', 'DERIVED_FROM',
]);

const indicatorNodes = new Map([
  ['productivity', '劳动生产率'],
  ['total-factor-productivity', '全要素生产率（TFP）'],
  ['working-age-population', '劳动年龄人口'],
  ['demographic-dependency-ratio', '人口抚养比'],
  ['potential-output', '潜在产出与潜在增长'],
  ['output-gap', '产出缺口'],
]);

const abstractNodes = new Map([
  ['demographic-structure', '人口结构'],
  ['efficiency-and-technology-residual', '效率与技术残差'],
  ['sustainable-growth-capacity', '可持续增长能力'],
  ['actual-vs-potential-output', '实际与潜在产出对照'],
]);

const newIndicatorIds = new Set([...indicatorNodes.keys()].filter((id) => id !== 'output-gap'));
const abstractIds = new Set(abstractNodes.keys());
const newNodeIds = new Set([...newIndicatorIds, ...abstractIds]);
const expectedRelations = [
  ['working-age-population', 'labor-supply', 'AFFECTS'],
  ['productivity', 'potential-output', 'AFFECTS'],
  ['total-factor-productivity', 'efficiency-and-technology-residual', 'REFLECTS'],
  ['potential-output', 'sustainable-growth-capacity', 'REFLECTS'],
  ['output-gap', 'actual-vs-potential-output', 'DERIVED_FROM'],
  ['demographic-dependency-ratio', 'demographic-structure', 'REFLECTS'],
];

const relationKey = ({ source, target, type }) => `${source}\0${target}\0${type}`;
const expectedRelationKeys = expectedRelations
  .map(([source, target, type]) => relationKey({ source, target, type }))
  .sort();

test('registers structural-growth indicator and abstract graph nodes', () => {
  assert.equal(new Set(rawNodes.map((node) => node.id)).size, rawNodes.length, 'graph node IDs must be unique');

  for (const [id, label] of indicatorNodes) {
    assert.equal(nodes.get(id)?.label, label, `missing graph node ${id}`);
    assert.equal(nodes.get(id)?.kind, 'indicator', `${id} must be an indicator node`);
    assert.equal(existsSync(`${conceptsPath}${id}.md`), true, `${id} must resolve to a concept page`);
  }

  for (const [id, label] of abstractNodes) {
    assert.equal(nodes.get(id)?.label, label, `missing graph node ${id}`);
    assert.equal(Object.hasOwn(nodes.get(id), 'kind'), false, `${id} must remain an abstract node`);
    assert.equal(existsSync(`${conceptsPath}${id}.md`), false, `${id} must not have a concept page`);
  }
});

test('uses only the approved non-causal structural-growth relations', () => {
  const relationKeys = relations.map(relationKey);
  assert.equal(new Set(relationKeys).size, relations.length, 'graph relation triples must be unique');

  for (const relation of relations) {
    assert.ok(nodes.has(relation.source), `missing source node ${relation.source}`);
    assert.ok(nodes.has(relation.target), `missing target node ${relation.target}`);
    assert.ok(canonicalRelationTypes.has(relation.type), `unknown relation type ${relation.type}`);
  }

  const structuralRelations = relations.filter(
    (relation) => newNodeIds.has(relation.source) || newNodeIds.has(relation.target),
  );
  assert.deepEqual(structuralRelations.map(relationKey).sort(), expectedRelationKeys);
  assert.equal(structuralRelations.some((relation) => relation.type === 'CAUSES'), false, 'structural-growth relations must not claim causality');
});
