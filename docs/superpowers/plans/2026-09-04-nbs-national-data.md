# Fix NBS National Data Access Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blocked legacy National Data EasyQuery requests with the official frontend structured-data endpoint while preserving all five real-economy source-code contracts and existing ingestion safeguards.

**Architecture:** Keep publication discovery, parser contracts, normalization, overlap validation, and atomic writes unchanged. Extend the shared text-fetch boundary with backward-compatible POST/request-init support, then keep all official endpoint URLs, verified UUID mappings, request construction, response adaptation, and semantic metadata validation inside the NBS adapter. Convert the structured `data/values` response into the existing NBS data-node shape so downstream period rules and continuity checks remain authoritative.

**Tech Stack:** TypeScript, Node `fetch`, Node test runner, `tsx`, JSON fixtures, official `data.stats.gov.cn` structured endpoint.

---

### Task 1: Record the implementation plan and fixture contract

**Files:**
- Create: `docs/superpowers/plans/2026-09-04-nbs-national-data.md`
- Create: `tests/fixtures/nbs/real-economy/national-data-structured.json`
- Modify: `tests/ingestion-nbs-real-economy.test.mjs`

- [x] **Step 1: Add a deterministic structured-response fixture**

  The fixture must contain the official frontend response shape with `success`, `state`, `data`, period codes ending in `MM`, selected indicator UUIDs, official display names, numeric values, and blank future values. It must cover industrial monthly and cumulative indicators, retail monthly and cumulative indicators, and FAI cumulative indicator, while retaining the existing publication metadata.

- [x] **Step 2: Add the failing adapter test**

  Add a test that calls the new structured-response adapter with the fixture and asserts that all five old source codes are emitted, blank values are ignored, the existing dates are produced (`2025-01–02`, `2025-03`, `2025-04`), the series remains `%`/monthly, and every data source uses the official `data.stats.gov.cn/dg/website/publicrelease/web/external/stream/esData` origin.

- [x] **Step 3: Run the focused test to verify RED**

  Run `node --import tsx --test tests/ingestion-nbs-real-economy.test.mjs`.

  Expected result: the new test fails because the structured endpoint adapter and fixture conversion are not yet implemented; all pre-existing tests remain green.

### Task 2: Preserve shared fetch diagnostics for structured POST requests

**Files:**
- Modify: `scripts/ingest/fetch-text.ts`
- Test: `tests/ingestion-fetch-text.test.mjs`

- [x] **Step 1: Add a failing request-options test**

  Extend the fetch-text tests with a request that passes `method: 'POST'`, JSON headers, and a JSON body. Assert the injected fetch implementation receives those values in addition to the MacroLens user agent and abort signal. Add/retain a 403 assertion that the request is attempted exactly once, has `status === 403`, and does not call the sleep function.

- [x] **Step 2: Run the focused test to verify RED**

  Run `node --import tsx --test tests/ingestion-fetch-text.test.mjs` and confirm the new request-options assertion fails before production changes.

- [x] **Step 3: Implement the minimal transport extension**

  Add optional `method`, `headers`, and `body` fields to `FetchTextOptions`. Merge caller headers after the default user-agent, pass the method/body to `fetchImpl`, and leave retry classification unchanged: only transport errors, 429, and 5xx retry; 403 remains a single explicit `FetchTextError`.

- [x] **Step 4: Run the focused test to verify GREEN**

  Run `node --import tsx --test tests/ingestion-fetch-text.test.mjs`; expect all fetch-text tests to pass.

### Task 3: Implement the official structured National Data adapter

**Files:**
- Modify: `scripts/ingest/fetch/nbs-real-economy.ts`
- Test: `tests/ingestion-nbs-real-economy.test.mjs`

- [x] **Step 1: Add failing request-shape and five-code tests**

  Add an injected-fetch test around `fetchNbsRealEconomySeries` that returns the fixture for the official `stream/esData` URL and the release page HTML, then asserts one POST per semantic contract, JSON body fields (`cid`, all mapped `indicatorIds`, national area `000000000000`, `showType: '1'`, deterministic `dts`, and monthly root ID), browser-compatible `Accept`/`Referer` headers, old source-code output, and no legacy `easyquery.htm` request. Add a 403 test asserting the shared `FetchTextError` propagates unchanged with one attempt.

- [x] **Step 2: Define verified official mappings and request builders**

  Keep the existing source codes in `REAL_ECONOMY_CONTRACTS` and map them adapter-locally:

  - `A020101` → `ef1b1765960d45a29b4d7c4ca91be916`, `A020102` → `21e7072e9f384209aedb56e69a18216e`, cid `3f2e14f0542348ed9fe02476eca3450b`.
  - `A070103` → `aaac57d54d2e465d91bc9f3ea1a8618e`, `A070104` → `e3ca151b53d347b78d1e179e5ebf1d33`, cid `d0cb882c7f27443ab6b3ef9421901961`.
  - `A040102` → `7e570cf8071c4734a7d78d9f0a70fbe1`, cid `5129067b149d4ddfbec1ffc478d35bfb`.

  Use the official monthly root `fc982599aa684be7969d7b90b1bd0e84`. Build a bounded range from a fixed earliest month (`2011-01`) through an injected/current year-month, formatting `dts` as `YYYYMM-MM` pairs accepted by the endpoint. Keep the mapping and endpoint constants explicit so a changed official catalog fails loudly rather than silently selecting a different metric.

- [x] **Step 3: Adapt and validate the official response**

  Validate `success === true`, `state === 20000`, non-empty data, selected indicator UUIDs, numeric values, and official display metadata. Ignore blank future values. Convert each nonblank value to an existing data node with the old source code and `YYYYMM` period code, build official methodology text from the returned indicator labels/annotations, and pass the resulting payload through the existing `parseNbsRealEconomyResponse` path. Preserve the existing methodology fingerprints and add explicit verified frontend semantic anchors where the new labels replace old `现价`/`不变价` wording.

- [x] **Step 4: Preserve provenance without pretending POST is a GET**

  Build one official endpoint provenance URL per old source code using the `stream/esData` endpoint and stable query parameters (`cid`, `indicatorId`, and period range) for human diagnostics. The actual request remains POST; the source URL identifies the official endpoint and exact mapped indicator without reverting to the blocked EasyQuery URL.

- [x] **Step 5: Run the focused tests to verify GREEN**

  Run `node --import tsx --test tests/ingestion-nbs-real-economy.test.mjs tests/ingestion-fetch-text.test.mjs`; expect the structured flow, five-code mapping, blank-value handling, and explicit 403 behavior to pass together with all existing parser/normalizer tests.

### Task 4: Wire the live CLI and add deterministic end-to-end coverage

**Files:**
- Modify: `scripts/ingest/real-economy-cli.ts`
- Modify: `tests/ingestion-nbs-real-economy.test.mjs`

- [x] **Step 1: Add a failing CLI-source assertion**

  Assert that live National Data loading no longer constructs `buildNbsQueryUrls` for the three non-GDP contracts, while fixture mode remains unchanged and still performs no network access or direct writes beyond the existing atomic writer.

- [x] **Step 2: Remove the legacy live URL wiring**

  Let `fetchNbsRealEconomySeries` own structured request construction. Keep `buildNbsQueryUrls` exported only for backward-compatible parser/test fixtures if needed, but do not pass legacy URLs from the live CLI.

- [x] **Step 3: Run the deterministic CLI tests**

  Run `node --import tsx --test tests/ingestion-nbs-real-economy.test.mjs`; expect the four-target fixture CLI idempotence and atomic-write tests to remain green.

### Task 5: Verify official live access and complete the branch

**Files:**
- Modify: `docs/superpowers/plans/2026-09-04-nbs-national-data.md` only if verification notes need recording.

- [x] **Step 1: Run the official read-only smoke check**

  Execute the adapter against the official `stream/esData` endpoint for industrial, retail, and FAI, and assert successful structured responses containing the five mapped indicators. Do not write repository data during this check.

- [x] **Step 2: Run the complete verification suite**

  Run `npm test`, `npm run check`, and `npm run build` serially. Confirm zero test failures, zero type-check errors, and a successful production build.

- [x] **Step 3: Inspect the final diff**

  Run `git diff --check`, `git diff --stat`, and review the full diff against `origin/main`. Confirm no mirror/proxy/third-party source, no generic 403 retry, no direct writes in the adapter, and no changes to unrelated CPI/PPI/dashboard/GDP logic.

- [x] **Step 4: Request independent code review**

  Send the final commit range and the issue requirements to a reviewer subagent. Fix all Critical/Important findings, then rerun the complete verification suite.

- [x] **Step 5: Commit and create the PR**

  Commit with `fix: migrate NBS national data to official structured endpoint`, push `codex/issue-63-nbs-national-data`, and create a PR against `main` linking `Fixes #63`. Include the endpoint migration, preserved contracts, fixture coverage, and exact verification commands in the PR body.
