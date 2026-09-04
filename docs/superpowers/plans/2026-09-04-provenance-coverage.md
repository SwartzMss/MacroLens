# Structured National Data Provenance Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-observation structured National Data coverage strings with compact, stable, and truthful coverage metadata while preserving all data and request provenance semantics.

**Architecture:** Add a pure coverage formatter beside the structured NBS parser. It will group consecutive periods using the existing real-economy period rules and encode complete yearly Jan-Feb sequences with an explicit `(annual)` qualifier. Extend real-economy coverage validation to parse that qualifier and match only the represented yearly periods; source parsing, normalization, request construction, and JSON writing remain otherwise unchanged.

**Tech Stack:** TypeScript, Astro ingestion scripts, Node.js test runner with `tsx`, JSON indicator datasets.

---

## File map

- Modify `scripts/ingest/fetch/nbs-real-economy.ts`: format accepted structured-source periods before creating `IndicatorSource` records.
- Modify `scripts/ingest/validate/real-economy.ts`: parse and evaluate ordinary and annual compact coverage ranges.
- Modify `tests/ingestion-nbs-real-economy.test.mjs`: add formatter/parser regression coverage and update structured National Data expectations.
- Modify `data/indicators/industrial-production.json`, `data/indicators/retail-sales.json`, and `data/indicators/fixed-asset-investment.json`: replace expanded structured-source coverage text with the formatter's compact output. `gdp.json` is inspected and remains unchanged unless a structured-source record is present.
- No changes to `scripts/ingest/normalize/real-economy.ts`, request construction, indicator observation values, or unrelated PBOC tests.

### Task 1: Define failing coverage-formatting tests

**Files:**
- Modify: `tests/ingestion-nbs-real-economy.test.mjs`
- Test target: `tests/ingestion-nbs-real-economy.test.mjs`

- [ ] **Step 1: Add tests for compact structured-source coverage behavior.** Import the new `compactRealEconomyCoverage` helper from `fetch/nbs-real-economy.ts` and add these cases:

```js
test('compresses consecutive structured National Data periods into one range', () => {
  assert.equal(
    compactRealEconomyCoverage(['2026-01–02', '2026-01–03', '2026-01–04', '2026-01–07'], 'fixed-asset-investment'),
    '2026-01–02 to 2026-01–04; 2026-01–07 to 2026-01–07',
  );
  assert.equal(
    compactRealEconomyCoverage(['2025-03', '2025-04', '2025-05'], 'industrial-production'),
    '2025-03 to 2025-05',
  );
});

test('compresses complete annual Jan-Feb source coverage without implying monthly coverage', () => {
  assert.equal(
    compactRealEconomyCoverage(['2023-01–02', '2024-01–02', '2025-01–02'], 'retail-sales'),
    '2023-01–02 to 2025-01–02 (annual)',
  );
});

test('does not compress an annual source across a missing year', () => {
  assert.equal(
    compactRealEconomyCoverage(['2023-01–02', '2025-01–02'], 'retail-sales'),
    '2023-01–02 to 2023-01–02; 2025-01–02 to 2025-01–02',
  );
});
```

- [ ] **Step 2: Run only the new tests to confirm the expected RED failure.**

Run: `node --import tsx --test tests/ingestion-nbs-real-economy.test.mjs`

Expected: the existing tests run, and the three new tests fail because `compactRealEconomyCoverage` is not yet exported.

### Task 2: Implement and integrate the coverage formatter

**Files:**
- Modify: `scripts/ingest/fetch/nbs-real-economy.ts:450-518`
- Test: `tests/ingestion-nbs-real-economy.test.mjs`

- [ ] **Step 1: Add the minimal pure formatter.** Implement and export:

```ts
export function compactRealEconomyCoverage(
  periods: Iterable<string>,
  id: RealEconomyDatasetId,
): string
```

The implementation must sort and de-duplicate periods, identify complete consecutive `YYYY-01–02` yearly runs first, then group remaining dates when `nextPeriod(previous, id)` equals the next date. Render singleton groups as `date to date`, ordinary groups as `start to end`, annual groups as `start to end (annual)`, and join groups with `; `.

- [ ] **Step 2: Replace per-observation formatting in `parseNbsRealEconomyResponse`.** Change only the `coverage` field construction from:

```ts
coverage: [...periods].sort().map((date) => `${date} to ${date}`).join('; '),
```

to:

```ts
coverage: compactRealEconomyCoverage(periods, contract.id),
```

- [ ] **Step 3: Run the targeted test file and verify GREEN for the new formatter tests.**

Run: `node --import tsx --test tests/ingestion-nbs-real-economy.test.mjs`

Expected: the formatter tests pass; any remaining failures are the three known baseline PBOC failures from the full suite, not this task.

- [ ] **Step 4: Commit the formatter implementation.**

```bash
git add scripts/ingest/fetch/nbs-real-economy.ts tests/ingestion-nbs-real-economy.test.mjs
git commit -m "feat: compact structured NBS coverage ranges"
```

### Task 3: Make annual coverage validation truthful

**Files:**
- Modify: `scripts/ingest/validate/real-economy.ts:68-89`
- Test: `tests/ingestion-nbs-real-economy.test.mjs`

- [ ] **Step 1: Add failing validation tests.** Add a test using the exported `realEconomyCoverageCoversDates` helper:

```js
test('annual coverage matches only the represented period in each year', () => {
  const sources = [{
    title: 'annual Jan-Feb',
    url: 'https://data.stats.gov.cn/source',
    sourceDate: '2026-01-01',
    coverage: '2023-01–02 to 2025-01–02 (annual)',
  }];
  assert.equal(realEconomyCoverageCoversDates(sources, ['2023-01–02', '2024-01–02', '2025-01–02'], 'retail-sales'), true);
  assert.equal(realEconomyCoverageCoversDates(sources, ['2024-03'], 'retail-sales'), false);
});
```

- [ ] **Step 2: Run the validation test to confirm RED.**

Run: `node --import tsx --test tests/ingestion-nbs-real-economy.test.mjs`

Expected: the annual validation test fails because the current parser treats `(annual)` as part of the end period.

- [ ] **Step 3: Extend `coverageRanges` with an explicit annual flag.** Parse `start to end (annual)` into `{ start, end, annual: true }`; validate both endpoints with `validPeriod`, require the same non-year period suffix, and retain ordinary `{ start, end, annual: false }` parsing.

- [ ] **Step 4: Update `realEconomyCoverageCoversDates`.** For annual ranges, return true only when the candidate date has the same suffix as the range endpoints and its year is within the inclusive endpoint years. For ordinary ranges, preserve the existing `periodRank` comparison.

- [ ] **Step 5: Run the targeted suite and confirm GREEN.**

Run: `node --import tsx --test tests/ingestion-nbs-real-economy.test.mjs`

Expected: all NBS real-economy tests pass, with only the previously recorded unrelated PBOC baseline failures appearing if the complete `npm test` command is used.

- [ ] **Step 6: Commit the validation change.**

```bash
git add scripts/ingest/validate/real-economy.ts tests/ingestion-nbs-real-economy.test.mjs
git commit -m "fix: validate annual NBS coverage semantics"
```

### Task 4: Assert parser integration and stable no-change output

**Files:**
- Modify: `tests/ingestion-nbs-real-economy.test.mjs`

- [ ] **Step 1: Strengthen structured National Data integration assertions.** For the fixture that contains monthly and cumulative source codes, assert that the monthly source coverage is a single compressed range and the cumulative source coverage is the annual form. For fixed-asset-investment, assert its long cumulative coverage is one start-to-end range.

- [ ] **Step 2: Add a gap regression at parser level.** Build a structured payload with a missing period and assert its source coverage contains separate ranges rather than one range spanning the gap.

- [ ] **Step 3: Retain and run the existing different-run-time idempotency test.** Assert the two normalized datasets are deep-equal and the second `writeIndicatorDataset` call returns `changed: false`; assert request URL/body fields remain unchanged.

- [ ] **Step 4: Run the focused NBS test suite.**

Run: `node --import tsx --test tests/ingestion-nbs-real-economy.test.mjs`

Expected: NBS real-economy tests pass.

### Task 5: Migrate persisted NBS coverage metadata

**Files:**
- Modify: `data/indicators/industrial-production.json`
- Modify: `data/indicators/retail-sales.json`
- Modify: `data/indicators/fixed-asset-investment.json`
- Inspect: `data/indicators/gdp.json`

- [ ] **Step 1: Replace only expanded structured-source coverage strings.** Use the formatter's output for the checked-in datasets: monthly sources become one continuous range, annual Jan-Feb sources become an `(annual)` range, and fixed-asset cumulative periods become one continuous range. Preserve source title, URL, sourceDate, role, request object, data, and all non-coverage fields.

- [ ] **Step 2: Validate the JSON-only diff.**

Run: `git diff --check` and `git diff -- data/indicators/industrial-production.json data/indicators/retail-sales.json data/indicators/fixed-asset-investment.json`

Expected: only the intended `coverage` values differ in the three files.

- [ ] **Step 3: Commit the persisted metadata migration.**

```bash
git add data/indicators/industrial-production.json data/indicators/retail-sales.json data/indicators/fixed-asset-investment.json
git commit -m "data: compact NBS provenance coverage"
```

### Task 6: Full verification and PR preparation

**Files:**
- Modify: none unless verification exposes an issue.

- [ ] **Step 1: Run the complete test suite.**

Run: `npm test`

Expected: all NBS real-economy tests pass; the three known PBOC money-supply failures remain unchanged unless independently fixed, and their exact names are recorded in the PR description.

- [ ] **Step 2: Run type checking and production build.**

Run: `npm run check`

Expected: exit code 0.

Run: `npm run build`

Expected: exit code 0 and a generated `dist` directory.

- [ ] **Step 3: Review the final diff and branch state.**

Run: `git diff origin/main...HEAD --stat`, `git diff origin/main...HEAD --check`, and `git status --short`.

Expected: only the design/plan docs, coverage formatter/validator, focused tests, and intended NBS coverage metadata are changed; no `dist` or dependency artifacts are tracked.

- [ ] **Step 4: Push the branch and create the PR linked to Issue #66.**

```bash
git push -u origin codex/issue-66-provenance-coverage
gh pr create --repo SwartzMss/MacroLens --base main --head codex/issue-66-provenance-coverage --title "fix: compact structured NBS provenance coverage" --body "Closes #66\n\nCompacts structured National Data coverage metadata into stable continuous and annual ranges, preserving request provenance and data semantics.\n\nTests: npm test (3 pre-existing PBOC failures remain), npm run check, npm run build."
```

Do not claim completion until the verification commands have produced their stated results and the PR URL is returned.
