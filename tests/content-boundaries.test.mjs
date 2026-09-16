import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, 'utf8');

test('documents distinct Concept and Learning responsibilities', () => {
  const guidelines = read('docs/concept-learning-content-guidelines.md');
  for (const phrase of ['Concept 与 Learning 内容边界', '它是什么？', '它如何运作？', '关系由 `data/relations/macro.json` 和 `graphRegistry` 提供', '不重复什么']) {
    assert.match(guidelines, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('uses one shared layer guide while keeping canonical content and graph sources', () => {
  const guide = read('src/components/ContentLayerGuide.astro');
  const reader = read('src/components/ConceptReader.astro');
  const learningIndex = read('src/pages/learn/index.astro');
  assert.match(guide, /data-content-layer=\{mode\}/);
  assert.match(guide, /回答“它是什么？”/);
  assert.match(guide, /回答“它如何运作？”/);
  assert.match(reader, /ContentLayerGuide/);
  assert.match(reader, /learningStepHref/);
  assert.match(reader, /getConceptRelations/);
  assert.match(learningIndex, /data-content-boundary/);
  assert.match(learningIndex, /data-content-layer-card="concept"/);
  assert.match(learningIndex, /data-content-layer-card="learning"/);
});
