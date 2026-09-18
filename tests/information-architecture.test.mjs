import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { topicIds, topicRegistry } from '../src/data/topics.ts';
import { courseOutline } from '../src/data/courseOutline.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
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
  const config = readFileSync(`${root}astro.config.mjs`, 'utf8');
  assert.match(config, /['"]\/topics['"]:\s*['"]\/learn\/['"]/);
  assert.equal(existsSync(`${root}src/pages/learn/index.astro`), true, 'learning index route is missing');
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

test('learning entry separates available lessons, the outline and independent exploration', () => {
  const source = readFileSync(`${root}src/pages/learn/index.astro`, 'utf8');
  for (const text of ['入门主线', '问题探索', '正在编写', 'chapter.published']) assert.ok(source.includes(text));
  assert.doesNotMatch(source, /可以开始|data-course-marker/);
  assert.doesNotMatch(source, /ConceptReader|conceptId|LearningCard/);
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
  assert.match(homepage, /LearningPaths/);
  assert.ok(courseOutline.some(chapter => chapter.published));
  assert.doesNotMatch(homepage, /topicRegistry|topics\.map/);
});

test('concept index will expose all three browsing dimensions', () => {
  const source = readFileSync(conceptsIndex, 'utf8');
  const filters = readFileSync(`${root}src/scripts/concept-filters.ts`, 'utf8');
  for (const name of ['category', 'topic', 'level']) assert.match(source, new RegExp(`name=["']${name}["']`));
  for (const attribute of ['data-category', 'data-topics', 'data-level']) assert.match(source, new RegExp(attribute));
  assert.match(source, /concept-filters/);
  assert.match(source, /concept-quick-nav/);
  assert.match(filters, /URLSearchParams/);
  assert.match(filters, /history\.pushState/);
  assert.match(filters, /popstate/);
});

test('knowledge library and global search stay separate', () => {
  const index = readFileSync(conceptsIndex, 'utf8');
  const search = readFileSync(`${root}src/pages/search.astro`, 'utf8');
  const searchStyles = readFileSync(`${root}src/styles/search.css`, 'utf8');
  const reader = readFileSync(`${root}src/components/ConceptReader.astro`, 'utf8');

  assert.doesNotMatch(index, /class="concept-search"/);
  assert.match(index, /concept-filter-panel/);
  assert.match(index, /index-card-tags/);
  assert.match(index, /data-category-section/);
  assert.doesNotMatch(search, /triggerFilters\(\{content:'concept'\}\)/);
  assert.match(search, /triggerSearch\(query\)/);
  assert.match(search, /搜索 MacroLens/);
  assert.match(search, /例如：M2 为什么不等于通胀/);
  assert.match(search, /showSubResults:true/);
  assert.doesNotMatch(search, /返回知识库/);
  assert.doesNotMatch(search, /只搜索知识库内容/);
  assert.match(searchStyles, /pagefind-ui__result/);
  assert.match(reader, /data-pagefind-filter="content:concept"/);
});
