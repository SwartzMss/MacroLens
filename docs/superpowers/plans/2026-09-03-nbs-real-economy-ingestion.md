# NBS Real-Economy Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox ([ ] syntax) for tracking.

**Goal:** Add deterministic, reviewable NBS ingestion for the existing GDP, industrial-production, retail-sales, and fixed-asset-investment datasets while preserving official period and methodology semantics.

**Architecture:** Use explicit per-series contracts: parse GDP from the official quarterly release page, and parse the other three datasets from National Data responses with separate monthly/cumulative code rules. Normalize and validate all four candidates before writing any file; reuse the existing stable JSON writer and workflow PR action. Extend period validation only through explicit series rules so PMI and PBOC contracts remain unchanged.

**Tech Stack:** TypeScript via tsx, Node test runner, JSON fixtures, Astro project, GitHub Actions.

---

## File map

- Create scripts/ingest/fetch/nbs-real-economy.ts: official NBS response parsing, metadata extraction, source-origin checks, and series-specific raw observations.
- Create scripts/ingest/normalize/real-economy.ts: contract-driven normalization, overlap merging, source coverage updates, and candidate dataset creation.
- Create scripts/ingest/validate/real-economy.ts: dataset field, methodology, period-shape, and source-contract validation for the four target IDs.
- Create scripts/ingest/real-economy-cli.ts: fixture/live CLI, all-four candidate orchestration, and atomic group write behavior.
- Modify scripts/ingest/types.ts: add NBS raw publication/series types and real-economy IDs/contracts.
- Modify scripts/ingest/validate/dataset.ts: allow explicit period validators and coverage labels for quarterly/combined/cumulative observations without weakening existing monthly validation.
- Modify package.json: add ingest:nbs-real-economy.
- Modify .github/workflows/update-macro-data.yml: run the new CLI and include the four JSON targets in the existing reviewable PR.
- Create tests/ingestion-nbs-real-economy.test.mjs: fixture-driven contract, normalization, CLI, idempotency, and atomicity tests.
- Create tests/fixtures/nbs/real-economy/*.json and gdp-quarterly.html: official-shaped National Data/release-page fixtures and controlled malformed variants.
- Modify data/indicators/gdp.json, industrial-production.json, retail-sales.json, fixed-asset-investment.json: update canonical data/provenance only after the adapter passes against fixtures and official latest release metadata.

### Task 1: Define typed contracts and failing validator tests

**Files:**
- Modify scripts/ingest/types.ts
- Modify scripts/ingest/validate/dataset.ts
- Create scripts/ingest/validate/real-economy.ts
- Create tests/ingestion-nbs-real-economy.test.mjs

- [ ] Write tests that assert the four existing datasets pass their exact contracts, while wrong ID/country/frequency/unit/metric/source/calculation, unsupported methodology fingerprint, and wrong observation shapes throw typed errors.
- [ ] Write tests for valid period shapes: GDP 2025-Q1, industry/retail 2025-01–02 followed by 2025-03 and 2025-04, and investment 2025-01–02 followed by 2025-01–03 and 2025-01–04.
- [ ] Write tests proving a missing 2025-01 is valid for industry/retail, a missing 2025-01–02 is invalid, a single-month investment label is invalid, and a quarterly series is not passed through monthly continuity logic.
- [ ] Run node --import tsx --test tests/ingestion-nbs-real-economy.test.mjs; expect failure because the real-economy validator and contract types do not exist.
- [ ] Implement the smallest contract table and period validators required by the tests. Keep validateMonthlyObservations unchanged for existing PMI/PBOC callers and add separate validateRealEconomyObservations dispatch.
- [ ] Run the focused test again and then npm test; expect the new validator tests and all existing tests to pass.
- [ ] Commit with:
~~~sh
git add scripts/ingest/types.ts scripts/ingest/validate/dataset.ts scripts/ingest/validate/real-economy.ts tests/ingestion-nbs-real-economy.test.mjs
git commit -m 'test: define NBS real-economy contracts'
~~~

### Task 2: Parse official NBS responses

**Files:**
- Create scripts/ingest/fetch/nbs-real-economy.ts
- Create tests/fixtures/nbs/real-economy/gdp-quarterly.json
- Create tests/fixtures/nbs/real-economy/industrial-production.json
- Create tests/fixtures/nbs/real-economy/retail-sales.json
- Create tests/fixtures/nbs/real-economy/fixed-asset-investment.json
- Modify tests/ingestion-nbs-real-economy.test.mjs

- [ ] Add official-shaped fixture payloads containing response status, dataset/series code, title, unit, frequency, publication date, source URL, coverage metadata, and values. Include overlap with committed data and one new period per target.
- [ ] Write parser tests that extract numeric values only when the official response marks a node as present, reject missing/non-numeric values, reject duplicate periods, reject malformed publication dates, and reject non-stats.gov.cn source URLs.
- [ ] Write tests that verify series-code/label matching: A020101/A020102 route industrial monthly vs Jan-Feb data, A070103/A070104 route retail monthly vs Jan-Feb data, A040102 feeds cumulative investment, and GDP is read only from the official quarterly release table.
- [ ] Run the focused parser tests; expect failure because parseNbsRealEconomyResponse and the fetch loader are absent.
- [ ] Implement strict GDP release-page and National Data parsers with wire-period normalization, source-origin validation, official methodology anchors, and stable publication discovery. Live National Data fetches use a deterministic query URL and the discovered official release page as provenance/methodology source.
- [ ] Run the focused parser tests and npm test; expect all tests to pass.
- [ ] Commit with:
~~~sh
git add scripts/ingest/fetch/nbs-real-economy.ts tests/fixtures/nbs/real-economy tests/ingestion-nbs-real-economy.test.mjs
git commit -m 'feat: parse official NBS real-economy responses'
~~~

### Task 3: Normalize, merge, and validate with overlap/methodology safety

**Files:**
- Create scripts/ingest/normalize/real-economy.ts
- Modify scripts/ingest/validate/real-economy.ts
- Modify tests/ingestion-nbs-real-economy.test.mjs

- [ ] Add tests for successful end-to-end normalization of all four datasets, including source coverage that exactly reflects the fetched period range and updatedAt equal to the latest source date.
- [ ] Add tests for agreeing overlap, historical value mismatch (HistoricalMismatchError), older publication metadata, wrong methodology/definition anchor (MethodologyMismatchError), and source coverage gaps.
- [ ] Add tests that normalized industrial/retail data preserve 2025-01–02, normalized investment data preserve cumulative labels and metric=cumulative_yoy, and GDP data remains quarterly metric=yoy.
- [ ] Run the focused tests; expect failure because the normalizer is absent.
- [ ] Implement normalizeRealEconomyDataset(raw, existing, id) by validating the existing dataset, validating incoming observations, merging with mergeObservations, replacing only the fetched source URL, pruning redundant sources with pruneSources, and validating the merged candidate before returning it.
- [ ] Ensure no incoming observation can silently overwrite an existing value and no incoming source may make claims outside its actual coverage.
- [ ] Run focused tests and npm test; expect all tests to pass.
- [ ] Commit with:
~~~sh
git add scripts/ingest/normalize/real-economy.ts scripts/ingest/validate/real-economy.ts tests/ingestion-nbs-real-economy.test.mjs
git commit -m 'feat: normalize NBS real-economy datasets safely'
~~~

### Task 4: Add an all-or-nothing CLI

**Files:**
- Create scripts/ingest/real-economy-cli.ts
- Modify package.json
- Modify tests/ingestion-nbs-real-economy.test.mjs

- [ ] Add a test that seeds temporary copies of all four target files, runs the fixture CLI, and asserts each dataset receives its expected latest observation and source metadata.
- [ ] Add a second-run test that asserts all four Changed: false and all serialized files are byte-for-byte unchanged.
- [ ] Add an atomicity test that changes one fixture to a historical mismatch and asserts none of the four target files changes.
- [ ] Add CLI argument/help tests for --fixture-dir, --fixture-index, --target-dir, and --help; require fixture arguments as a pair.
- [ ] Run the focused CLI tests; expect failure because the CLI and npm script are absent.
- [ ] Implement runRealEconomy(args) to load/validate all four existing targets, fetch/parse all four raw series, normalize all four into an in-memory map, validate every candidate, then call writeIndicatorDataset only after the complete map succeeds. Log each ID's latest period and changed status.
- [ ] Add ingest:nbs-real-economy: node --import tsx scripts/ingest/real-economy-cli.ts to package.json.
- [ ] Run the focused CLI tests, npm test, and npm run ingest:nbs-real-economy -- --help; expect success.
- [ ] Commit with:
~~~sh
git add scripts/ingest/real-economy-cli.ts package.json tests/ingestion-nbs-real-economy.test.mjs
git commit -m 'feat: add NBS real-economy ingestion CLI'
~~~

### Task 5: Integrate the scheduled workflow and canonical data

**Files:**
- Modify .github/workflows/update-macro-data.yml
- Modify data/indicators/gdp.json
- Modify data/indicators/industrial-production.json
- Modify data/indicators/retail-sales.json
- Modify data/indicators/fixed-asset-investment.json
- Modify tests/ingestion-nbs-real-economy.test.mjs

- [ ] Add workflow assertions that the existing PMI and PBOC steps remain, the new NBS step runs after them, and add-paths contains exactly the four new targets plus existing PMI/PBOC targets.
- [ ] Run the workflow test before editing; confirm it fails on the missing NBS step/path entries.
- [ ] Add the Fetch and validate NBS real-economy indicators step using npm run ingest:nbs-real-economy -- --target-dir data/indicators, leaving PR creation on automation/update-macro-data and never pushing directly to main.
- [ ] Update the four JSON files from official release/structured fixtures to the latest available periods at implementation time: GDP through the latest official quarter, monthly series through the latest published month, and investment through the latest published cumulative period. Preserve the existing semantics and use only official stats.gov.cn URLs with truthful coverage.
- [ ] Run fixture CLI against copies of the canonical files, then run npm test; expect workflow tests and all existing tests to pass.
- [ ] Commit with:
~~~sh
git add .github/workflows/update-macro-data.yml data/indicators/gdp.json data/indicators/industrial-production.json data/indicators/retail-sales.json data/indicators/fixed-asset-investment.json tests/ingestion-nbs-real-economy.test.mjs
git commit -m 'feat: schedule NBS real-economy updates'
~~~

### Task 6: Full verification and review

**Files:**
- No planned source changes; inspect all modified files and git history.

- [ ] Run npm test and record the complete pass count.
- [ ] Run npm run check and confirm exit code 0.
- [ ] Run npm run build and confirm exit code 0.
- [ ] Run git diff --check origin/main...HEAD and git status --short.
- [ ] Confirm the fixture CLI performs no live network calls in tests and that no file is written when any dataset fails.
- [ ] Request a code review against origin/main and address every Critical/Important finding.
- [ ] Push codex/issue-53-nbs-real-economy and create a PR that references issue #53, includes the summary, test commands, and workflow behavior.

### Task 7: Address live-query and provenance review blockers

**Files:**
- Modify scripts/ingest/types.ts
- Modify scripts/ingest/fetch/nbs-real-economy.ts
- Modify scripts/ingest/normalize/real-economy.ts
- Modify scripts/ingest/real-economy-cli.ts
- Modify tests/fixtures/nbs/real-economy/industrial-production.json
- Modify tests/fixtures/nbs/real-economy/retail-sales.json
- Modify tests/fixtures/nbs/real-economy/fixed-asset-investment.json
- Modify tests/ingestion-nbs-real-economy.test.mjs

- [ ] Add a failing parser test whose industrial and retail fixtures include cumulative `202503`/`202504` nodes as well as the `202502` node, and assert that only the combined `202502` node and monthly `202503+` nodes become observations.
- [ ] Add a failing query-construction test asserting that industrial and retail use separate stable URLs for each source code, with one URL for the combined code and one for the monthly code; retain a fixed-code URL for investment.
- [ ] Add a failing normalization test asserting that National Data sources cover the actual returned periods while the release-page methodology source covers only its current published period and remains in the dataset provenance.
- [ ] Run the focused test file and confirm these tests fail because the current implementation sends one multi-code URL, rejects cumulative rows outside Jan-Feb, and records only the release page as the incoming source.
- [ ] Implement `buildNbsQueryUrls` to emit one deterministic EasyQuery URL per source code, update live fetching to fetch all URLs, and make period routing ignore out-of-scope rows while requiring the selected rows to be present and numeric.
- [ ] Extend the raw NBS result with explicit data-source provenance; create one source per fetched National Data URL with exact selected-period coverage and a methodology/publication source whose coverage is derived from the official publication's relevant current period.
- [ ] Preserve methodology sources during source pruning and normalize both source classes without assigning the release page coverage to historical National Data observations.
- [ ] Run the focused tests, then npm test, npm run check, npm run build, and git diff --check origin/main...HEAD.
- [ ] Commit with:
~~~sh
git add scripts/ingest/types.ts scripts/ingest/fetch/nbs-real-economy.ts scripts/ingest/normalize/real-economy.ts scripts/ingest/real-economy-cli.ts tests/fixtures/nbs/real-economy tests/ingestion-nbs-real-economy.test.mjs docs/superpowers/plans/2026-09-03-nbs-real-economy-ingestion.md
git commit -m 'fix: separate NBS series queries and provenance'
~~~
