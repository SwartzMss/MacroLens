import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { feedbackStatsQuery, onRequest as onFeedbackStatsRequest, parseFeedbackStats } from '../functions/api/feedback-stats.ts';

const request = (method = 'GET') => new Request('https://macrolens.example/api/feedback-stats', { method });

const database = (results) => ({
  prepare(sql) {
    assert.match(sql, /FROM\s+page_feedback/i);
    return {
      async all() {
        return { results };
      },
    };
  },
});

test('feedback aggregate query exposes only per-page counts', () => {
  const sql = feedbackStatsQuery();
  assert.match(sql, /GROUP\s+BY\s+page_id/i);
  assert.match(sql, /COUNT\s*\(\*\)/i);
  assert.match(sql, /vote\s*=\s*1/i);
  assert.match(sql, /vote\s*=\s*-1/i);
  assert.doesNotMatch(sql, /visitor_id/i);
});

test('parses aggregate feedback and computes helpful rate', () => {
  assert.deepEqual(parseFeedbackStats({ results: [
    { page_id: 'gdp', feedback_count: '20', helpful: '15', needs_improvement: '5' },
    { page_id: 'm1', feedback_count: 3, helpful: 3, needs_improvement: 0 },
  ] }), [
    { pageId: 'gdp', feedbackCount: 20, helpful: 15, needsImprovement: 5, helpfulRate: 75 },
    { pageId: 'm1', feedbackCount: 3, helpful: 3, needsImprovement: 0, helpfulRate: 100 },
  ]);
});

test('rejects malformed aggregate rows', () => {
  assert.equal(parseFeedbackStats({ results: [{ page_id: '../bad', feedback_count: 1, helpful: 1, needs_improvement: 0 }] }), null);
  assert.equal(parseFeedbackStats({ results: [{ page_id: 'gdp', feedback_count: 2, helpful: 2, needs_improvement: 1 }] }), null);
  assert.equal(parseFeedbackStats({ results: null }), null);
});

test('feedback stats endpoint returns aggregate data without visitor IDs', async () => {
  const response = await onFeedbackStatsRequest({
    request: request(),
    env: { FEEDBACK_DB: database([
      { page_id: 'gdp', feedback_count: 4, helpful: 3, needs_improvement: 1 },
    ]) },
  });
  const body = await response.json();
  assert.deepEqual(body, {
    available: true,
    pages: [{ pageId: 'gdp', feedbackCount: 4, helpful: 3, needsImprovement: 1, helpfulRate: 75 }],
  });
  assert.equal(response.headers.get('cache-control'), 'public, max-age=60, s-maxage=300');
  assert.doesNotMatch(JSON.stringify(body), /visitor/i);
});

test('feedback stats endpoint fails closed and stays GET-only', async () => {
  const missing = await onFeedbackStatsRequest({ request: request(), env: {} });
  assert.deepEqual(await missing.json(), { available: false });
  assert.equal(missing.headers.get('cache-control'), 'no-store');

  const method = await onFeedbackStatsRequest({ request: request('POST'), env: {} });
  assert.equal(method.status, 405);
  assert.equal(method.headers.get('allow'), 'GET');

  const failed = await onFeedbackStatsRequest({
    request: request(),
    env: {
      FEEDBACK_DB: {
        prepare() {
          return { all: async () => { throw new Error('db unavailable'); } };
        },
      },
    },
  });
  assert.deepEqual(await failed.json(), { available: false });
});

test('stats page is noindex, Pagefind-ignored, and uses all three aggregate APIs', async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL('../src/pages/stats.astro', import.meta.url), 'utf8'),
    readFile(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /noindex=\{true\}/);
  assert.match(page, /data-pagefind-ignore/);
  assert.match(page, /\/api\/visitor-stats/);
  assert.match(page, /\/api\/page-stats/);
  assert.match(page, /\/api\/feedback-stats/);
  assert.match(page, /feedbackCount\s*<\s*5/);
  assert.match(page, /helpfulRate\s*<\s*70/);
  assert.match(page, /helpfulRate\s*>=\s*85/);
  assert.match(layout, /name="robots"\s+content="noindex,nofollow"/);
});

test('README records the operational stats viewing workflow', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /### 如何查看统计/);
  assert.match(readme, /\/stats/);
  assert.match(readme, /\/api\/page-stats/);
  assert.match(readme, /\/api\/visitor-stats/);
  assert.match(readme, /\/api\/feedback-stats/);
  assert.match(readme, /page_feedback/);
  assert.match(readme, /不是鉴权边界/);
});
