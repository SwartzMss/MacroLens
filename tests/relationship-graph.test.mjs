import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateGraphElements } from '../src/data/graphRegistry.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const graph = JSON.parse(readFileSync(`${root}data/relations/macro.json`, 'utf8'));
const graphPage = `${root}src/pages/graph.astro`;
const explorerComponent = `${root}src/components/RelationshipExplorer.astro`;
const relationshipCards = `${root}src/components/RelationshipCards.astro`;
const layout = `${root}src/layouts/BaseLayout.astro`;
const homepage = `${root}src/pages/index.astro`;

const readSource = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';

const nodes = graph.filter((element) => 'id' in element.data).map((element) => element.data);
const relations = graph.filter((element) => 'source' in element.data).map((element) => element.data);
const relationKey = (relation) => `${relation.source}|${relation.target}|${relation.type}`;
const explainableRelations = relations.filter((relation) => 'relation' in relation);
const explainableRelationTypes = new Set([
  'leading_indicator',
  'leading_factor',
  'synchronous_indicator',
  'lagging_indicator',
  'transmission',
]);

test('keeps the canonical graph structurally valid and complete', () => {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const relationKeys = new Set(relations.map(relationKey));
  const expectedRelations = [
    ['m2', 'activity', 'CORRELATES'],
    ['pmi', 'business-activity-conditions', 'REFLECTS'],
    ['industrial-activity', 'economic-activity', 'COMPONENT_OF'],
    ['activity', 'macro', 'AFFECTS'],
    ['investment-activity', 'economic-activity', 'COMPONENT_OF'],
  ];

  assert.equal(nodeIds.size, nodes.length, 'graph node IDs must be unique');
  assert.equal(relationKeys.size, relations.length, 'graph relation triples must be unique');
  for (const relation of relations) {
    assert.ok(nodeIds.has(relation.source), `missing source node: ${relation.source}`);
    assert.ok(nodeIds.has(relation.target), `missing target node: ${relation.target}`);
    assert.match(relation.type, /^[A-Z_]+$/, `invalid relation type: ${relation.type}`);
  }
  for (const relation of expectedRelations) assert.ok(relationKeys.has(relation.join('|')), `missing ${relation.join(' -- ')}`);
});

test('defines explainable metadata for the core macro chains', () => {
  assert.ok(explainableRelations.length >= 20, 'core macro chains need at least 20 explainable relations');
  for (const relation of explainableRelations) {
    assert.ok(explainableRelationTypes.has(relation.relation), `unknown explainable relation type: ${relation.relation}`);
    assert.equal(typeof relation.lag, 'string');
    assert.ok(relation.lag.trim().length > 0);
    assert.equal(typeof relation.explanation, 'string');
    assert.ok(relation.explanation.trim().length > 0);
    assert.equal(Object.hasOwn(relation, 'causal_effect'), false);
    assert.equal(Object.hasOwn(relation, 'impact_strength'), false);
    assert.equal(Object.hasOwn(relation, 'confidence_score'), false);
  }

  const requiredCoreRelations = [
    ['pmi', 'business-activity-conditions', 'REFLECTS'],
    ['business-activity-conditions', 'economic-activity', 'CORRELATES'],
    ['industrial-production', 'industrial-activity', 'REFLECTS'],
    ['industrial-activity', 'economic-activity', 'COMPONENT_OF'],
    ['gdp', 'economic-activity', 'MEASURES'],
    ['economic-activity', 'labor-market-conditions', 'AFFECTS'],
    ['employment', 'labor-market-conditions', 'REFLECTS'],
    ['labor-market-conditions', 'household-income-conditions', 'AFFECTS'],
    ['household-income-conditions', 'household-consumption', 'AFFECTS'],
    ['household-consumption', 'consumption-activity', 'REFLECTS'],
    ['retail-sales', 'consumption-activity', 'REFLECTS'],
    ['consumption-activity', 'economic-activity', 'COMPONENT_OF'],
    ['ppi', 'producer-price-pressure', 'REFLECTS'],
    ['producer-price-pressure', 'downstream-price-pressure', 'AFFECTS'],
    ['downstream-price-pressure', 'consumer-price-pressure', 'AFFECTS'],
    ['cpi', 'consumer-price-pressure', 'REFLECTS'],
    ['consumer-price-pressure', 'monetary-policy', 'AFFECTS'],
    ['monetary-policy', 'policy-rate', 'USES'],
    ['policy-rate', 'financing-conditions', 'AFFECTS'],
    ['financing-conditions', 'credit', 'AFFECTS'],
    ['credit', 'm2', 'AFFECTS'],
    ['credit', 'social-financing', 'OVERLAPS_WITH'],
    ['social-financing', 'real-economy-financing', 'MEASURES'],
    ['real-economy-financing', 'investment-activity', 'AFFECTS'],
    ['fixed-asset-investment', 'investment-activity', 'REFLECTS'],
    ['investment-activity', 'economic-activity', 'COMPONENT_OF'],
  ];
  for (const [source, target, type] of requiredCoreRelations) {
    const relation = relations.find((item) => relationKey(item) === `${source}|${target}|${type}`);
    assert.ok(relation?.relation && relation.lag && relation.explanation, `core relation ${source} -> ${target} needs metadata`);
  }
});

test('validates graph uniqueness, endpoints, and explainable field boundaries at runtime', () => {
  assert.doesNotThrow(() => validateGraphElements(graph));
  const validNodes = [{ data: { id: 'a', label: 'A' } }, { data: { id: 'b', label: 'B' } }];

  assert.throws(
    () => validateGraphElements([{ data: { id: 'a', label: 'A' } }, { data: { id: 'a', label: 'Duplicate' } }]),
    /Duplicate graph node ID: a/,
  );
  assert.throws(
    () => validateGraphElements([...validNodes, { data: { source: 'a', target: 'missing', type: 'AFFECTS' } }]),
    /Relation references missing node: missing/,
  );
  assert.throws(
    () => validateGraphElements([...validNodes, { data: { source: 'a', target: 'b', type: 'AFFECTS' } }, { data: { source: 'a', target: 'b', type: 'AFFECTS' } }]),
    /Duplicate graph relation: a\0b\0AFFECTS/,
  );
  assert.throws(
    () => validateGraphElements([...validNodes, { data: { source: 'a', target: 'b', type: 'AFFECTS', causal_effect: 'high' } }]),
    /Forbidden relationship field: causal_effect/,
  );
});

test('keeps the relationship explorer unlinked from the primary product shell', () => {
  const page = readSource(graphPage);
  const component = readSource(explorerComponent);
  const cards = readSource(relationshipCards);
  const nav = readSource(layout);
  const home = readSource(homepage);

  assert.match(page, /getExplainableRelationData/);
  assert.match(page, /RelationshipExplorer/);
  assert.match(component, /data-explorer/);
  assert.match(component, /data-explorer-select/);
  assert.match(component, /data-explorer-panel/);
  assert.match(component, /RelationshipCards/);
  assert.match(component, /getExplainableConceptRelations/);
  assert.match(component, /上游|下游|它受什么影响/);
  assert.match(component, /<noscript>/);
  assert.match(component, /图谱概念/);
  assert.match(cards, /<details/);
  assert.match(cards, /<summary/);
  assert.match(cards, /data-explainable-relation/);
  assert.match(cards, /lag/);
  assert.match(cards, /explanation/);
  assert.doesNotMatch(cards, /const summary = <div class="relationship-summary">/);
  assert.match(cards, /relationship-detail-endpoints/);
  assert.match(page, /展开|关系详情/);
  assert.match(page, /不代表(?:确定)?因果|因果推断/);
  assert.doesNotMatch(nav, /href=["']\/graph["']/);
  assert.doesNotMatch(home, /href=["']\/graph["']/);
});

test('does not reintroduce a node-link visualization', () => {
  const page = readSource(graphPage);
  const component = readSource(explorerComponent);

  assert.doesNotMatch(page, /echarts|RelationshipGraph|graph-canvas|force/i);
  assert.doesNotMatch(component, /echarts|Cytoscape|graph-canvas|force/i);
  assert.match(component, /它受什么影响|它影响什么|与什么相关/);
});
