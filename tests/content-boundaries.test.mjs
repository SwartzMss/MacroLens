import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('learning content does not depend on concept content or graph infrastructure', () => {
  for (const path of ['src/pages/learn/index.astro', 'src/pages/learn/course/[lessonId].astro', 'src/pages/learn/explore/[explorationId].astro', 'src/data/courseOutline.ts', 'src/data/explorations.ts']) {
    assert.doesNotMatch(read(path), /ConceptReader|conceptId|graphRegistry|getCollection\('concepts'\)/);
  }
  assert.doesNotMatch(read('src/components/ConceptReader.astro'), /learningPath|LearningRuntime|LearningGraphBridge/);
  assert.match(read('docs/concept-learning-content-guidelines.md'), /两套独立内容/);
});
