# NBS Price Methodology Validation Robustness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make live NBS CPI, Core CPI, and PPI methodology validation resilient to inline HTML whitespace while preserving hard failure on real methodology changes.

**Architecture:** Keep textOf() unchanged and normalize whitespace only inside assertObservableMethodology(). Pass the publication URL into that guard so failures identify the exact official source without logging raw HTML. Add focused offline tests in the existing NBS price ingestion suite, then verify the full repository and the live workflow.

**Tech Stack:** TypeScript, Node test runner, tsx, Astro, GitHub Actions.

---

### Task 1: Add split-tag methodology regression tests

**Files:**
- Modify: tests/ingestion-nbs-prices.test.mjs near the existing price methodology tests

- [ ] **Step 1: Add failing CPI and Core CPI split-tag tests**

Use the existing fixtures and replace only the methodology phrase with markup that creates whitespace at inline-element boundaries:

~~~
test('accepts CPI and core CPI methodology split across inline tags', () => {
  for (const id of ['cpi', 'core-cpi']) {
    const fixture = priceFixture(id);
    const variant = fixture.html.replace(
      '2026年1月起，',
      '<span>2026年1月</span><span>起</span>，',
    ).replace(
      '2025年为基期',
      '<span>2025年</span><span>为基期</span>',
    );
    assert.doesNotThrow(() => parseNbsPricePublication(fixture.publication, variant, id));
  }
});
~~~

- [ ] **Step 2: Add failing PPI tests for both supported wording variants**

Add one test that exercises both 起 and 开始编制和发布 while splitting the semantic phrase across tags:

~~~
test('accepts PPI methodology wording variants split across inline tags', () => {
  const fixture = priceFixture('ppi');
  for (const wording of [
    '<span>2026年1月</span><span>起</span>，工业生产者出厂价格指数以<span>2025年</span><span>为基期</span>。',
    '<span>2026年1月份</span><span>开始编制和发布</span>以<span>2025年</span><span>为基期</span>的PPI。',
  ]) {
    const variant = fixture.html.replace(
      '2026年1月起，工业生产者出厂价格指数以2025年为基期。',
      wording,
    );
    assert.doesNotThrow(() => parseNbsPricePublication(fixture.publication, variant, 'ppi'));
  }
});
~~~

- [ ] **Step 3: Extend mismatch coverage for missing markers and URL diagnostics**

Keep the existing wrong-base-year assertion and add a missing-marker assertion that checks the publication URL:

~~~
test('reports the publication URL for missing price methodology', () => {
  for (const id of ['cpi', 'core-cpi', 'ppi']) {
    const fixture = priceFixture(id);
    assert.throws(
      () => parseNbsPricePublication(
        fixture.publication,
        fixture.html.replace(/<p>2026年1月起[\s\S]*?<\/p>/, ''),
        id,
      ),
      (error) => error instanceof MethodologyMismatchError
        && error.message.includes(fixture.publication.url),
    );
  }
});
~~~

- [ ] **Step 4: Run the focused suite and confirm the new tests fail for the current guard**

Run:

~~~
node --import tsx -e "import('./tests/ingestion-nbs-prices.test.mjs')"
~~~

Expected: the new split-tag tests fail with MethodologyMismatchError; existing tests, including bare 同比持平, remain green.

### Task 2: Normalize only methodology matching and add URL context

**Files:**
- Modify: scripts/ingest/fetch/nbs-prices.ts in assertObservableMethodology() and parseNbsPricePublication()

- [ ] **Step 1: Change the guard signature and compact only its local matching text**

Implement the guard as:

~~~
function assertObservableMethodology(text: string, id: PriceDatasetId, url: string): void {
  const compact = text.replace(/\s+/g, '');
  const marker = /2026年1月份?(?:起|开始编制和发布).{0,240}2025年为基期/;
  if (!marker.test(compact)) {
    throw new MethodologyMismatchError(
      'Official ' + id + ' publication is missing the expected 2025-base methodology marker: ' + url,
    );
  }
}
~~~

- [ ] **Step 2: Pass the official publication URL at the call site**

Change the parser call to:

~~~
assertObservableMethodology(visible, id, publication.url);
~~~

Do not change textOf(), publishedValue(), or coreCpiTableValue().

- [ ] **Step 3: Run the focused suite and confirm all price tests pass**

Run:

~~~
node --import tsx -e "import('./tests/ingestion-nbs-prices.test.mjs')"
~~~

Expected: all focused tests pass, including split-tag CPI/Core CPI/PPI, wrong-base-year rejection, missing-marker URL diagnostics, and bare 同比持平 parsing.

- [ ] **Step 4: Commit the implementation and regression tests**

~~~
git add scripts/ingest/fetch/nbs-prices.ts tests/ingestion-nbs-prices.test.mjs
git commit -m "fix: harden NBS price methodology matching"
~~~

### Task 3: Run repository verification

**Files:**
- No additional files

- [ ] **Step 1: Run the complete test suite**

~~~
npm test
~~~

Expected: zero failures.

- [ ] **Step 2: Run Astro diagnostics**

~~~
npm run check
~~~

Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 3: Run the production build**

~~~
npm run build
~~~

Expected: exit code 0; the existing large-client-chunk warning is non-blocking.

- [ ] **Step 4: Verify the worktree is clean except for committed changes**

~~~
git diff --check
git status --short --branch
~~~

Expected: no whitespace errors and no uncommitted source changes.

### Task 4: Create the PR and run the live workflow

**Files:**
- No additional files

- [ ] **Step 1: Push the issue branch**

~~~
git push -u origin codex/issue-76
~~~

- [ ] **Step 2: Create the pull request**

Create a PR against main referencing issue #76. The body must state that the guard compacts whitespace locally, preserves methodology mismatch failures, includes source URL diagnostics, and has offline split-tag coverage.

- [ ] **Step 3: After the PR is merged, dispatch the full workflow**

~~~
gh workflow run update-macro-data.yml --ref main
~~~

- [ ] **Step 4: Verify the workflow run**

~~~
gh run list --workflow update-macro-data.yml --limit 1
gh run watch <run-id> --exit-status
~~~

Expected: PMI, PBOC money supply, real-economy datasets, CPI, Core CPI, and PPI all succeed; unchanged official values produce no unnecessary data PR.
