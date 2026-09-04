# NBS Real-Economy Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bounded, shared pagination to official NBS real-economy publication discovery and support official retail half-year titles without changing dataset semantics.

**Architecture:** Keep the existing single-page parser as a pure compatibility API, extract its candidate parsing into a reusable page scanner, and add one async multi-page fetcher that accumulates the newest publication per dataset. The CLI invokes that fetcher once and reuses its four-publication map; every page request continues to use shared `fetchText`.

**Tech Stack:** TypeScript, Node test runner, `tsx`, Astro checks/build, offline HTML fixtures.

---

## File map

- Modify `scripts/ingest/fetch/nbs-real-economy.ts`: candidate extraction, bounded page URLs, shared scan, half-year retail coverage.
- Modify `scripts/ingest/real-economy-cli.ts`: fetch one publication map before the four-series loop.
- Create `tests/fixtures/nbs/real-economy/publication-index-page-0.html`: recent monthly releases without GDP.
- Create `tests/fixtures/nbs/real-economy/publication-index-page-1.html`: GDP plus older duplicate releases.
- Modify `tests/ingestion-nbs-real-economy.test.mjs`: pagination, stop/exhaustion, latest selection, half-year title tests.

### Task 1: Add failing pagination and title tests

**Files:** Create the two page fixtures; modify `tests/ingestion-nbs-real-economy.test.mjs`.

- [ ] **Step 1: Create page 0 fixture.** Include official `/sj/zxfb/` anchors for July industrial production, July retail sales, and January–July fixed-asset investment, but no GDP anchor. Use dates `2026-08-17`; include an interpretation link to verify it is ignored.

- [ ] **Step 2: Create page 1 fixture.** Include the GDP title `2026年二季度和上半年国内生产总值初步核算结果` dated `2026-07-16`, plus older industrial/retail/fixed-asset matches dated `2026-07-15`. Use `index_1.html`-style links and official same-origin destinations.

- [ ] **Step 3: Add a shared pagination regression.** Import the new `fetchNbsRealEconomyPublications` function. Inject a text fetcher that returns page 0 for `nbsPublicationIndex`, page 1 for `${nbsPublicationIndex}index_1.html`, and throws if called for page 2. Assert the result has all four IDs, GDP comes from page 1, page 0 monthly releases remain selected over older page-1 duplicates, and the calls are exactly page 0 and page 1.

- [ ] **Step 4: Add bounded exhaustion coverage.** Inject a fetcher that returns a page with no GDP and call the scanner with a maximum of 2 pages. Assert rejection with `IngestionContractError` whose message names `gdp` and the scanned page count. Assert only page 0 and page 1 were requested.

- [ ] **Step 5: Add half-year retail coverage coverage.** Call `discoverLatestRealEconomyPublication` with an official title like `2026年上半年社会消费品零售总额增长5.4%` and assert `coverage === '2026-06 to 2026-06'`. Keep the existing Jan–Feb and negative-growth tests unchanged and green.

- [ ] **Step 6: Verify RED.** Run `node --import tsx --test tests/ingestion-nbs-real-economy.test.mjs`. Expected: module import failure because `fetchNbsRealEconomyPublications` does not exist, followed by the current half-year parser behavior being unsupported once the import is implemented. Do not write production code before observing the missing API failure.

### Task 2: Implement bounded shared pagination and half-year parsing

**Files:** Modify `scripts/ingest/fetch/nbs-real-economy.ts`.

- [ ] **Step 1: Extract reusable candidate parsing.** Move the anchor loop from `discoverLatestRealEconomyPublication` into a private `discoverRealEconomyPublicationCandidates(indexHtml, id)` helper returning an array. Preserve title filtering, interpretation exclusion, malformed-date failure, same-origin validation, and `publicationCoverageFromTitle`; keep the existing single-page function sorting candidates and throwing when its own page has no match.

- [ ] **Step 2: Support the half-year retail title explicitly.** At the start of `publicationCoverageFromTitle`, after canonicalizing the title and before numeric-month parsing, recognize `id === 'retail-sales' && /^([0-9]{4})年上半年/.test(title)`. Return `${year}-06 to ${year}-06`. Leave GDP, Jan–Feb, monthly, fixed-asset cumulative, and invalid-period branches unchanged.

- [ ] **Step 3: Add bounded page URL and scan APIs.** Define `const DEFAULT_MAX_PUBLICATION_INDEX_PAGES = 8` and page URL generation where page 0 is `nbsPublicationIndex`, page 1 is `new URL('index_1.html', nbsPublicationIndex).toString()`, and so on. Add `fetchNbsRealEconomyPublications(fetcher = fetchText, maxPages = DEFAULT_MAX_PUBLICATION_INDEX_PAGES)` returning `Record<RealEconomyDatasetId, NbsRealEconomyPublication>`. Fetch each page once, accumulate candidates for all four IDs, update each ID only when the candidate has a newer `sourceDate`, and return immediately when all IDs exist. If the limit is reached, throw `IngestionContractError` listing missing IDs and `maxPages`.

- [ ] **Step 4: Preserve shared transport behavior.** Pass every listing-page request through the injected/default `fetchText`; do not add direct `fetch()`, retries, fallback hosts, or error wrapping. Keep `fetchNbsPublicationIndex` and `nbsPublicationIndex` behavior compatible with #58.

- [ ] **Step 5: Run focused tests and verify GREEN.** Run `node --import tsx --test tests/ingestion-nbs-real-economy.test.mjs`; expected result is all real-economy tests passing, including page-1 GDP discovery, early stop, latest selection, exhaustion, half-year coverage, and previous parser/normalizer/CLI tests.

- [ ] **Step 6: Commit adapter changes.** Run `git add scripts/ingest/fetch/nbs-real-economy.ts tests/fixtures/nbs/real-economy/publication-index-page-0.html tests/fixtures/nbs/real-economy/publication-index-page-1.html tests/ingestion-nbs-real-economy.test.mjs && git commit -m "fix: paginate NBS real-economy publication discovery"`.

### Task 3: Make the CLI perform one shared scan

**Files:** Modify `scripts/ingest/real-economy-cli.ts`; extend `tests/ingestion-nbs-real-economy.test.mjs` if needed.

- [ ] **Step 1: Load publications once for live mode.** Import `fetchNbsRealEconomyPublications` and its publication-map type if needed. In `runRealEconomy`, after loading existing targets and before the four-ID loop, call the scanner exactly once when fixture mode is disabled. Pass `publications?.[id]` to `loadRawSeries`; fixture mode must continue using fixture files without any network call.

- [ ] **Step 2: Remove per-ID live discovery.** Delete or bypass the old `livePublication(id)` function so the CLI cannot fetch page 0 separately for each series. Preserve GDP release-page fetching, National Data URL construction, normalization, validation, all-or-nothing writes, and CLI output.

- [ ] **Step 3: Add/adjust a source-level regression.** Assert the CLI imports/uses `fetchNbsRealEconomyPublications`, has no direct `fetch(` expression, and the existing fixture CLI remains idempotent. If a small exported helper is needed for injection, keep the default production path bound to shared `fetchText`.

- [ ] **Step 4: Run focused tests and commit.** Run `node --import tsx --test tests/ingestion-nbs-real-economy.test.mjs`, confirm GREEN, then commit with `git add scripts/ingest/real-economy-cli.ts tests/ingestion-nbs-real-economy.test.mjs && git commit -m "fix: share paginated NBS discovery across CLI datasets"`.

### Task 4: Full verification and PR

- [ ] **Step 1: Run `npm test`, `npm run check`, and `npm run build`.** Each must exit 0; ordinary tests must remain offline.

- [ ] **Step 2: Run `git diff --check origin/main...HEAD`, inspect `git diff --stat origin/main...HEAD`, and confirm `git status --short` contains no generated `dist` or indicator JSON changes.**

- [ ] **Step 3: Push `codex/issue-59-nbs-pagination` and create a PR to `main` with `Fixes #59`.** Include the verification results and note that no live workflow run or direct data write was performed by CI tests.
