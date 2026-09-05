# Umami Analytics Visitor Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Umami Cloud tracking to every page and show cumulative and current-day unique visitor counts without exposing the Umami API key to browsers.

**Architecture:** Keep the static Astro site responsible for markup and tracking-script injection. Add a Cloudflare Pages Function at `/api/umami-stats` that reads `UMAMI_API_KEY`, `UMAMI_WEBSITE_ID`, and an optional API endpoint from server-side bindings, queries Umami's date range and stats endpoints, and returns only the two visitor counts needed by the UI. The footer component fetches that same-origin endpoint after hydration and hides itself when statistics are not configured or unavailable.

**Tech Stack:** Astro static output, Cloudflare Pages Functions, TypeScript, browser `fetch`, Node test runner with `tsx`, Umami Cloud REST API v1.

---

## File map

- Create `functions/api/umami-stats.ts`: validate configuration, derive the current Asia/Shanghai day boundary, query Umami Cloud with a server-side Bearer key, and return `{ totalVisitors, todayVisitors }` or a non-sensitive error response.
- Create `src/components/VisitorStats.astro`: render an initially hidden, accessible footer block and fetch the same-origin stats endpoint after page load.
- Create `src/styles/visitor-stats.css`: style the compact footer statistics block without changing existing layout tokens.
- Modify `src/layouts/BaseLayout.astro`: inject the provided Umami tracking script and render `VisitorStats` in the global footer.
- Modify `README.md`: document required Cloudflare Pages variables and the optional API endpoint override.
- Create `tests/umami.test.mjs`: test the Pages Function's URL construction, auth header, visitor-count mapping, current-day boundary, and missing-configuration behavior; test the Astro integration markup contract.

## Runtime contract

- Tracking uses `https://cloud.umami.is/script.js` and the issue-provided website ID as the build-time default. `PUBLIC_UMAMI_WEBSITE_ID` can override that ID for preview or fork deployments.
- The Pages Function defaults to `UMAMI_WEBSITE_ID` equal to the issue-provided ID, `UMAMI_API_ENDPOINT` equal to `https://api.umami.is/v1`, and requires `UMAMI_API_KEY` before making any external request.
- The function first calls `GET /websites/{websiteId}/daterange`, then calls `GET /websites/{websiteId}/stats` for the full available range and for the current Asia/Shanghai calendar day. It maps the `visitors` field from each response; it does not add daily visitor counts together.
- Missing configuration returns HTTP 503 with `{ "error": "Visitor stats unavailable" }`. Upstream failures return HTTP 502 with the same generic body. API keys, upstream bodies, and internal error details never reach the client.
- Successful responses use `Cache-Control: public, max-age=300, s-maxage=300` and return `{ totalVisitors, todayVisitors }` as non-negative integers.

## Implementation tasks

### Task 1: Add failing contract tests for the Umami function and page integration

**Files:**
- Create: `tests/umami.test.mjs`

- [ ] **Step 1: Write the failing function tests**

Add tests that import `fetchVisitorStats` and `onRequestGet` from `functions/api/umami-stats.ts`. Use a fake fetcher that records requests and returns deterministic JSON for `/daterange` and `/stats`. Assert that:

```js
const result = await fetchVisitorStats({
  UMAMI_API_KEY: 'secret',
  UMAMI_WEBSITE_ID: 'website-id',
  UMAMI_API_ENDPOINT: 'https://api.example.test/v1',
}, fakeFetch, Date.parse('2026-09-05T04:00:00Z'));

assert.deepEqual(result, { totalVisitors: 1234, todayVisitors: 7 });
assert.equal(requests[0].url, 'https://api.example.test/v1/websites/website-id/daterange');
assert.equal(requests[0].headers.Authorization, 'Bearer secret');
assert.match(requests[1].url, /\/stats\?startAt=1609459200000&endAt=1757073600000/);
assert.match(requests[2].url, /\/stats\?startAt=1788537600000&endAt=1788580800000/);
```

Use a date-range response covering `2021-01-01T00:00:00Z` to `2025-09-05T12:00:00Z`; use the fixed test clock to make the full-range and Asia/Shanghai day-boundary timestamps deterministic. Add tests that `fetchVisitorStats` throws a diagnostic error for an invalid response shape and that `onRequestGet` returns HTTP 503 without calling the fetcher when `UMAMI_API_KEY` is absent.

- [ ] **Step 2: Add the Astro markup contract assertions**

Read `src/layouts/BaseLayout.astro` and `src/components/VisitorStats.astro` as source text. Assert the layout contains the Cloudflare/Umami script URL, `data-website-id`, and `VisitorStats`; assert the component contains the `/api/umami-stats` endpoint, `totalVisitors`, `todayVisitors`, `aria-live`, and a hidden/failure-safe state.

- [ ] **Step 3: Run the focused test file and confirm RED**

Run:

```bash
node --import tsx tests/umami.test.mjs
```

Expected: FAIL because the Pages Function and `VisitorStats.astro` do not exist yet.

### Task 2: Implement the server-side Umami statistics function

**Files:**
- Create: `functions/api/umami-stats.ts`

- [ ] **Step 1: Define the environment, response, and fetcher types**

Use a small local type boundary so the function can be tested without Cloudflare-specific packages:

```ts
export type UmamiEnv = {
  UMAMI_API_KEY?: string;
  UMAMI_WEBSITE_ID?: string;
  UMAMI_API_ENDPOINT?: string;
};

export type VisitorStats = {
  totalVisitors: number;
  todayVisitors: number;
};

type Fetcher = typeof fetch;
```

Keep the default website ID in one constant and trim trailing slashes from the endpoint before constructing URLs.

- [ ] **Step 2: Implement date and response helpers**

Implement `startOfShanghaiDay(now)` by shifting the timestamp by eight hours, taking UTC midnight of the shifted date, and shifting back. Implement `asNonNegativeInteger(value, field)` to reject missing, non-numeric, negative, or non-integer visitor values. Implement a JSON fetch helper that sends `Accept: application/json` and `Authorization: Bearer <key>`, checks `response.ok`, parses JSON, and throws an internal error without including the response body.

- [ ] **Step 3: Implement `fetchVisitorStats`**

Resolve endpoint and website ID from environment defaults. If no API key exists, throw `Umami configuration is unavailable`. Fetch the date range, validate `startDate` and `endDate`, fetch full-range stats and current-day stats, and return the two validated `visitors` counts. Use `Math.min(Date.now(), endDate)` for the full-range end and current time for today's end, with the current-day start from `startOfShanghaiDay(now)`.

- [ ] **Step 4: Implement the Pages Function handler**

Export:

```ts
export const onRequestGet = async ({ env }: { env: UmamiEnv }): Promise<Response> => {
  try {
    const stats = await fetchVisitorStats(env);
    return new Response(JSON.stringify(stats), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (error) {
    const status = error instanceof Error && error.message === 'Umami configuration is unavailable' ? 503 : 502;
    return new Response(JSON.stringify({ error: 'Visitor stats unavailable' }), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
};
```

Do not return exception messages or upstream response bodies.

- [ ] **Step 5: Run the focused tests and confirm GREEN**

Run `node --import tsx tests/umami.test.mjs`; expect all function tests to pass.

### Task 3: Add the global tracking script and visitor statistics footer

**Files:**
- Create: `src/components/VisitorStats.astro`
- Create: `src/styles/visitor-stats.css`
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Implement the client component**

Render a `<div class="visitor-stats" data-visitor-stats hidden aria-live="polite">` with two labeled values and an unavailable fallback. On `DOMContentLoaded` (or immediately when the script executes), fetch `/api/umami-stats`, require integer `totalVisitors` and `todayVisitors`, format them with `Intl.NumberFormat('zh-CN')`, set the values, and remove `hidden`. On any failure leave the block hidden. Do not include any API credential or Umami endpoint in browser code.

- [ ] **Step 2: Add compact footer styles**

Import a focused stylesheet from the component. Use existing `--muted`, `--line`, and `--green` variables; keep the component unobtrusive and responsive. Do not change the global footer layout beyond allowing the stats block to wrap.

- [ ] **Step 3: Update the global layout**

Import `VisitorStats`, set the tracking script in `<head>`:

```astro
<script defer src="https://cloud.umami.is/script.js" data-website-id={import.meta.env.PUBLIC_UMAMI_WEBSITE_ID || 'e5b57255-bb27-4381-bd05-21bc5e30166a'}></script>
```

Render `<VisitorStats />` beside the existing footer copy. Preserve all existing navigation, metadata, and canonical-link behavior.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run `node --import tsx tests/umami.test.mjs` and confirm the markup contracts pass.

### Task 4: Document Cloudflare configuration and run full verification

**Files:**
- Modify: `README.md`
- Modify: `tests/umami.test.mjs` if documentation assertions are added

- [ ] **Step 1: Document deployment variables**

Add a concise Umami section documenting:

```text
UMAMI_API_KEY=<Umami Cloud API key, Cloudflare Pages secret>
UMAMI_WEBSITE_ID=<optional override; defaults to issue #84 website ID>
UMAMI_API_ENDPOINT=<optional override; defaults to https://api.umami.is/v1>
PUBLIC_UMAMI_WEBSITE_ID=<optional build-time override for tracking script>
```

State that the API key must remain a server-side Cloudflare Pages secret and that the footer hides itself when stats are unavailable.

- [ ] **Step 2: Run all tests**

Run `npm test`; expect the existing suite plus the new Umami tests to pass with zero failures.

- [ ] **Step 3: Run type checks and static build**

Run `npm run check`, `npm run build`, and `git diff --check`; expect zero Astro diagnostics, a successful 107-page static build, and no whitespace errors.

- [ ] **Step 4: Commit the implementation**

```bash
git add functions/api/umami-stats.ts src/components/VisitorStats.astro src/styles/visitor-stats.css src/layouts/BaseLayout.astro README.md tests/umami.test.mjs docs/superpowers/plans/2026-09-05-umami-analytics.md
git commit -m "feat: add Umami visitor statistics"
```

### Task 5: Push the feature branch and create the issue-linked PR

- [ ] **Step 1: Push the feature branch**

```bash
git push -u origin codex/issue-84-umami-analytics
```

- [ ] **Step 2: Create the pull request**

Create a PR targeting `main` with title `feat: add Umami visitor statistics` and body:

```markdown
## Summary

- add Umami Cloud tracking to the global Astro layout
- add a server-side Cloudflare Pages Function for cumulative and today's visitor counts
- show the counts in the footer with a safe hidden fallback when configuration or upstream stats are unavailable

## Configuration

Set `UMAMI_API_KEY` as a Cloudflare Pages secret. `UMAMI_WEBSITE_ID` and `PUBLIC_UMAMI_WEBSITE_ID` are optional overrides.

## Test plan

- [x] `npm test`
- [x] `npm run check`
- [x] `npm run build`
- [x] `git diff --check`

Closes #84
```

- [ ] **Step 3: Verify the PR URL and branch state**

Run `gh pr view --repo SwartzMss/MacroLens --json number,url,state,headRefName,baseRefName` and `git status --short --branch`. The PR must target `main`, reference `#84`, and the worktree must be clean.

## Plan self-review

- The issue's tracking-script, cumulative visitor, and today's visitor goals map to Tasks 3 and 4.
- API-key secrecy and Cloudflare compatibility map to Task 2 and the README configuration section.
- Missing configuration and upstream failures have explicit status codes and a client-hidden fallback.
- The plan uses no new runtime dependency and keeps all existing static routes unchanged.
