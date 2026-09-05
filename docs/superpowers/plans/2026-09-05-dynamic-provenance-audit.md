# Dynamic Provenance Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the V1 indicator audit derive provenance coverage from checked-in observations instead of maintaining a hard-coded list of monthly price URLs.

**Architecture:** Keep the audit in `tests/indicator-data-integrity.test.mjs`. The generic contract will require every observation period in every dataset to have one exact-period source with `role: data`, an official source host, and valid source metadata. Price-specific assertions will remain focused on rejecting known interpretation-page titles without locking historical URLs.

**Tech Stack:** Node test runner, `tsx` loader, checked-in JSON datasets, JavaScript assertions.

---

### Task 1: Replace hard-coded price URL audit with dynamic provenance coverage

**Files:**
- Modify: `tests/indicator-data-integrity.test.mjs`

- [ ] **Step 1: Add the failing generic provenance assertion**

  In the existing `all V1 indicator datasets satisfy the explicit data contract` test, after source metadata validation, derive each dataset's expected coverage from its observations and require an exact `data` source for every period:

  ```js
  const observedPeriods = new Set(dataset.data.map(({ date }) => date));
  for (const period of observedPeriods) {
    const source = dataset.sources.find(({ role, coverage }) => (
      role === 'data' && coverage === `${period} to ${period}`
    ));
    assert.ok(source, `${id} ${period} missing official data provenance`);
  }
  ```

- [ ] **Step 2: Run the integrity test and verify the new contract passes**

  Run: `node --import tsx --test tests/indicator-data-integrity.test.mjs`

  Expected: PASS for all integrity subtests. Existing datasets already contain exact-period data sources for the monthly and quarterly observations covered by this audit.

- [ ] **Step 3: Remove the hard-coded `officialPriceSources` object**

  Delete the month-to-URL map and replace the price-specific test with a dynamic negative regression over the price datasets:

  ```js
  test('price data sources are not interpretation-page provenance', () => {
    for (const id of ['cpi', 'core-cpi', 'ppi']) {
      const dataset = readDataset(id);
      for (const source of dataset.sources.filter(({ role }) => role === 'data')) {
        assert.doesNotMatch(source.title, /解读|国民经济运行总体平稳/, `${id} data source title`);
      }
    }
  });
  ```

- [ ] **Step 4: Run the full verification suite**

  Run:

  ```bash
  npm test
  npm run check
  npm run build
  npm audit --audit-level=high
  ```

  Expected: tests pass, Astro reports 0 errors/warnings/hints, static build succeeds, and audit reports 0 vulnerabilities.

- [ ] **Step 5: Commit the focused change**

  ```bash
  git add tests/indicator-data-integrity.test.mjs docs/superpowers/plans/2026-09-05-dynamic-provenance-audit.md
  git commit -m "test: derive provenance audit coverage from observations"
  ```

