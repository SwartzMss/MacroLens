# Dynamic Provenance Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the V1 indicator audit derive provenance coverage from checked-in observations instead of maintaining a hard-coded list of monthly price URLs.

**Architecture:** Keep the audit in `tests/indicator-data-integrity.test.mjs` and put reusable coverage parsing in `tests/helpers/coverage.mjs`. The generic contract will require every observation period in every dataset to be covered by a source whose effective role is `data` and whose URL is official. Coverage parsing will support exact, ranged, quarterly, cumulative, and annual-shaped periods already used by the checked-in datasets. Because `role` is optional in the existing schema, an omitted role remains backward-compatible shorthand for `data`; an explicit `methodology` role never satisfies the contract. Price-specific assertions will additionally require exact-month data sources and reject known interpretation-page titles without locking historical URLs.

**Tech Stack:** Node test runner, `tsx` loader, checked-in JSON datasets, JavaScript assertions.

---

### Task 1: Replace hard-coded price URL audit with dynamic provenance coverage

**Files:**
- Create: `tests/helpers/coverage.mjs`
- Create: `tests/coverage.test.mjs`
- Modify: `tests/indicator-data-integrity.test.mjs`

- [ ] **Step 1: Add the failing generic provenance assertion**

  Add a test helper that parses semicolon-separated coverage segments, compares period ranks for monthly, quarterly, and cumulative periods, and applies the existing annual suffix rule. Then, in the existing `all V1 indicator datasets satisfy the explicit data contract` test, derive each dataset's expected coverage from its observations and require a source with effective role `data` to cover every period:

  ```js
  function isDataSource(source) {
    return (source.role ?? 'data') === 'data';
  }

  for (const observation of dataset.data) {
    const covered = dataset.sources.some((source) => (
      isDataSource(source) && coversPeriod(source.coverage, observation.date)
    ));
    assert.ok(covered, `${id} ${observation.date} missing data provenance`);
  }
  ```

- [ ] **Step 2: Add focused coverage helper regression tests**

  In `tests/coverage.test.mjs`, cover exact month ranges, quarter ranges, cumulative periods, annual-shaped coverage, semicolon-separated ranges, malformed coverage, and the optional-role default:

  ```js
  assert.equal(coversPeriod('2026-01 to 2026-07', '2026-04'), true);
  assert.equal(coversPeriod('2021-Q1 to 2026-Q2', '2026-Q1'), true);
  assert.equal(coversPeriod('2011-01–02 to 2026-01–07', '2026-01–03'), true);
  assert.equal(coversPeriod('2011-01–02 to 2026-01–02 (annual)', '2025-01–02'), true);
  assert.equal(isDataSource({ role: 'methodology' }), false);
  ```

- [ ] **Step 3: Run the integrity test and verify the new contract passes**

  Run: `node --import tsx --test tests/indicator-data-integrity.test.mjs`

  Expected: PASS for all integrity subtests. Existing datasets already contain exact-period data sources for the monthly and quarterly observations covered by this audit.

- [ ] **Step 4: Remove the hard-coded `officialPriceSources` object**

  Delete the month-to-URL map and replace the price-specific test with a dynamic regression that requires an exact data source for every price observation and rejects interpretation-page titles:

  ```js
  test('price data sources use exact official releases, not interpretation pages', () => {
    for (const id of ['cpi', 'core-cpi', 'ppi']) {
      const dataset = readDataset(id);
      for (const observation of dataset.data) {
        const source = dataset.sources.find(({ role, coverage }) => (
          (role ?? 'data') === 'data' && coverage === `${observation.date} to ${observation.date}`
        ));
        assert.ok(source, `${id} ${observation.date} missing exact data provenance`);
        assert.doesNotMatch(source.title, /解读|国民经济运行总体平稳/, `${id} data source title`);
      }
    }
  });
  ```

- [ ] **Step 5: Run the full verification suite**

  Run:

  ```bash
  npm test
  npm run check
  npm run build
  npm audit --audit-level=high
  ```

  Expected: tests pass, Astro reports 0 errors/warnings/hints, static build succeeds, and audit reports 0 vulnerabilities.

- [ ] **Step 6: Commit the focused change**

  ```bash
  git add tests/helpers/coverage.mjs tests/coverage.test.mjs tests/indicator-data-integrity.test.mjs docs/superpowers/plans/2026-09-05-dynamic-provenance-audit.md
  git commit -m "test: extract reusable provenance coverage helper"
  ```
