import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { publishedLearningPaths } from '../../src/data/learningPaths.ts';

const dist = new URL('../../dist/', import.meta.url);
const read = path => readFileSync(new URL(path, dist), 'utf8');
const body = html => html.match(/<div class="concept-long-form-content">([\s\S]*?)<\/div>\s*<\/details>/)?.[1];
const ids = html => [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
let checked = 0;
for (const path of publishedLearningPaths) {
  const overview = read(`learn/${path.id}/index.html`);
  assert.match(overview, /data-pagefind-body/);
  for (const [index, step] of path.steps.entries()) {
    const html = read(`learn/${path.id}/${step.id}/index.html`);
    assert.match(html, /name="robots" content="noindex,nofollow"/);
    assert.doesNotMatch(html, /data-pagefind-body/);
    assert.match(html, new RegExp(`data-learning-step="${step.id}"`));
    assert.ok(html.includes(`第 ${index + 1} / ${path.steps.length} 步`));
    assert.equal(new Set(ids(html)).size, ids(html).length, `${path.id}/${step.id}: duplicate anchors`);
    for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids(html).includes(decodeURIComponent(match[1])), `${path.id}/${step.id}: broken anchor ${match[1]}`);
    const next = path.steps[index + 1];
    if (next) assert.ok(html.includes(`href="/learn/${path.id}/${next.id}/"`));
    if (step.kind === 'concept') {
      const canonical = read(`concepts/${step.conceptId}/index.html`);
      assert.ok(body(html), `missing content: ${step.id}`);
      assert.equal(body(html), body(canonical), `learning content diverges: ${step.id}`);
      const data = `id="${step.conceptId}-data"`;
      assert.ok(!html.includes(data), `learning page exposes data: ${step.id}`);
      assert.ok(!html.includes(`id="${step.conceptId}-sources"`));
      assert.ok(!html.includes(`id="${step.conceptId}-connections"`));
      assert.doesNotMatch(html, /class="knowledge-overview"/);
      assert.match(html, /class="learning-concept-link"/);
      assert.ok(html.includes(`href="/concepts/${step.conceptId}/"`));
      assert.ok(html.indexOf('class="learning-actions"') < html.indexOf('class="learning-concept-link"'));
      const relation = html.match(/<section class="learning-core-relation"[\s\S]*?<\/section>/)?.[0];
      if (step.conceptId === 'policy-rate') assert.ok(relation, 'policy-rate must retain its core relation');
      if (relation) {
        assert.doesNotMatch(relation, /<a\b/);
        assert.match(relation, /适用条件/);
        assert.match(relation, /解读边界/);
      }
      assert.ok(html.indexOf('class="learning-actions"') < html.indexOf('data-page-feedback'));
      if (process.env.PUBLIC_SITE_URL) assert.ok(html.includes(`rel="canonical" href="${new URL(`/concepts/${step.conceptId}/`, process.env.PUBLIC_SITE_URL)}"`));
    }
    checked++;
  }
}
assert.match(read('topics/index.html'), /\/learn\//);
if (process.env.PUBLIC_SITE_URL) {
  const sitemap = read('sitemap-0.xml');
  assert.doesNotMatch(sitemap, /<loc>[^<]*\/learn\/[^/<]+\/[^/<]+\//);
  assert.ok(sitemap.includes('/learn/'));
}
console.log(`Verified ${checked} learning steps: content reuse, links, anchors, progress context and index boundaries.`);
