# Visitor Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional, failure-safe unique visitor statistics to MacroLens using Cloudflare Pages Functions and Analytics Engine.

**Architecture:** A Pages middleware records only successful HTML `GET` responses. It assigns an anonymous `visitor_id` in an `HttpOnly; Secure; SameSite=Lax` cookie and writes `blob1=visitor_id`, `blob2=Shanghai date`, and `index1=macrolens` to Analytics Engine. A server-side stats function queries `COUNT(DISTINCT blob1)` for total and Shanghai-today counts; a small footer component fetches and displays the result when available.

**Tech Stack:** Astro static output, Cloudflare Pages Functions, Workers Analytics Engine SQL API, TypeScript, Node test runner, `tsx`.

---

### Task 1: Add failing visitor collection and stats tests

**Files:**
- Create: `tests/visitor-statistics.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create this focused test file. The imports target the not-yet-created modules so the first run proves the feature is absent.

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest as onVisitorRequest } from '../functions/_middleware.ts';
import { onRequest as onStatsRequest } from '../functions/api/visitor-stats.ts';

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
    return Response.json({ data: [
      { total: '123', today: '4' },
    ] });
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
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --import tsx --test tests/visitor-statistics.test.mjs`

Expected: FAIL because `functions/_middleware.ts` and `functions/api/visitor-stats.ts` do not exist yet.

- [ ] **Step 3: Commit the red tests**

```bash
git add tests/visitor-statistics.test.mjs
git commit -m "test: define visitor statistics behavior"
```

### Task 2: Implement visitor identity and HTML-only middleware

**Files:**
- Create: `functions/visitor.ts`
- Create: `functions/_middleware.ts`
- Test: `tests/visitor-statistics.test.mjs`

- [ ] **Step 1: Implement `functions/visitor.ts`**

Use local types so tests do not require `@cloudflare/workers-types`. Implement UUID cookie validation, Shanghai date formatting, exact HTML `GET` eligibility, and the required Analytics Engine data model:

```ts
export const VISITOR_COOKIE = 'macrolens_visitor';
export const VISITOR_INDEX = 'macrolens';
export type AnalyticsBinding = { writeDataPoint(point: { blobs: string[]; indexes: string[] }): void };
export type VisitorEnv = { ANALYTICS?: AnalyticsBinding };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseVisitorCookie(request: Request): string | null {
  const raw = request.headers.get('cookie') ?? '';
  const part = raw.split(';').map((value) => value.trim()).find((value) => value.startsWith(`${VISITOR_COOKIE}=`));
  const value = part?.slice(VISITOR_COOKIE.length + 1) ?? '';
  return uuidPattern.test(value) ? value : null;
}

export function createVisitorId(): string { return crypto.randomUUID(); }

export function getShanghaiDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isEligibleVisitorRequest(request: Request, response: Response): boolean {
  const acceptsHtml = (request.headers.get('accept') ?? '').split(',').some((value) => value.trim().toLowerCase() === 'text/html');
  return request.method === 'GET' && acceptsHtml && response.ok && (response.headers.get('content-type') ?? '').toLowerCase().startsWith('text/html');
}

export function visitorDataPoint(visitorId: string, shanghaiDate: string) {
  return { blobs: [visitorId, shanghaiDate], indexes: [VISITOR_INDEX] };
}
```

- [ ] **Step 2: Implement `functions/_middleware.ts`**

Call `next()` first. For an eligible response with `env.ANALYTICS`, reuse a valid cookie or generate a UUID, call `writeDataPoint` without awaiting it, and set this exact cookie for a new ID: `Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`. Catch analytics/cookie errors and always return the downstream response.

```ts
import { VISITOR_COOKIE, createVisitorId, getShanghaiDate, isEligibleVisitorRequest, parseVisitorCookie, visitorDataPoint, type VisitorEnv } from './visitor.ts';

type Context = { request: Request; env: VisitorEnv; next: () => Promise<Response> };

export async function onRequest({ request, env, next }: Context): Promise<Response> {
  const response = await next();
  if (!isEligibleVisitorRequest(request, response) || !env.ANALYTICS) return response;
  try {
    const existingId = parseVisitorCookie(request);
    const visitorId = existingId ?? createVisitorId();
    env.ANALYTICS.writeDataPoint(visitorDataPoint(visitorId, getShanghaiDate()));
    if (existingId) return response;
    const headers = new Headers(response.headers);
    headers.append('Set-Cookie', `${VISITOR_COOKIE}=${visitorId}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch {
    return response;
  }
}
```

- [ ] **Step 3: Run the focused tests and commit**

Run: `node --import tsx --test tests/visitor-statistics.test.mjs`

Expected: all collection tests PASS. Then commit:

```bash
git add functions/visitor.ts functions/_middleware.ts tests/visitor-statistics.test.mjs
git commit -m "feat: record anonymous HTML visitors"
```

### Task 3: Implement the distinct visitor stats API

**Files:**
- Create: `functions/visitor-stats.ts`
- Create: `functions/api/visitor-stats.ts`
- Test: `tests/visitor-statistics.test.mjs`

- [ ] **Step 1: Implement query construction and strict response parsing**

Create `functions/visitor-stats.ts`:

```ts
import { getShanghaiDate } from './visitor.ts';
export type VisitorStats = { available: true; total: number; today: number };

export function visitorStatsQuery(today = getShanghaiDate()): string {
  const safeDate = today.replaceAll("'", "''");
  return `SELECT COUNT(DISTINCT blob1) AS total, COUNT(DISTINCT if(blob2 = '${safeDate}', blob1, NULL)) AS today FROM macrolens_visitors`;
}

export function parseVisitorStats(payload: unknown): VisitorStats | null {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data?: unknown }).data)) return null;
  const rows = (payload as { data: unknown[] }).data;
  if (rows.length !== 1 || !rows[0] || typeof rows[0] !== 'object') return null;
  const row = rows[0] as { total?: unknown; today?: unknown };
  const total = typeof row.total === 'number' ? row.total : Number(row.total);
  const today = typeof row.today === 'number' ? row.today : Number(row.today);
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(today) || today < 0) return null;
  return { available: true, total, today };
}
```

- [ ] **Step 2: Implement `functions/api/visitor-stats.ts`**

Require both server-side credentials. POST the query to the Cloudflare SQL API with a bearer token, return `405` for non-GET, and return `{ available: false }` with `Cache-Control: no-store` for missing configuration, network errors, non-OK responses, invalid JSON, or invalid counts.

```ts
import { parseVisitorStats, visitorStatsQuery } from '../visitor-stats.ts';
type Context = { request: Request; env: { CLOUDFLARE_ACCOUNT_ID?: string; CLOUDFLARE_API_TOKEN?: string } };
const unavailable = () => Response.json({ available: false }, { headers: { 'Cache-Control': 'no-store' } });

export async function onRequest({ request, env }: Context): Promise<Response> {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } });
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) return unavailable();
  try {
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/analytics_engine/sql`;
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'text/plain' },
      body: visitorStatsQuery(),
    });
    if (!upstream.ok) return unavailable();
    const stats = parseVisitorStats(await upstream.json());
    return stats ? Response.json(stats, { headers: { 'Cache-Control': 'no-store' } }) : unavailable();
  } catch {
    return unavailable();
  }
}
```

- [ ] **Step 3: Run focused tests and commit**

Run: `node --import tsx --test tests/visitor-statistics.test.mjs`

Expected: all visitor statistics tests PASS.

```bash
git add functions/visitor-stats.ts functions/api/visitor-stats.ts tests/visitor-statistics.test.mjs
git commit -m "feat: expose unique visitor statistics"
```

### Task 4: Add the optional footer display and deployment documentation

**Files:**
- Create: `src/components/VisitorStats.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/global.css`
- Create: `wrangler.toml`
- Modify: `README.md`

- [ ] **Step 1: Add `src/components/VisitorStats.astro`**

Render hidden placeholders and reveal the container only after a valid successful response. Use `credentials: 'same-origin'`; leave the component hidden for network failures, non-OK responses, unavailable responses, or invalid values.

```astro
<div class="visitor-stats" data-visitor-stats hidden aria-live="polite">
  <span>累计访客 <strong data-total>—</strong></span>
  <span>今日访客 <strong data-today>—</strong></span>
</div>

<script>
  const container = document.querySelector('[data-visitor-stats]');
  const total = container?.querySelector('[data-total]');
  const today = container?.querySelector('[data-today]');
  if (container && total && today) {
    fetch('/api/visitor-stats', { credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then((response) => response.ok ? response.json() : null)
      .then((stats) => {
        if (!stats?.available || !Number.isSafeInteger(stats.total) || stats.total < 0 || !Number.isSafeInteger(stats.today) || stats.today < 0) return;
        total.textContent = stats.total.toLocaleString('zh-CN');
        today.textContent = stats.today.toLocaleString('zh-CN');
        container.hidden = false;
      })
      .catch(() => {});
  }
</script>
```

- [ ] **Step 2: Render and style the component**

Import `VisitorStats` in `src/layouts/BaseLayout.astro` and render it beneath the existing footer sentence. Add `.visitor-stats` rules beside `.site-footer` in `src/styles/global.css` using a small muted flex row with a gap; because the component starts with the `hidden` attribute, unavailable statistics reserve no space.

- [ ] **Step 3: Add `wrangler.toml`**

Create:

```toml
name = "macrolens"
compatibility_date = "2026-09-05"

[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "macrolens_visitors"
```

- [ ] **Step 4: Update README deployment instructions**

Add a “访客统计（可选）” subsection documenting:

```text
ANALYTICS -> macrolens_visitors (Analytics Engine binding)
CLOUDFLARE_ACCOUNT_ID -> Pages Function variable
CLOUDFLARE_API_TOKEN -> Pages Function secret with Account Analytics Read
```

State explicitly that only HTML `GET` requests are recorded, the cookie is anonymous and `HttpOnly; Secure; SameSite=Lax`, and no IP, user-agent, or page-view data is collected. State explicitly that cumulative visitors are unique visitors within the Analytics Engine retention period and do not represent permanent historical cumulative visitors.

- [ ] **Step 5: Commit the UI, configuration, and documentation**

```bash
git add src/components/VisitorStats.astro src/layouts/BaseLayout.astro src/styles/global.css wrangler.toml README.md
git commit -m "feat: show optional visitor statistics in footer"
```

### Task 5: Verify and create the PR

**Files:**
- Modify: implementation files only if a verification command identifies a concrete defect

- [ ] **Step 1: Run focused and full tests**

Run: `node --import tsx --test tests/visitor-statistics.test.mjs`

Expected: all visitor statistics tests PASS.

Run: `npm test`

Expected: all existing and new tests PASS with no failures.

- [ ] **Step 2: Run type checking and production build**

Run: `npm run check`

Expected: Astro check exits successfully with no errors.

Run: `npm run build`

Expected: Astro builds the static site and Pagefind completes successfully.

- [ ] **Step 3: Inspect the final branch**

Run: `git diff origin/main...HEAD --check`

Expected: no whitespace errors.

Run: `git status --short --branch`

Expected: the feature branch is clean.

Run: `git log --oneline origin/main..HEAD`

Expected: the design, tests, middleware, stats API, and UI/config commits are present.

- [ ] **Step 4: Push and create the pull request**

```bash
git push -u origin codex/issue-86-visitor-statistics
gh pr create --repo SwartzMss/MacroLens \
  --base main \
  --head codex/issue-86-visitor-statistics \
  --title "feat: add Cloudflare unique visitor statistics" \
  --body "## Summary
- record anonymous unique visitors through Cloudflare Pages Functions
- store visitor_id and Shanghai date in Analytics Engine blobs
- show retention-window cumulative and today's unique visitor counts when configured
- keep collection optional and failure-safe

## Configuration
- Analytics Engine binding: ANALYTICS -> macrolens_visitors
- Pages Function variable: CLOUDFLARE_ACCOUNT_ID
- Pages Function secret: CLOUDFLARE_API_TOKEN with Account Analytics Read
- cumulative visitors are limited to Analytics Engine's retention period, not permanent history
- no IP, user-agent, or page-view data is collected

## Verification
- npm test
- npm run check
- npm run build

Closes #86"
```

- [ ] **Step 5: Verify the created PR**

Run: `gh pr view --repo SwartzMss/MacroLens --json number,title,url,baseRefName,headRefName,state`

Expected: an open PR from `codex/issue-86-visitor-statistics` into `main`, linked to issue #86.
