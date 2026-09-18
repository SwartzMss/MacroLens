import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest as onPageStatsRequest } from '../functions/api/page-stats.ts';
import { learningArticleIdForPath, normalizeConceptPath, normalizePathname } from '../functions/visitor.ts';
import { combinePageStats, pageStatsQueries, parsePageStats, visitorStatsQueries } from '../functions/visitor-stats.ts';

const request = () => new Request('https://macrolens.example/api/page-stats');
const credentials = { CLOUDFLARE_ACCOUNT_ID: 'account', CLOUDFLARE_API_TOKEN: 'token' };

test('normalizes pathname identity without query, fragment, duplicate, or trailing slashes', () => {
  assert.equal(normalizePathname('/concepts/gdp/?utm_source=home#chart'), '/concepts/gdp');
  assert.equal(normalizePathname('//concepts//gdp///'), '/concepts/gdp');
  assert.equal(normalizePathname('/'), '/');
  assert.equal(normalizeConceptPath('/concepts/m2/'), '/concepts/m2');
  assert.equal(normalizeConceptPath('/topics/money'), null);
  assert.equal(normalizeConceptPath('/concepts/'), null);
  assert.equal(learningArticleIdForPath('/learn/macro-foundations/gdp/'), 'learn:gdp');
  assert.equal(learningArticleIdForPath('/learn/explore/why-rate-cuts-dont-boost-loans/'), 'learn:exploration-why-rate-cuts-dont-boost-loans');
  assert.equal(learningArticleIdForPath('/learn/money-credit/m2/?from=route'), 'learn:m2');
  assert.equal(learningArticleIdForPath('/learn/money-credit/recap/'), null);
});

test('writes learning-article queries with distinct visitors and Shanghai date', () => {
  const queries = pageStatsQueries('2026-09-06');
  assert.match(queries.total, /COUNT\s*\(DISTINCT\s+blob1\)/i);
  assert.match(queries.total, /blob4\s+LIKE\s+'learn:%'/i);
  assert.match(queries.total, /GROUP\s+BY\s+blob4/i);
  assert.match(queries.total, /ORDER\s+BY\s+total\s+DESC/i);
  assert.match(queries.today, /blob2\s*=\s*'2026-09-06'/i);
  assert.match(queries.today, /ORDER\s+BY\s+today\s+DESC/i);
  assert.doesNotMatch(queries.total, /blob1\s+LIKE/i);
  assert.doesNotMatch(queries.total, /blob2\s+LIKE/i);
});

test('keeps site-level visitor queries unchanged', () => {
  const queries = visitorStatsQueries('2026-09-06');
  assert.deepEqual(queries, {
    total: 'SELECT COUNT(DISTINCT blob1) AS total FROM macrolens_visitors',
    today: "SELECT COUNT(DISTINCT blob1) AS today FROM macrolens_visitors WHERE blob2 = '2026-09-06'",
  });
});

test('parses page aggregates and combines today counts by stable article ID', () => {
  const total = parsePageStats({ data: [
    { page_id: 'learn:gdp', total: '2' },
    { page_id: 'learn:m2', total: 1 },
  ] }, 'total');
  const today = parsePageStats({ data: [
    { page_id: 'learn:gdp', today: '1' },
  ] }, 'today');
  assert.deepEqual(combinePageStats(total, today), [
    { pageId: 'learn:gdp', total: 2, today: 1 },
    { pageId: 'learn:m2', total: 1, today: 0 },
  ]);
});

test('fails closed for missing pathname, invalid counts, and duplicate normalized paths', () => {
  assert.equal(parsePageStats({ data: [{ total: '2' }] }, 'total'), null);
  assert.equal(parsePageStats({ data: [{ page_id: 'learn:gdp', total: '-1' }] }, 'total'), null);
  assert.equal(parsePageStats({ data: [
    { page_id: 'learn:gdp', total: '1' },
    { page_id: 'learn:gdp', total: '1' },
  ] }, 'total'), null);
});

test('returns page UV totals and today counts without exposing visitor identities', async () => {
  const originalFetch = globalThis.fetch;
  const queries = [];
  globalThis.fetch = async (_input, init) => {
    const sql = String(init.body);
    queries.push(sql);
    if (/AS total/i.test(sql)) return Response.json({ data: [
      { page_id: 'learn:gdp', total: '2' },
      { page_id: 'learn:m2', total: '1' },
    ] });
    return Response.json({ data: [
      { page_id: 'learn:gdp', today: '1' },
    ] });
  };
  try {
    const response = await onPageStatsRequest({ request: request(), env: credentials });
    assert.deepEqual(await response.json(), {
      available: true,
      pages: [
        { pageId: 'learn:gdp', total: 2, today: 1 },
        { pageId: 'learn:m2', total: 1, today: 0 },
      ],
    });
    assert.equal(response.headers.get('cache-control'), 'public, max-age=60, s-maxage=300');
    assert.equal(queries.length, 2);
    assert.ok(queries.every((sql) => /COUNT\s*\(DISTINCT\s+blob1\)/i.test(sql)));
    assert.ok(queries.every((sql) => /blob4\s+LIKE\s+'learn:%'/i.test(sql)));
    assert.ok(queries.every((sql) => !/visitor_id|ip|user-agent|referrer/i.test(sql)));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns unavailable for missing credentials, non-GET, upstream failure, and malformed data', async () => {
  const missing = await onPageStatsRequest({ request: request(), env: {} });
  assert.deepEqual(await missing.json(), { available: false });

  const method = await onPageStatsRequest({
    request: new Request('https://macrolens.example/api/page-stats', { method: 'POST' }),
    env: credentials,
  });
  assert.equal(method.status, 405);
  assert.equal(method.headers.get('allow'), 'GET');

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('failure', { status: 500 });
    const failed = await onPageStatsRequest({ request: request(), env: credentials });
    assert.deepEqual(await failed.json(), { available: false });
    assert.equal(failed.headers.get('cache-control'), 'no-store');

    globalThis.fetch = async () => Response.json({ data: [{ path: '/topics/money', total: '1' }] });
    const malformed = await onPageStatsRequest({ request: request(), env: credentials });
    assert.deepEqual(await malformed.json(), { available: false });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
