import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { fetchVisitorStats, onRequestGet } from '../functions/api/umami-stats.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const layout = readFileSync(`${root}/src/layouts/BaseLayout.astro`, 'utf8');
const component = readFileSync(`${root}/src/components/VisitorStats.astro`, 'utf8');

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

test('fetches cumulative and current-day visitor counts with a server-side bearer key', async () => {
  const requests = [];
  const fakeFetch = async (input, init = {}) => {
    const url = String(input);
    requests.push({ url, headers: Object.fromEntries(new Headers(init.headers)) });
    if (url.endsWith('/daterange')) {
      return jsonResponse({ startDate: '2021-01-01T00:00:00Z', endDate: '2025-09-05T12:00:00Z' });
    }
    const startAt = new URL(url).searchParams.get('startAt');
    return jsonResponse({ visitors: startAt === '1609459200000' ? 1234 : 7 });
  };

  const stats = await fetchVisitorStats({
    UMAMI_API_KEY: 'secret',
    UMAMI_WEBSITE_ID: 'website-id',
    UMAMI_API_ENDPOINT: 'https://api.example.test/v1',
  }, fakeFetch, Date.parse('2026-09-05T04:00:00Z'));

  assert.deepEqual(stats, { totalVisitors: 1234, todayVisitors: 7 });
  assert.equal(requests.length, 3);
  assert.equal(requests[0].url, 'https://api.example.test/v1/websites/website-id/daterange');
  assert.equal(requests[0].headers.authorization, 'Bearer secret');
  assert.deepEqual(requests.slice(1).map(({ url }) => Object.fromEntries(new URL(url).searchParams)), [
    { startAt: '1609459200000', endAt: '1757073600000' },
    { startAt: '1788537600000', endAt: '1788580800000' },
  ]);
});

test('rejects an invalid Umami response shape', async () => {
  const fakeFetch = async () => jsonResponse({ startDate: 'not-a-date', endDate: '2025-09-05T12:00:00Z' });

  await assert.rejects(
    fetchVisitorStats({ UMAMI_API_KEY: 'secret', UMAMI_WEBSITE_ID: 'website-id' }, fakeFetch, Date.now()),
    /invalid.*date range/i,
  );
});

test('returns a generic unavailable response when the API key is missing', async () => {
  const response = await onRequestGet({ env: {} });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Visitor stats unavailable' });
});

test('global layout loads Umami tracking and the visitor stats component', () => {
  assert.match(layout, /https:\/\/cloud\.umami\.is\/script\.js/);
  assert.match(layout, /data-website-id/);
  assert.match(layout, /PUBLIC_UMAMI_WEBSITE_ID/);
  assert.match(layout, /VisitorStats/);
});

test('visitor stats component fetches same-origin data and fails closed', () => {
  assert.match(component, /\/api\/umami-stats/);
  assert.match(component, /totalVisitors/);
  assert.match(component, /todayVisitors/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /hidden/);
});
