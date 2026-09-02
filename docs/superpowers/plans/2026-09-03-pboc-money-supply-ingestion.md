# PBOC Money Supply Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one official PBOC monthly-report adapter that updates M0, M1, and M2 with strict overlap, continuity, methodology, provenance, and deterministic multi-file writes.

**Architecture:** Preserve PMI behavior while extracting only shared dataset/date/coverage/overlap primitives. Discover official PBOC monthly reports, parse all three YoY series from each report, normalize each JSON independently, validate every candidate before writing, and extend the existing reviewable workflow.

**Tech Stack:** TypeScript with `tsx`, Node `fetch`/filesystem/test APIs, Astro checks/build, GitHub Actions, and fixture-based tests. No new dependency or PDF parser.

---

## File map

Create `scripts/ingest/fetch/pboc-money-supply.ts`,
`scripts/ingest/normalize/money-supply.ts`,
`scripts/ingest/validate/money-supply.ts`,
`scripts/ingest/money-supply-cli.ts`, PBOC HTML fixtures, and
`tests/ingestion-pboc-money-supply.test.mjs`.

Modify `scripts/ingest/types.ts`, shared validation/overlap files, PMI callers
if required by the extraction, `package.json`,
`.github/workflows/update-macro-data.yml`, and the three indicator JSON files.

## Task 1: Extract reusable contracts without changing PMI behavior

**Files:** `scripts/ingest/types.ts`, `scripts/ingest/validate/dataset.ts`,
`scripts/ingest/validate/overlap.ts`, PMI normalization/validation callers, and
`tests/ingestion-pmi.test.mjs`.

- [ ] **Step 1: Add these PBOC types and constants to `types.ts`.**

```ts
export type MoneySupplyPublication = { title: string; url: string; sourceDate: string; month: string };
export type MoneySupplyValues = { m0: number; m1: number; m2: number };
export type RawMoneySupplyPublication = { publication: MoneySupplyPublication; values: MoneySupplyValues; methodologyFingerprint: string };
export const MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS = {
  m0: 'pboc-m0|currency-in-circulation|month-end-balance-yoy|e-cny-included-from-2022-12',
  m1: 'pboc-m1|revised-from-2025-01|m0+corporate-demand+personal-demand+nonbank-payment-reserves|month-end-balance-yoy',
  m2: 'pboc-m2|money-and-quasi-money|m1+time-and-other-deposits|month-end-balance-yoy',
} as const;
export type MoneySupplyDatasetId = keyof typeof MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS;
```

- [ ] **Step 2: Make `validateIndicatorDataset` generic.**

Keep required field, source-date, `YYYY-MM`, sorting, uniqueness, monthly
continuity, source-coverage union, and `updatedAt === sources.at(-1).sourceDate`
checks. Remove hard-coded PMI requirements (`index`, `[0,100]`, `published`,
and `stats.gov.cn`). Export `nextMonth`,
`validateMonthlyObservations(observations, label)`, `coverageCoversDates`, and
`pruneSources` for both adapters.

- [ ] **Step 3: Move PMI-only rules into `validatePmiDataset`.**

The PMI validator calls the generic validator, then requires monthly/index/index/
published, NBS sources, `[0,100]` values, and the existing PMI fingerprint.
Update PMI normalization/tests to call it; retain a generic validator test for
generic failures and PMI tests for PMI-specific failures.

- [ ] **Step 4: Add generic strict merging.**

Implement `mergeObservations(existing, incoming, label)` in `overlap.ts`. Every
overlapping date must match exactly or throw `HistoricalMismatchError` with the
label/date. Keep `mergePmiObservations` as a wrapper using label `PMI`.

- [ ] **Step 5: Run `npm test -- --test-name-pattern='PMI|indicator|writes stable|scheduled'` and `git diff --check`; expect pass. Commit with `git add scripts/ingest/types.ts scripts/ingest/validate/dataset.ts scripts/ingest/validate/overlap.ts scripts/ingest/normalize/pmi.ts scripts/ingest/validate/pmi.ts tests/ingestion-pmi.test.mjs && git commit -m "refactor: share indicator ingestion contracts"`.**

## Task 2: Parse official PBOC monthly reports

**Files:** create `scripts/ingest/fetch/pboc-money-supply.ts`,
`tests/fixtures/pboc/publication-index.html`, three `report-YYYY-MM.html`
fixtures, and the PBOC test file.

- [ ] **Step 1: Build fixtures matching the official page.**

The index contains three valid monthly report anchors, an excluded
interpretation/social-financing link, relative PBOC links, and adjacent ISO
dates. Each report contains the exact M2/M1/M0 labels, percentage values, title,
page date, and the current M1 note:
`修订后的M1包括：流通中货币（M0）、单位活期存款、个人活期存款、非银行支付机构客户备付金`.
Include both `同比增长` and `同比下降`.

- [ ] **Step 2: Add tests for discovery, extraction, and hard failures.**

Assert discovered months are `2025-11`, `2025-12`, `2026-01`; one report yields
`{ m0: 10.8, m1: -0.7, m2: 8.0 }`; missing/duplicate series, malformed numbers,
invalid date/host/title, duplicate months, title-month mismatch, and changed M1
methodology throw `IngestionContractError` or `MethodologyMismatchError`.

- [ ] **Step 3: Implement these exports.**

```ts
export function discoverPBOCMoneySupplyPublications(indexHtml: string): MoneySupplyPublication[];
export function parsePBOCMoneySupplyReport(publication: MoneySupplyPublication, html: string): RawMoneySupplyPublication;
```

Discovery matches only `^\d{4}年\d{1,2}月金融统计数据报告$`, validates dates,
resolves relative links, requires exact `https://www.pbc.gov.cn` origin, derives
`YYYY-MM`, sorts, and rejects duplicate months. Parsing canonicalizes HTML,
verifies page title/date, extracts exactly one M0/M1/M2
`余额 ... 同比增长/下降 N%` value with the right sign, and requires the current
M1 revision note before returning a fingerprint.

- [ ] **Step 4: Run `node --import tsx --test tests/ingestion-pboc-money-supply.test.mjs`; expect pass. Commit `feat: parse official PBOC money supply reports`.**

## Task 3: Normalize and validate the three datasets

**Files:** `scripts/ingest/normalize/money-supply.ts`,
`scripts/ingest/validate/money-supply.ts`, and the PBOC test file.

- [ ] **Step 1: Add tests for normalization and invariants.**

Test `normalizeMoneySupplyDataset(rawReports, existing, 'm1')` preserves `%`,
`yoy`, and `calculation`, sets the expected fingerprint, and writes exact
single-month coverage. Test unit/frequency/metric/fingerprint mismatch, strict
overlap mismatch, incoming/final gaps, and redundant-source pruning.

- [ ] **Step 2: Implement `validateMoneySupplyDataset(dataset, id)`.**

Call the generic validator, then require `CN`, monthly frequency, `%` unit,
`yoy` metric, `PBOC` source, PBOC URLs, the per-ID fingerprint, and finite
numeric values. Do not apply the PMI `[0,100]` bound.

- [ ] **Step 3: Implement this normalizer.**

```ts
export function normalizeMoneySupplyDataset(rawReports: RawMoneySupplyPublication[], existing: IndicatorDataset, id: MoneySupplyDatasetId): IndicatorDataset;
```

Validate existing metadata first; require sorted continuous reports and equal
month sets; reject old publication dates; merge only the selected series with
`mergeObservations`; preserve definition dates and existing dataset metadata;
set the per-ID fingerprint; append one source per report with coverage
`${month} to ${month}`; prune only when coverage union remains complete; validate
the result before return.

- [ ] **Step 4: Run the PBOC test file and commit `feat: normalize PBOC money supply datasets`.**

## Task 4: Add atomic multi-file CLI

**Files:** `scripts/ingest/money-supply-cli.ts`, `package.json`, and the PBOC
test file.

- [ ] **Step 1: Test temporary-directory CLI behavior.**

Invoke the exported runner with `--fixture-index`, `--fixture-dir`, and
`--target-dir`. Assert one run changes required files, a second run is byte
identical and reports all unchanged, and a mismatch in one series fails before
any of the three targets changes.

- [ ] **Step 2: Implement `runMoneySupply(args?)`.**

Default to the official index and `data/indicators`; fixture mode maps URL
basenames into the fixture directory. Select the latest stored month, include
it for overlap verification, fetch through the latest discovered month, and
reject missing months before normalization.

- [ ] **Step 3: Validate before writing.**

Read/validate all three datasets, parse each selected report once, normalize and
validate all candidates, then call `writeIndicatorDataset` for each target only
after all candidates pass. Add this package script:

```json
"ingest:pboc-money-supply": "node --import tsx scripts/ingest/money-supply-cli.ts"
```

- [ ] **Step 4: Run the PBOC tests and `npm run ingest:pboc-money-supply -- --help`; expect no repository data mutation. Commit `feat: add PBOC money supply ingestion CLI`.**

## Task 5: Seed data and extend automation

**Files:** the three indicator JSON files, workflow, and PBOC workflow/data tests.

- [ ] **Step 1: Add the three expected fingerprints to the existing JSON files before the first CLI validation.**

Set `m0.methodologyFingerprint`, `m1.methodologyFingerprint`, and
`m2.methodologyFingerprint` to the constants defined in Task 1 while leaving
all existing observations, source coverage, `updatedAt`, and definition dates
unchanged.

- [ ] **Step 2: Run `npm run ingest:pboc-money-supply -- --target-dir data/indicators` against the official index.**

Expect missing official observations through the latest available report, exact
per-report coverage, and fingerprints. Never weaken a failing contract or copy
values manually.

- [ ] **Step 3: Assert all three seeded datasets share the latest month, have no gaps, retain `%`/`yoy`, use expected fingerprints, cover the final month, and retain `m1.definitionEffectiveFrom === '2025-01'`.**

- [ ] **Step 4: Extend `.github/workflows/update-macro-data.yml`.**

Keep manual and monthly triggers. Add
`npm run ingest:pboc-money-supply -- --target-dir data/indicators`; rename the
job/branch/PR wording to macro data; add `m0.json`, `m1.json`, and `m2.json` to
`add-paths` beside `pmi.json`; retain the official host and
`peter-evans/create-pull-request@v7`; use no browser or direct-main write.

- [ ] **Step 5: Run both ingestion test files and `git diff --check`; expect pass. Commit `feat: automate PBOC money supply updates`.**

## Task 6: Full verification and PR handoff

- [ ] **Step 1:** Run `npm test`; expect all tests pass.
- [ ] **Step 2:** Run `npm run check` and `npm run build`; expect zero Astro diagnostics and successful Pagefind output.
- [ ] **Step 3:** Run `git diff --check origin/main...HEAD`, `git status --short`, and `git diff --stat origin/main...HEAD`; confirm only design/plan, ingestion code/tests, workflow, and three indicator JSON files changed.
- [ ] **Step 4:** Push `codex/issue-51-pboc-money-supply`, create a PR titled `feat: automate PBOC money supply updates` with `Closes #51`, and verify CI on the exact pushed head before claiming completion.
