import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const graph = JSON.parse(readFileSync(`${root}data/relations/macro.json`, 'utf8'));
const graphPage = `${root}src/pages/graph.astro`;
const graphComponent = `${root}src/components/RelationshipGraph.astro`;
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

test('exposes a discoverable graph route and canonical payload contract', () => {
  const page = readSource(graphPage);
  const component = readSource(graphComponent);
  const nav = readSource(layout);
  const home = readSource(homepage);

  assert.match(page, /getRelationData\(['"]macro['"]\)/);
  assert.match(page, /RelationshipGraph/);
  assert.match(component, /data-graph/);
  assert.match(component, /data-payload/);
  assert.match(component, /上游|下游/);
  assert.match(component, /<noscript>/);
  assert.match(component, /图谱概念/);
  assert.match(nav, /href=["']\/graph["']/);
  assert.match(home, /href=["']\/graph["']/);
});

test('renders an interactive graph using the existing chart dependency', () => {
  const component = readSource(graphComponent);

  assert.match(component, /import \* as echarts from ['"]echarts['"]/);
  assert.match(component, /echarts\.init/);
  assert.match(component, /type:\s*['"]graph['"]/);
  assert.match(component, /layout:\s*['"]force['"]/);
  assert.match(component, /data-graph-select/);
  assert.match(component, /data-graph-details/);
  assert.match(component, /CORRELATES|OVERLAPS_WITH/);
  assert.match(component, /focus:\s*['"]adjacency['"]/);
});
