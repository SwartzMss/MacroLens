import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { onRequest as onVisitorRequest } from '../functions/_middleware.ts';
import { onRequest as onStatsRequest } from '../functions/api/visitor-stats.ts';

const visitorComponent = fileURLToPath(new URL('../src/components/VisitorStats.astro', import.meta.url));
const baseLayout = fileURLToPath(new URL('../src/layouts/BaseLayout.astro', import.meta.url));
const globalStyles = fileURLToPath(new URL('../src/styles/global.css', import.meta.url));
const readme = fileURLToPath(new URL('../README.md', import.meta.url));
const wrangler = fileURLToPath(new URL('../wrangler.toml', import.meta.url));

const analytics = () => ({
  points: [],
  writeDataPoint(point) { this.points.push(point); },
});
const htmlResponse = () => new Response('<html></html>', {
  headers: { 'content-type': 'text/html; charset=utf-8' },
});

test('records an HTML GET with blob1 visitor id, blob2 Shanghai date, and fixed index', async () => {
  const binding = analytics();
  const response = await onVisitorRequest({
    request: new Request('https://macrolens.example/concepts/gdp', {
      headers: { accept: 'text/html,application/xhtml+xml' },
    }),
    env: { ANALYTICS: binding },
    next: async () => htmlResponse(),
  });
  assert.equal(binding.points.length, 1);
  assert.deepEqual(binding.points[0].indexes, ['macrolens']);
  assert.match(binding.points[0].blobs[0], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.match(binding.points[0].blobs[1], /^\d{4}-\d{2}-\d{2}$/);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /macrolens_visitor=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
});

test('reuses an existing valid visitor cookie without setting another one', async () => {
  const binding = analytics();
  const visitorId = '123e4567-e89b-42d3-a456-426614174000';
  const response = await onVisitorRequest({
    request: new Request('https://macrolens.example/', {
      headers: { accept: 'text/html', cookie: `macrolens_visitor=${visitorId}` },
    }),
    env: { ANALYTICS: binding },
    next: async () => htmlResponse(),
  });
  assert.equal(binding.points[0].blobs[0], visitorId);
  assert.equal(response.headers.has('set-cookie'), false);
});

test('does not write for non-HTML requests or responses', async () => {
  const cases = [
    { request: new Request('https://macrolens.example/app.js', { headers: { accept: '*/*' } }), response: htmlResponse() },
    { request: new Request('https://macrolens.example/', { method: 'POST', headers: { accept: 'text/html' } }), response: htmlResponse() },
    { request: new Request('https://macrolens.example/data.json', { headers: { accept: 'text/html' } }), response: new Response('{}', { headers: { 'content-type': 'application/json' } }) },
  ];
  for (const { request, response } of cases) {
    const binding = analytics();
    await onVisitorRequest({ request, env: { ANALYTICS: binding }, next: async () => response });
    assert.equal(binding.points.length, 0);
  }
  const binding = analytics();
  await onVisitorRequest({
    request: new Request('https://macrolens.example/missing', { headers: { accept: 'text/html' } }),
    env: { ANALYTICS: binding },
    next: async () => new Response('<html>missing</html>', { status: 404, headers: { 'content-type': 'text/html' } }),
  });
  assert.equal(binding.points.length, 0);
});

test('leaves an HTML response working when the Analytics binding is absent', async () => {
  const response = await onVisitorRequest({
    request: new Request('https://macrolens.example/', { headers: { accept: 'text/html' } }),
    env: {},
    next: async () => htmlResponse(),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.has('set-cookie'), false);
});

test('returns total and today from distinct blob1 counts', async () => {
  const originalFetch = globalThis.fetch;
  let query = '';
  globalThis.fetch = async (_input, init) => {
    query = String(init.body);
    return Response.json({ data: [{ total: '123', today: '4' }] });
  };
  try {
    const response = await onStatsRequest({
      request: new Request('https://macrolens.example/api/visitor-stats'),
      env: { CLOUDFLARE_ACCOUNT_ID: 'account', CLOUDFLARE_API_TOKEN: 'token' },
    });
    assert.deepEqual(await response.json(), { available: true, total: 123, today: 4 });
    assert.match(query, /COUNT\s*\(DISTINCT\s+blob1\)/i);
    assert.doesNotMatch(query, /UNION/i);
    assert.match(query, /FROM\s+macrolens_visitors/i);
    assert.match(query, /blob2\s*=/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns unavailable for missing credentials, upstream failure, and invalid counts', async () => {
  const missing = await onStatsRequest({
    request: new Request('https://macrolens.example/api/visitor-stats'), env: {},
  });
  assert.deepEqual(await missing.json(), { available: false });
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('failure', { status: 500 });
    const failed = await onStatsRequest({
      request: new Request('https://macrolens.example/api/visitor-stats'),
      env: { CLOUDFLARE_ACCOUNT_ID: 'account', CLOUDFLARE_API_TOKEN: 'token' },
    });
    assert.deepEqual(await failed.json(), { available: false });
    globalThis.fetch = async () => Response.json({ data: [{ total: '-1', today: '0' }] });
    const malformed = await onStatsRequest({
      request: new Request('https://macrolens.example/api/visitor-stats'),
      env: { CLOUDFLARE_ACCOUNT_ID: 'account', CLOUDFLARE_API_TOKEN: 'token' },
    });
    assert.deepEqual(await malformed.json(), { available: false });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('footer integration stays optional and documents the privacy and retention contract', () => {
  const component = readFileSync(visitorComponent, 'utf8');
  const layout = readFileSync(baseLayout, 'utf8');
  const styles = readFileSync(globalStyles, 'utf8');
  const docs = readFileSync(readme, 'utf8');
  const config = readFileSync(wrangler, 'utf8');
  assert.match(component, /data-visitor-stats/);
  assert.match(component, /credentials:\s*['"]same-origin['"]/);
  assert.match(component, /toLocaleString\(['"]zh-CN['"]\)/);
  assert.match(layout, /VisitorStats/);
  assert.ok(layout.indexOf('<VisitorStats />') < layout.indexOf('MacroLens ·'), 'visitor stats should precede the footer copy');
  assert.match(styles, /\.visitor-stats/);
  assert.match(config, /binding\s*=\s*["']ANALYTICS["']/);
  assert.match(config, /dataset\s*=\s*["']macrolens_visitors["']/);
  assert.match(docs, /累计访客/);
  assert.match(docs, /保留周期/);
  assert.match(docs, /不代表永久历史累计/);
  assert.match(docs, /HttpOnly.*Secure.*SameSite=Lax/s);
  assert.match(docs, /IP.*UA|IP.*user-agent/i);
  assert.match(docs, /page views|page-view|页面访问次数/i);
});
