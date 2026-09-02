import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const graphPath = fileURLToPath(new URL('../data/relations/macro.json', import.meta.url));
const conceptsPath = fileURLToPath(new URL('../src/content/concepts/', import.meta.url));
const elements = JSON.parse(readFileSync(graphPath, 'utf8'));
const rawNodes = elements.filter(item => 'id' in item.data).map(item => item.data);
const nodes = new Map(rawNodes.map(node => [node.id, node]));
const relations = elements.filter(item => 'source' in item.data).map(item => item.data);

const canonicalRelationTypes = new Set([
  'CAUSES', 'AFFECTS', 'REFLECTS', 'CORRELATES', 'COMPONENT_OF',
  'IMPLEMENTS', 'USES', 'OVERLAPS_WITH', 'MEASURES', 'DERIVED_FROM',
]);

const expectedNodes = new Map([
  ['output-gap', '产出缺口'],
  ['inventory-cycle', '库存周期'],
  ['capacity-utilization', '工业产能利用率'],
  ['industrial-profits', '规模以上工业企业利润'],
  ['leading-indicators', '领先指标'],
  ['economic-slack', '经济闲置程度'],
  ['corporate-operating-conditions', '企业经营状况'],
  ['future-activity-signals', '未来经济活动信号'],
]);

const expectedRelations = [
  ['output-gap', 'economic-slack', 'REFLECTS'],
  ['capacity-utilization', 'industrial-activity', 'REFLECTS'],
  ['industrial-profits', 'corporate-operating-conditions', 'REFLECTS'],
  ['inventory-cycle', 'industrial-activity', 'AFFECTS'],
  ['leading-indicators', 'future-activity-signals', 'REFLECTS'],
];

const relationKey = ({ source, target, type }) => `${source}\0${target}\0${type}`;
const expectedRelationKeys = expectedRelations
  .map(([source, target, type]) => relationKey({ source, target, type }))
  .sort();

test('registers business-cycle concept and abstract graph nodes', () => {
  assert.equal(new Set(rawNodes.map(node => node.id)).size, rawNodes.length, 'graph node IDs must be unique');
  for (const [id, label] of expectedNodes) assert.equal(nodes.get(id)?.label, label, `missing graph node ${id}`);

  for (const id of ['economic-slack', 'corporate-operating-conditions', 'future-activity-signals']) {
    assert.equal(Object.hasOwn(nodes.get(id), 'kind'), false, `${id} must remain an abstract node`);
    assert.equal(existsSync(`${conceptsPath}${id}.md`), false, `${id} must not have a concept page`);
  }

  for (const id of ['output-gap', 'inventory-cycle', 'capacity-utilization', 'industrial-profits', 'leading-indicators']) {
    assert.equal(nodes.get(id)?.kind, 'indicator', `${id} must be an indicator node`);
    assert.equal(existsSync(`${conceptsPath}${id}.md`), true, `${id} must resolve to a concept page`);
  }
});

test('uses only the approved non-deterministic business-cycle relationships', () => {
  const relationKeys = relations.map(relationKey);
  assert.equal(new Set(relationKeys).size, relations.length, 'graph relation triples must be unique');

  for (const relation of relations) {
    assert.ok(nodes.has(relation.source), `missing source node ${relation.source}`);
    assert.ok(nodes.has(relation.target), `missing target node ${relation.target}`);
    assert.ok(canonicalRelationTypes.has(relation.type), `unknown relation type ${relation.type}`);
  }

  // Approved cross-cluster relation: output-gap -> inflation-pressure (CORRELATES).
  const approvedCrossClusterRelationKeys = new Set([
    relationKey({ source: 'output-gap', target: 'inflation-pressure', type: 'CORRELATES' }),
  ]);
  const clusterRelations = relations.filter(
    relation =>
      (expectedNodes.has(relation.source) || expectedNodes.has(relation.target)) &&
      !approvedCrossClusterRelationKeys.has(relationKey(relation)),
  );
  assert.deepEqual(clusterRelations.map(relationKey).sort(), expectedRelationKeys);
  assert.equal(clusterRelations.some(relation => relation.type === 'CAUSES'), false, 'business-cycle relations must not claim causality');
});
