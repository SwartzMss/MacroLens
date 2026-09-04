# GDP HTML Text Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize visible text before GDP methodology and table-selection checks so official markup split across HTML tags cannot cause false methodology failures.

**Architecture:** Reuse the existing `textOf()` helper in `scripts/ingest/fetch/nbs-real-economy.ts`. Page-level checks and candidate-table checks will canonicalize visible text, while row/cell extraction and all statistical validation remain unchanged. Add a deterministic HTML regression in the existing NBS real-economy test file.

**Tech Stack:** TypeScript, Node test runner, tsx, Astro check/build.

---

### Task 1: Add the split-markup GDP regression test

**Files:**
- Modify: `tests/ingestion-nbs-real-economy.test.mjs` near the existing GDP parser tests
- Test: `tests/ingestion-nbs-real-economy.test.mjs`

- [ ] **Step 1: Add a fixture transformation that splits visible GDP phrases and labels across tags**

Add this test after the existing GDP level-table rejection test:

```js
test('parses GDP release text when official markup splits visible phrases across tags', () => {
  const publication = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'nbs', 'real-economy', 'gdp-quarterly.json'), 'utf8')).publication;
  const splitMarkup = gdpFixture()
    .replace('GDP同比增长速度', '<span>GDP</span><span>同比增长速度</span>')
    .replace('国内生产总值', '<strong>国内生产</strong><strong>总值</strong>')
    .replace('初步核算结果', '<em>初步核算</em><em>结果</em>')
    .replace('单位：%', '<span>单位：</span><span>%</span>')
    .replace('增长速度按不变价计算', '<span>增长速度按</span><span>不变价计算</span>')
    .replace('同比增长速度为与上年同期对比', '<span>同比增长速度为与</span><span>上年同期对比</span>')
    .replace('年份', '<span>年</span><span>份</span>')
    .replace('1季度', '<span>1</span><span>季度</span>');

  const parsed = parseNbsGdpPublication(publication, splitMarkup);

  assert.deepEqual(parsed.observations.at(-1), { date: '2026-Q2', value: 4.3 });
  assert.equal(parsed.seriesTitle, 'GDP同比增长速度');
});
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run: `node --import tsx --test tests/ingestion-nbs-real-economy.test.mjs`

Expected: the new test fails with `MethodologyMismatchError` for `GDP release title` or `GDP YoY table`, because the current implementation canonicalizes raw HTML and leaves tags between the visible words.

### Task 2: Normalize visible text in the GDP parser

**Files:**
- Modify: `scripts/ingest/fetch/nbs-real-economy.ts:313-330`

- [ ] **Step 1: Normalize the full release before methodology checks**

Replace:

```ts
const compact = canonical(html);
```

with:

```ts
const compact = canonical(textOf(html));
```

- [ ] **Step 2: Normalize candidate table text and preceding text**

Replace the table selector body with:

```ts
const table = tables.find((match) => {
  const tableText = canonical(textOf(match[0]));
  const beforeTable = canonical(textOf(html.slice(Math.max(0, (match.index ?? 0) - 1200), match.index ?? 0)));
  return (beforeTable + tableText).includes('GDP同比增长速度') && tableText.includes('年份') && tableText.includes('1季度');
});
```

Do not change the checks, table ordering, row parsing, quarter-column validation, observation validation, coverage, or provenance fields.

- [ ] **Step 3: Re-run the focused test and verify it passes**

Run: `node --import tsx --test tests/ingestion-nbs-real-economy.test.mjs`

Expected: all tests in the file pass, including the split-markup regression and the existing strict rejection cases.

### Task 3: Verify the complete change and prepare the PR

**Files:**
- Review: `scripts/ingest/fetch/nbs-real-economy.ts`
- Review: `tests/ingestion-nbs-real-economy.test.mjs`

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: zero failures.

- [ ] **Step 2: Run static checks and build**

Run: `npm run check`

Expected: 0 errors, 0 warnings, 0 hints.

Run: `npm run build`

Expected: exit code 0; existing non-fatal bundle-size and Pagefind language notes may remain.

- [ ] **Step 3: Check the patch and commit it**

Run: `git diff --check origin/main...HEAD && git status --short`

Expected: no whitespace errors; only the intended parser/test changes and the committed design/plan documents are present.

Commit:

```bash
git add docs/superpowers/specs/2026-09-04-gdp-html-normalization-design.md docs/superpowers/plans/2026-09-04-gdp-html-normalization.md scripts/ingest/fetch/nbs-real-economy.ts tests/ingestion-nbs-real-economy.test.mjs
git commit -m "fix: normalize GDP release HTML text"
```

- [ ] **Step 4: Push and create the issue-linked PR**

Run: `git push -u origin codex/issue-61-gdp-html-normalization`

Create a PR against `main` with title `Fix GDP release HTML text normalization` and body containing `Fixes #61`, the visible-text normalization summary, preserved contract behavior, and the commands/results from Steps 1–2.

