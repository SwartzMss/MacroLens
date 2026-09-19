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

test('feedback aggregate query exposes per-page counts and reason totals', () => {
  const sql = feedbackStatsQuery();
  assert.match(sql, /GROUP\s+BY\s+page_id/i);
  assert.match(sql, /COUNT\s*\(\*\)/i);
  assert.match(sql, /vote\s*=\s*1/i);
  assert.match(sql, /vote\s*=\s*-1/i);
  assert.match(sql, /reason_too_complex/i);
  assert.match(sql, /reason_sequence_jump/i);
  assert.doesNotMatch(sql, /visitor_id/i);
});

test('parses aggregate feedback and computes helpful rate', () => {
  assert.deepEqual(parseFeedbackStats({ results: [
    { page_id: 'learn:gdp', feedback_count: '20', helpful: '15', needs_improvement: '5', reason_too_complex: 2, reason_sequence_jump: 1, reason_missing_example: 1, reason_missing_step: 1, reason_questionable: 0, reason_unclear_chart: 0, reason_incomplete: 0 },
    { page_id: 'learn:m1', feedback_count: 3, helpful: 3, needs_improvement: 0, reason_too_complex: 0, reason_sequence_jump: 0, reason_missing_example: 0, reason_missing_step: 0, reason_questionable: 0, reason_unclear_chart: 0, reason_incomplete: 0 },
  ] }), [
    { pageId: 'learn:gdp', feedbackCount: 20, helpful: 15, needsImprovement: 5, helpfulRate: 75, reasons: { too_complex: 2, sequence_jump: 1, missing_example: 1, missing_step: 1, questionable: 0, unclear_chart: 0, incomplete: 0 } },
    { pageId: 'learn:m1', feedbackCount: 3, helpful: 3, needsImprovement: 0, helpfulRate: 100, reasons: { too_complex: 0, sequence_jump: 0, missing_example: 0, missing_step: 0, questionable: 0, unclear_chart: 0, incomplete: 0 } },
  ]);
});

test('rejects malformed aggregate rows', () => {
  assert.equal(parseFeedbackStats({ results: [{ page_id: 'learn:../bad', feedback_count: 1, helpful: 1, needs_improvement: 0 }] }), null);
  assert.equal(parseFeedbackStats({ results: [{ page_id: 'learn:gdp', feedback_count: 2, helpful: 2, needs_improvement: 1 }] }), null);
  assert.equal(parseFeedbackStats({ results: [{ page_id: 'learn:gdp', feedback_count: 2, helpful: 1, needs_improvement: 1, reason_too_complex: 2, reason_sequence_jump: 0, reason_missing_example: 0, reason_missing_step: 0, reason_questionable: 0, reason_unclear_chart: 0, reason_incomplete: 0 }] }), null);
  assert.equal(parseFeedbackStats({ results: null }), null);
});

test('feedback stats endpoint returns aggregate data without visitor IDs', async () => {
  const response = await onFeedbackStatsRequest({
    request: request(),
    env: { FEEDBACK_DB: database([
      { page_id: 'learn:gdp', feedback_count: 4, helpful: 3, needs_improvement: 1, reason_too_complex: 1, reason_sequence_jump: 0, reason_missing_example: 0, reason_missing_step: 0, reason_questionable: 0, reason_unclear_chart: 0, reason_incomplete: 0 },
    ]) },
  });
  const body = await response.json();
  assert.deepEqual(body, {
    available: true,
    pages: [{ pageId: 'learn:gdp', feedbackCount: 4, helpful: 3, needsImprovement: 1, helpfulRate: 75, reasons: { too_complex: 1, sequence_jump: 0, missing_example: 0, missing_step: 0, questionable: 0, unclear_chart: 0, incomplete: 0 } }],
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

test('stats page is noindex, hides public navigation, and uses all four aggregate APIs', async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL('../src/pages/stats.astro', import.meta.url), 'utf8'),
    readFile(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /noindex=\{true\}/);
  assert.match(page, /data-pagefind-ignore/);
  assert.match(page, /\/api\/visitor-stats/);
  assert.match(page, /\/api\/page-stats/);
  assert.match(page, /\/api\/feedback-stats/);
  assert.match(page, /\/api\/module-stats/);
  assert.match(page, /模块访问概览/);
  assert.match(page, /data-module-id/);
  assert.match(page, /hideNavigation=\{true\}/);
  assert.match(page, /feedbackCount\s*<\s*5/);
  assert.match(page, /helpfulRate\s*<\s*70/);
  assert.match(page, /helpfulRate\s*>=\s*85/);
  assert.match(page, /反馈原因/);
  assert.match(page, /data-stats-reason/);
  assert.match(page, /data-stats-reasons/);
  assert.match(page, /当前反馈少于 5 条，仅作待观察/);
  assert.match(page, /原因数量用于定位内容问题，不代表学习得分/);
  assert.match(layout, /name="robots"\s+content="noindex,nofollow"/);
  assert.match(layout, /hideNavigation/);
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
