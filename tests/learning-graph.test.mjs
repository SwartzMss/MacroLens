import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, 'utf8');

test('learning pages expose canonical graph bridge points', () => {
  const bridge = read('src/components/learning/LearningGraphBridge.astro');
  const conceptReader = read('src/components/ConceptReader.astro');
  const routePage = read('src/pages/learn/[pathId]/index.astro');

  assert.match(bridge, /getRelationData/);
  assert.match(bridge, /isExplainableRelation/);
  assert.match(bridge, /focusNodeId/);
  assert.match(bridge, /focusConceptIds/);
  assert.match(bridge, /\/graph\?node=/);
  assert.match(bridge, /data-learning-graph-bridge/);
  assert.match(conceptReader, /LearningGraphBridge/);
  assert.match(conceptReader, /learningPath && entry\.data\.graph/);
  assert.match(routePage, /LearningGraphBridge/);
  assert.match(routePage, /focusConceptIds=\{routeConceptIds\}/);
});

test('relationship explorer accepts and preserves node deep links', () => {
  const explorer = read('src/components/RelationshipExplorer.astro');

  assert.match(explorer, /data-explorer-default-node/);
  assert.match(explorer, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(explorer, /searchParams\.set\('node'/);
  assert.match(explorer, /history\.replaceState/);
});
