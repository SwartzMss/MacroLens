import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { topicIds, topicRegistry } from '../src/data/topics.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const topicsIndex = `${root}src/pages/topics/index.astro`;
const topicDetail = `${root}src/pages/topics/[id].astro`;
const prerequisiteComponent = `${root}src/components/PrerequisiteConcepts.astro`;
const conceptsIndex = `${root}src/pages/concepts/index.astro`;

test('topic registry has stable unique IDs and complete topic metadata', () => {
  assert.deepEqual(topicRegistry.map((topic) => topic.id), topicIds);
  assert.equal(new Set(topicRegistry.map((topic) => topic.id)).size, topicRegistry.length);
  assert.equal(new Set(topicRegistry.map((topic) => topic.order)).size, topicRegistry.length);
  for (const topic of topicRegistry) {
    assert.match(topic.label, /\S/);
    assert.match(topic.description, /\S/);
    assert.match(topic.category, /\S/);
  }

  const householdTopic = topicRegistry.find((topic) => topic.id === 'household-sector');
  assert.deepEqual(householdTopic, {
    id: 'household-sector',
    label: '居民部门',
    description: '理解劳动收入、可支配收入、消费、储蓄与预期之间的统计边界和传导关系。',
    category: 'growth',
    order: 55,
  });

  const structuralGrowthTopic = topicRegistry.find((topic) => topic.id === 'structural-growth');
  assert.deepEqual(structuralGrowthTopic, {
    id: 'structural-growth',
    label: '结构性增长',
    description: '理解生产率、人口结构、劳动供给与潜在产出如何共同决定长期增长能力。',
    category: 'growth',
    order: 52,
  });
});

test('topic pages and prerequisite component exist as static route sources', () => {
  assert.equal(existsSync(topicsIndex), true, 'topic index route is missing');
  assert.equal(existsSync(topicDetail), true, 'topic detail route is missing');
  assert.equal(existsSync(prerequisiteComponent), true, 'prerequisite component is missing');

  const detailSource = readFileSync(topicDetail, 'utf8');
  assert.match(detailSource, /getStaticPaths/);
  assert.match(detailSource, /buildConceptCatalog/);
  assert.doesNotMatch(detailSource, /\[['"][a-z0-9-]+['"](?:,\s*['"][a-z0-9-]+['"])+\]/);

  const prerequisiteSource = readFileSync(prerequisiteComponent, 'utf8');
  assert.match(prerequisiteSource, /建议先理解/);
  assert.match(prerequisiteSource, /\/concepts\//);
});

test('concept links in the catalog remain stable concept routes', () => {
  const conceptIds = new Set(readdirSync(`${root}src/content/concepts`)
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.slice(0, -3)));
  const detailSource = readFileSync(topicDetail, 'utf8');
  assert.match(detailSource, /\/concepts\/\$\{/);
  assert.ok(conceptIds.has('m1'));
});

test('homepage remains a curated entry point', () => {
  const homepage = readFileSync(`${root}src/pages/index.astro`, 'utf8');
  assert.match(homepage, /href="\/concepts\/m1"/);
  assert.match(homepage, /href="\/concepts\/m2"/);
  assert.doesNotMatch(homepage, /topicRegistry|topics\.map/);
});

test('concept index will expose all three browsing dimensions', () => {
  const source = readFileSync(conceptsIndex, 'utf8');
  for (const name of ['category', 'topic', 'level']) assert.match(source, new RegExp(`name=["']${name}["']`));
  for (const attribute of ['data-category', 'data-topics', 'data-level']) assert.match(source, new RegExp(attribute));
  assert.match(source, /concept-filters/);
});
