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
  ['interbank-rate', '银行间资金利率（DR007 / R007）'],
  ['government-bond-yield', '国债收益率'],
  ['yield-curve', '收益率曲线'],
  ['real-interest-rate', '实际利率'],
  ['credit-spread', '信用利差'],
  ['rate-expectations-and-term-premium', '利率预期与期限溢价'],
  ['credit-risk-and-risk-appetite', '信用风险与风险偏好'],
]);
const expectedRelations = [
  ['policy-rate', 'interbank-rate', 'AFFECTS'],
  ['interbank-rate', 'financing-conditions', 'AFFECTS'],
  ['government-bond-yield', 'financing-conditions', 'REFLECTS'],
  ['yield-curve', 'rate-expectations-and-term-premium', 'REFLECTS'],
  ['real-interest-rate', 'economic-activity', 'AFFECTS'],
  ['credit-spread', 'credit-risk-and-risk-appetite', 'REFLECTS'],
  ['credit-spread', 'financing-conditions', 'AFFECTS'],
];
const relationKey = ({ source, target, type }) => `${source}\0${target}\0${type}`;
const expectedRelationKeys = expectedRelations.map(([source, target, type]) => relationKey({ source, target, type })).sort();

test('registers market-rate concept and abstract graph nodes', () => {
  assert.equal(new Set(rawNodes.map((node) => node.id)).size, rawNodes.length, 'graph node IDs must be unique');
  for (const [id, label] of expectedNodes) assert.equal(nodes.get(id)?.label, label, `missing graph node ${id}`);
  for (const id of ['rate-expectations-and-term-premium', 'credit-risk-and-risk-appetite']) {
    assert.equal(Object.hasOwn(nodes.get(id), 'kind'), false, `${id} must remain an abstract node`);
    assert.equal(existsSync(`${conceptsPath}${id}.md`), false, `${id} must not have a concept page`);
  }
});

test('uses only the approved directional market-rate relationships', () => {
  const relationKeys = relations.map(relationKey);
  assert.equal(new Set(relationKeys).size, relations.length, 'graph relation triples must be unique');
  for (const relation of relations) {
    assert.ok(nodes.has(relation.source), `missing source node ${relation.source}`);
    assert.ok(nodes.has(relation.target), `missing target node ${relation.target}`);
    assert.ok(canonicalRelationTypes.has(relation.type), `unknown relation type ${relation.type}`);
  }
  // Approved cross-cluster relation: inflation-expectations -> real-interest-rate (AFFECTS).
  const approvedCrossClusterRelationKeys = new Set([
    relationKey({ source: 'inflation-expectations', target: 'real-interest-rate', type: 'AFFECTS' }),
  ]);
  const marketRelations = relations.filter(
    (relation) =>
      (expectedNodes.has(relation.source) || expectedNodes.has(relation.target)) &&
      !approvedCrossClusterRelationKeys.has(relationKey(relation)),
  );
  assert.deepEqual(marketRelations.map(relationKey).sort(), expectedRelationKeys);
  assert.equal(marketRelations.some((relation) => relation.type === 'CAUSES'), false);
  assert.equal(relations.some((relation) => relation.source === 'yield-curve' && relation.target === 'economic-activity'), false);
});
