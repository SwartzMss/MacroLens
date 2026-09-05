import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const graph = JSON.parse(readFileSync(`${root}data/relations/macro.json`, 'utf8'));
const graphPage = `${root}src/pages/graph.astro`;
const explorerComponent = `${root}src/components/RelationshipExplorer.astro`;
const layout = `${root}src/layouts/BaseLayout.astro`;
const homepage = `${root}src/pages/index.astro`;

const readSource = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';

const nodes = graph.filter((element) => 'id' in element.data).map((element) => element.data);
const relations = graph.filter((element) => 'source' in element.data).map((element) => element.data);
const relationKey = (relation) => `${relation.source}|${relation.target}|${relation.type}`;

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

test('keeps the relationship explorer unlinked from the primary product shell', () => {
  const page = readSource(graphPage);
  const component = readSource(explorerComponent);
  const nav = readSource(layout);
  const home = readSource(homepage);

  assert.match(page, /getRelationData\(['"]macro['"]\)/);
  assert.match(page, /RelationshipExplorer/);
  assert.match(component, /data-explorer/);
  assert.match(component, /data-explorer-select/);
  assert.match(component, /data-explorer-panel/);
  assert.match(component, /RelationshipCards/);
  assert.match(component, /getConceptRelations/);
  assert.match(component, /上游|下游/);
  assert.match(component, /<noscript>/);
  assert.match(component, /图谱概念/);
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
