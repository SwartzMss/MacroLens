# NBS Real-Economy Fetch Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix NBS real-economy publication discovery and route every live real-economy request through the shared resilient fetcher while preserving the four existing statistical contracts.

**Architecture:** Keep parsing, normalization, validation, and fixture-mode CLI behavior unchanged. Change the fetch adapter to use the official `/sj/zxfb/` index and inject a `TextFetcher` boundary defaulting to shared `fetchText`; the CLI calls an adapter-level index function and contains no network implementation.

**Tech Stack:** TypeScript, Node test runner, `tsx`, Astro checks/build, offline HTML/JSON fixtures.

---

## File map

- Modify `scripts/ingest/fetch/nbs-real-economy.ts`: index URL, shared fetch import, index boundary, JSON/GDP/series delegation.
- Modify `scripts/ingest/real-economy-cli.ts`: remove its local direct-fetch helper and call the adapter boundary.
- Create `tests/fixtures/nbs/real-economy/publication-index.html`: official release-index shape for all four series.
- Modify `tests/ingestion-nbs-real-economy.test.mjs`: index, delegation, and error-propagation regressions.

### Task 1: Add failing regression coverage

**Files:** Create `tests/fixtures/nbs/real-economy/publication-index.html`; modify `tests/ingestion-nbs-real-economy.test.mjs`.

- [ ] **Step 1: Add the official index fixture.** Create four same-origin anchors followed by ISO dates using these exact titles and links:

```html
<a href="/sj/zxfb/202607/t20260716_1964142.html">2026年二季度和上半年国内生产总值初步核算结果</a><span>2026-07-16</span>
<a href="/sj/zxfb/202608/t20260817_1965055.html">2026年7月份规模以上工业增加值增长4.5%</a><span>2026-08-17</span>
<a href="/sj/zxfb/202608/t20260817_1965056.html">2026年7月份社会消费品零售总额增长3.7%</a><span>2026-08-17</span>
<a href="/sj/zxfb/202608/t20260817_1965057.html">2026年1—7月份全国固定资产投资（不含农户）增长2.7%</a><span>2026-08-17</span>
```

- [ ] **Step 2: Add the discovery regression.** Load the fixture and table-drive `discoverLatestRealEconomyPublication` over `gdp`, `industrial-production`, `retail-sales`, and `fixed-asset-investment`. Assert the four exact `https://www.stats.gov.cn/sj/zxfb/...` URLs and official origin. Update existing real-economy inline expectations from `/sj/zxfbhjd/` to `/sj/zxfb/`.

- [ ] **Step 3: Add shared-fetch delegation coverage.** Import `fetchNbsPublicationIndex`, `fetchNbsGdpPublication`, `fetchNbsRealEconomySeries`, and `nbsPublicationIndex`. Inject a fake `(url) => Promise<string>` that records calls, returns the index fixture for `nbsPublicationIndex`, GDP HTML for the GDP page, and `JSON.stringify` of each existing National Data fixture for EasyQuery URLs. Assert all recorded calls are the index, official publication pages, or `data.stats.gov.cn/easyquery.htm` URLs. Read both source files and assert `assert.doesNotMatch(source, /\\bfetch\\s*\\(/)`.

- [ ] **Step 4: Add shared-error propagation coverage.** Import `FetchTextError`, create one sentinel with URL/status/attempt data, inject a fetcher that throws it into `fetchNbsGdpPublication`, and assert `assert.rejects` receives the identical error object. This preserves shared retry/status/cause diagnostics.

- [ ] **Step 5: Verify RED.** Run `node --import tsx --test tests/ingestion-nbs-real-economy.test.mjs`. Expected failure: the current implementation uses `/sj/zxfbhjd/` and exports no shared-fetch boundary. Do not write production code before observing this failure.

### Task 2: Implement the shared-fetch adapter

**Files:** Modify `scripts/ingest/fetch/nbs-real-economy.ts` and `scripts/ingest/real-economy-cli.ts`.

- [ ] **Step 1: Switch the index and add injection.** Change `NBS_INDEX` to `https://www.stats.gov.cn/sj/zxfb/`, import `{ fetchText }` from `../fetch-text.ts`, define `type TextFetcher = (url: string) => Promise<string>`, and add:

```ts
export async function fetchNbsPublicationIndex(fetcher: TextFetcher = fetchText): Promise<string> {
  return fetcher(NBS_INDEX);
}
```

Keep `nbsPublicationIndex` exported and leave title matching, date validation, official-origin validation, and coverage logic unchanged.

- [ ] **Step 2: Replace direct request helpers.** Replace local `fetchJson` and `fetchText` with `async function fetchJson(url: string, fetcher: TextFetcher): Promise<unknown> { return JSON.parse(await fetcher(url)); }`. Add optional `fetcher = fetchText` parameters to `fetchNbsRealEconomySeries` and `fetchNbsGdpPublication`; pass the fetcher to every EasyQuery, methodology-page, and GDP release-page request. Do not catch or wrap `FetchTextError`; JSON/parser failures remain post-fetch and non-retryable.

- [ ] **Step 3: Remove CLI networking.** Import `fetchNbsPublicationIndex`, delete the CLI-local `fetchText`, and make `livePublication` call `discoverLatestRealEconomyPublication(await fetchNbsPublicationIndex(), id)`. Keep fixture mode, normalization, validation, and writes unchanged.

- [ ] **Step 4: Verify GREEN.** Run `node --import tsx --test tests/ingestion-nbs-real-economy.test.mjs`. Expected: all focused tests pass, including index discovery, text-to-JSON decoding, no-direct-fetch checks, and error propagation.

- [ ] **Step 5: Commit implementation.** Run `git add scripts/ingest/fetch/nbs-real-economy.ts scripts/ingest/real-economy-cli.ts tests/fixtures/nbs/real-economy/publication-index.html tests/ingestion-nbs-real-economy.test.mjs && git commit -m "fix: route NBS real-economy ingestion through shared fetch"`.

### Task 3: Full verification and PR

**Files:** No additional files expected beyond the approved design/plan docs, adapter, CLI, fixture, and regression test.

- [ ] **Step 1: Run complete verification.** Run `npm test`, `npm run check`, and `npm run build`; each must exit 0, and tests must make no live NBS requests.

- [ ] **Step 2: Check scope.** Run `git diff --check origin/main...HEAD`, `git diff --stat origin/main...HEAD`, and `git status --short`. Confirm no indicator JSON or generated `dist` output is included.

- [ ] **Step 3: Push and create the linked PR.** Push `codex/issue-57-nbs-real-economy-fetch` and create a PR to `main` titled `Fix NBS real-economy publication discovery and shared fetch`. The body must contain `Fixes #57`, summarize the index/fetch changes, list observed verification results, and state that ordinary CI remains offline.
