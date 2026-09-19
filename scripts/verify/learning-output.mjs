import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { courseOutline, courseLessonHref } from '../../src/data/courseOutline.ts';
import { explorations, explorationHref } from '../../src/data/explorations.ts';
const dist = new URL('../../dist/', import.meta.url);
const read = path => readFileSync(new URL(path, dist), 'utf8');
const index = read('learn/index.html');
assert.ok(existsSync(new URL('404.html', dist)));
assert.equal(existsSync(new URL('learn/macro-foundations/employment/index.html', dist)), false);
assert.match(index, /问题探索/);
if (courseOutline.some(chapter => !chapter.published)) assert.match(index, /正在编写/);
else assert.doesNotMatch(index, /正在编写/);
assert.doesNotMatch(index, /data-learning-card|graph\?node/);
assert.doesNotMatch(index, /data-course-status|进度保存在当前浏览器|开启 JavaScript 后可以保存阅读进度/);
assert.ok(index.includes(`目前已开放 ${courseOutline.filter(chapter => chapter.published).length} 章`));
for (const exploration of explorations) {
  const route = `learn/explore/${exploration.id}/index.html`;
  if (!exploration.published) {
    assert.equal(existsSync(new URL(route, dist)), false);
    assert.ok(!index.includes(`href="${explorationHref(exploration.id)}"`));
    continue;
  }
  assert.ok(index.includes(`href="${explorationHref(exploration.id)}"`));
  assert.ok(index.includes(exploration.title));
  const html = read(route);
  assert.match(html, /data-pagefind-body/);
  assert.match(html, /data-exploration=/);
  assert.doesNotMatch(html, /noindex|concept-long-form|data-course-complete|data-course-lesson/);
  assert.match(html, /这篇只补充一个角度/);
  assert.match(html, /这篇案例有没有帮你拆开这个问题/);
  assert.doesNotMatch(html, /这篇解释对你有帮助吗/);
  assert.doesNotMatch(html, /图表不够清楚/);
  assert.match(html, /假设故事/);
  assert.match(html, /正文参考来源/);
  assert.ok(html.includes(`data-page-id="learn:exploration-${exploration.id}"`));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(decodeURIComponent(match[1])), `Missing anchor: ${match[1]}`);
}
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
  assert.match(html, /class="course-back-link"[^>]*>返回入门主线</);
  assert.doesNotMatch(html, /← 入门主线/);
  assert.doesNotMatch(html, /data-course-status|进度保存在当前浏览器|开启 JavaScript 后可以保存阅读进度/);
  assert.doesNotMatch(html, /noindex|concept-long-form|data-learning-graph-bridge|learnPath=/);
  assert.match(html, /假设(?:故事|贷款|新闻)/);
  assert.match(html, /正文参考来源/);
  assert.doesNotMatch(html, /data-course-complete/);
  assert.match(html, /读完这一章，你能解释开头的问题了吗/);
  assert.doesNotMatch(html, /这篇解释对你有帮助吗/);
  assert.doesNotMatch(html, /图表不够清楚/);
  for (const phrase of ['这一章要弄明白什么', '先记住一个基本方向', '学完后带走']) {
    assert.match(html, new RegExp(phrase));
  }
  if (chapter.id === 'connected-economy') {
    assert.doesNotMatch(html, /先把前面的问题接回来|这是第一章，先从一份早餐开始/);
  } else {
    const recallPosition = html.indexOf('先把前面的问题接回来');
    const goalsPosition = html.indexOf('这一章要弄明白什么');
    assert.ok(recallPosition >= 0 && recallPosition < goalsPosition, `${chapter.id}: recall should precede goals`);
  }
  assert.match(html, /class="course-chapter-nav"/);
  assert.ok(html.includes(`data-page-id="learn:course-${chapter.id}"`));
  const chapterIndex = courseOutline.indexOf(chapter);
  const previous = courseOutline[chapterIndex - 1];
  const next = courseOutline[chapterIndex + 1];
  if (previous?.published) assert.ok(html.includes(`href="${courseLessonHref(previous.id)}"`));
  if (next?.published) assert.ok(html.includes(`href="${courseLessonHref(next.id)}"`));
  if (next && !next.published) assert.ok(!html.includes(`href="${courseLessonHref(next.id)}"`));
  if (next?.published) assert.match(html, /data-course-next/);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(decodeURIComponent(match[1])), `Missing anchor: ${match[1]}`);
}
const capstone = read('learn/course/reading-news/index.html');
for (const phrase of ['完整的假设新闻', '经济活动', '就业与收入', '信用与利率', '政策动作', '综合练习']) {
  assert.match(capstone, new RegExp(phrase));
}
if (process.env.PUBLIC_SITE_URL) {
  const sitemap = read('sitemap-0.xml');
  for (const chapter of courseOutline.filter(chapter => chapter.published)) {
    assert.ok(sitemap.includes(courseLessonHref(chapter.id)));
    assert.ok(read(`learn/course/${chapter.id}/index.html`).includes(`rel="canonical" href="${new URL(courseLessonHref(chapter.id), process.env.PUBLIC_SITE_URL)}"`));
  }
  for (const exploration of explorations.filter(item => item.published)) {
    assert.ok(sitemap.includes(explorationHref(exploration.id)));
    assert.ok(read(`learn/explore/${exploration.id}/index.html`).includes(`rel="canonical" href="${new URL(explorationHref(exploration.id), process.env.PUBLIC_SITE_URL)}"`));
  }
}
console.log('Verified independent courses, unpublished boundaries and anchors.');
