import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { publishedLearningPaths } from '../../src/data/learningPaths.ts';
import { courseOutline, courseLessonHref } from '../../src/data/courseOutline.ts';
const dist = new URL('../../dist/', import.meta.url);
const read = path => readFileSync(new URL(path, dist), 'utf8');
const index = read('learn/index.html');
assert.match(index, /问题探索/);
if (courseOutline.some(chapter => !chapter.published)) assert.match(index, /正在编写/);
else assert.doesNotMatch(index, /正在编写/);
assert.doesNotMatch(index, /data-learning-card|graph\?node/);
assert.ok(index.includes(`目前已开放 ${courseOutline.filter(chapter => chapter.published).length} 章`));
for (const chapter of courseOutline) {
  const route = `learn/course/${chapter.id}/index.html`;
  if (!chapter.published) {
    assert.equal(existsSync(new URL(route, dist)), false);
    assert.ok(!index.includes(`href="${courseLessonHref(chapter.id)}"`));
    continue;
  }
  assert.ok(index.includes(`href="${courseLessonHref(chapter.id)}"`));
  const html = read(route);
  assert.match(html, /data-pagefind-body/);
  assert.doesNotMatch(html, /noindex|concept-long-form|data-learning-graph-bridge|learnPath=/);
  assert.match(html, /假设(?:故事|贷款|新闻)/);
  assert.match(html, /正文参考来源/);
  assert.match(html, /data-course-complete/);
  assert.ok(html.includes(`data-page-id="learn:course-${chapter.id}"`));
  const chapterIndex = courseOutline.indexOf(chapter);
  const previous = courseOutline[chapterIndex - 1];
  const next = courseOutline[chapterIndex + 1];
  if (previous?.published) assert.ok(html.includes(`href="${courseLessonHref(previous.id)}"`));
  if (next?.published) assert.ok(html.includes(`href="${courseLessonHref(next.id)}"`));
  if (next && !next.published) assert.ok(!html.includes(`href="${courseLessonHref(next.id)}"`));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(decodeURIComponent(match[1])), `Missing anchor: ${match[1]}`);
}
for (const path of publishedLearningPaths) {
  for (const route of [`learn/${path.id}/index.html`, ...path.steps.map(step => `learn/${path.id}/${step.id}/index.html`)]) {
    const html = read(route);
    assert.match(html, /data-learning-migration/);
    assert.match(html, /noindex/);
    assert.match(html, /href="\/learn\/"/);
    assert.doesNotMatch(html, /concept-long-form|data-course-complete/);
  }
}
if (process.env.PUBLIC_SITE_URL) {
  const sitemap = read('sitemap-0.xml');
  for (const chapter of courseOutline.filter(chapter => chapter.published)) {
    assert.ok(sitemap.includes(courseLessonHref(chapter.id)));
    assert.ok(read(`learn/course/${chapter.id}/index.html`).includes(`rel="canonical" href="${new URL(courseLessonHref(chapter.id), process.env.PUBLIC_SITE_URL)}"`));
  }
  for (const path of publishedLearningPaths) assert.ok(!sitemap.includes(`/learn/${path.id}/`));
}
console.log('Verified independent courses, unpublished boundaries, anchors and all legacy migration pages.');
