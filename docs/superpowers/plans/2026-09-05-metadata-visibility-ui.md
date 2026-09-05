# Dataset Metadata Visibility UI Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the homepage dashboard, macro snapshot, and indicator detail pages with the #81/#82 user-facing metadata policy.

**Architecture:** Keep raw indicator datasets and snapshot calculations unchanged. Add `indicatorPresentationAdapter.ts` as a small domain-data-to-UI-model boundary that derives user language such as frequency, value label, change label, comparison method, source name, and coverage. Dashboard, snapshot, and detail metadata consume that model instead of formatting policy-sensitive labels independently.

**Tech Stack:** Astro, TypeScript, Markdown data files, Node test runner, Astro check, static build.

---

## File map

- Create `src/data/indicatorPresentationAdapter.ts`: derive `IndicatorViewModel` from an existing `IndicatorDataset`; no numerical calculations or indicator data storage.
- Create `src/components/IndicatorMetadata.astro`: render the detail-page “如何阅读” block from the view model.
- Create `src/styles/indicator-metadata.css`: responsive styles for the structured detail metadata block.
- Create `tests/indicator-presentation-adapter.test.mjs`: unit tests for the view-model semantics.
- Modify `src/components/MacroDashboard.astro`: consume presentation labels and remove engineering/provenance details from cards.
- Modify `src/components/MacroSnapshot.astro`: remove rules version and render the snapshot update date with user-facing wording.
- Modify `src/data/macroSnapshot.ts`: carry `changeLabel` into snapshot evidence and use it when generating facts.
- Modify `src/pages/concepts/[id].astro`: mount `IndicatorMetadata` and remove audit-style header metadata.
- Modify `src/components/IndicatorChart.astro`: keep the chart and remove the mixed provenance footer now owned by `IndicatorMetadata`.
- Modify `src/styles/dashboard.css`: remove obsolete card provenance styles and retain responsive card layout.
- Modify `src/styles/data.css`: remove obsolete chart provenance styles after the metadata component owns that presentation.
- Modify `tests/dashboard.test.mjs`, `tests/macro-snapshot.test.mjs`, and `tests/indicator-presentation.test.mjs`: update assertions to the new user-facing boundaries.

### Task 1: Define the presentation adapter with failing unit tests

**Files:**
- Create: `tests/indicator-presentation-adapter.test.mjs`
- Create: `src/data/indicatorPresentationAdapter.ts`

- [ ] **Step 1: Write the failing adapter tests**

Create tests that import `getIndicatorData` and `getIndicatorPresentation`. Assert the following exact behavior:

```js
test('derives user-facing frequency and value labels', () => {
  assert.equal(getIndicatorPresentation(getIndicatorData('gdp')).frequencyLabel, '季度');
  assert.equal(getIndicatorPresentation(getIndicatorData('gdp')).valueLabel, '同比');
  assert.equal(getIndicatorPresentation(getIndicatorData('cpi')).frequencyLabel, '月度');
  assert.equal(getIndicatorPresentation(getIndicatorData('cpi')).valueLabel, '同比');
  assert.equal(getIndicatorPresentation(getIndicatorData('fixed-asset-investment')).valueLabel, '累计同比');
  assert.equal(getIndicatorPresentation(getIndicatorData('pmi')).valueLabel, '指数');
});

test('derives comparable recent-change labels without flattening indicator semantics', () => {
  assert.equal(getIndicatorPresentation(getIndicatorData('gdp')).changeLabel, '较上一季度');
  assert.equal(getIndicatorPresentation(getIndicatorData('cpi')).changeLabel, '较上月变化');
  assert.equal(getIndicatorPresentation(getIndicatorData('pmi')).changeLabel, '较上月变化');
  assert.equal(getIndicatorPresentation(getIndicatorData('fixed-asset-investment')).changeLabel, '较上一个累计期');
});

test('derives comparison method, source name, and actual series coverage', () => {
  const gdp = getIndicatorPresentation(getIndicatorData('gdp'));
  assert.match(gdp.comparisonMethod, /上年同期/);
  assert.match(gdp.comparisonMethod, /上一季度/);
  assert.equal(gdp.sourceLabel, '国家统计局');
  assert.equal(gdp.coverage, '2021-Q1 至 2026-Q2');
  assert.ok(gdp.sources.every((source) => source.title && source.url && source.sourceDate && source.coverage));
});

test('keeps source fallback and missing observations explicit', () => {
  const dataset = { ...getIndicatorData('gdp'), source: 'Other agency', data: [] };
  assert.throws(() => getIndicatorPresentation(dataset), /at least one observation/);
  assert.equal(getIndicatorPresentation({ ...getIndicatorData('gdp'), source: 'Other agency' }).sourceLabel, 'Other agency');
});
```

The tests must fail before the adapter exists with a module/function resolution error.

- [ ] **Step 2: Run only the new test file and confirm RED**

Run:

```bash
node --import tsx --test tests/indicator-presentation-adapter.test.mjs
```

Expected: FAIL because `src/data/indicatorPresentationAdapter.ts` and `getIndicatorPresentation` do not exist yet.

- [ ] **Step 3: Implement the minimal adapter**

Define:

```ts
export type IndicatorPresentationSource = {
  title: string;
  url: string;
  sourceDate: string;
  coverage: string;
  role?: string;
};

export type IndicatorViewModel = {
  frequencyLabel: string;
  valueLabel: string;
  changeLabel: string;
  comparisonMethod: string;
  sourceLabel: string;
  coverage: string;
  sources: IndicatorPresentationSource[];
};

export function getIndicatorPresentation(indicator: IndicatorDataset): IndicatorViewModel;
```

Implement the rules from existing domain fields:

- `monthly` → `月度`; `quarterly` → `季度`.
- `yoy` → `同比`; `cumulative_yoy` → `累计同比`; `index` → `指数`.
- Quarterly observations use `较上一季度`; monthly index and monthly year-over-year observations use `较上月变化`; monthly cumulative year-over-year observations use `较上一个累计期`.
- `comparisonMethod` must explain both the value basis and recent-change basis, e.g. quarterly GDP compares the value with the same quarter last year and the recent change with the previous quarter’s reading; monthly CPI compares the value with the same month last year and the recent change with the previous month’s reading; PMI explains the monthly index and its 50 reference line.
- Map `NBS` to `国家统计局` and `PBOC` to `中国人民银行`; return unknown source strings unchanged.
- Derive `coverage` from the first and last observations as `${first.date} 至 ${last.date}` and throw `Indicator dataset must contain at least one observation` for an empty series.
- Copy source records into the view model without exposing `methodologyFingerprint` or any other engineering field.

- [ ] **Step 4: Run the adapter tests and confirm GREEN**

Run:

```bash
node --import tsx --test tests/indicator-presentation-adapter.test.mjs
```

Expected: all adapter tests pass.

- [ ] **Step 5: Commit the adapter boundary**

```bash
git add src/data/indicatorPresentationAdapter.ts tests/indicator-presentation-adapter.test.mjs
git commit -m "feat: add indicator presentation adapter"
```

### Task 2: Align dashboard and snapshot boundaries with failing UI tests

**Files:**
- Modify: `tests/dashboard.test.mjs`
- Modify: `tests/macro-snapshot.test.mjs`
- Modify: `src/data/macroSnapshot.ts`

- [ ] **Step 1: Add RED boundary assertions**

Update `tests/dashboard.test.mjs` so its markup test asserts that `MacroDashboard.astro` imports and uses `getIndicatorPresentation`, `valueLabel`, and `changeLabel`, and does not contain `dataset.source`, `dataset.updatedAt`, `核验来源`, or `静态生成`.

Add a snapshot boundary test that asserts `MacroSnapshot.astro` contains `快照更新` and does not contain `rulesVersion` or `规则版本`.

Add a data-level snapshot assertion that `signal(snapshot, 'gdp').changeLabel === '较上一季度'` and `signal(snapshot, 'cpi').changeLabel === '较上月变化'`. These assertions must fail before the snapshot evidence carries the adapter output.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```bash
node --import tsx --test tests/dashboard.test.mjs tests/macro-snapshot.test.mjs
```

Expected: FAIL on the new UI-boundary and `changeLabel` assertions while existing behavior tests remain diagnostic.

- [ ] **Step 3: Pass the adapter label through snapshot evidence**

Import `getIndicatorPresentation` in `src/data/macroSnapshot.ts`, add `changeLabel: string` to `SnapshotEvidence`, and set it in `makeEvidence` from `getIndicatorPresentation(indicator.dataset).changeLabel`.

Replace each generated fact’s literal `较上一期` with `${evidence.changeLabel}`. Do not change thresholds, risk rules, phase precedence, evidence IDs, or numerical change calculations.

- [ ] **Step 4: Run snapshot tests and confirm the domain presentation behavior is GREEN**

Run:

```bash
node --import tsx --test tests/macro-snapshot.test.mjs
```

Expected: the new change-label assertions pass; update any old assertions that specifically require the prohibited generic wording so they assert the indicator-specific wording instead.

- [ ] **Step 5: Commit the snapshot adapter integration**

```bash
git add src/data/macroSnapshot.ts tests/macro-snapshot.test.mjs tests/dashboard.test.mjs
git commit -m "feat: use indicator-specific change labels"
```

### Task 3: Implement the dashboard user-facing model

**Files:**
- Modify: `src/components/MacroDashboard.astro`
- Modify: `src/styles/dashboard.css`
- Modify: `tests/dashboard.test.mjs`

- [ ] **Step 1: Implement Dashboard consumption of the view model**

For each indicator, compute `const presentation = getIndicatorPresentation(item.dataset)` and render:

```astro
<div class="indicator-card-top">
  <span>{presentation.frequencyLabel}</span>
  <span>{presentation.valueLabel}</span>
</div>
...
<div class="indicator-change">
  <span>{presentation.changeLabel}</span>
  <strong>{formatChange(item.change, item.dataset.metric)}</strong>
</div>
<div class="indicator-meta">
  <span>数据期：{item.latest.date}</span>
</div>
```

Remove the dashboard head’s static-generation note, the card source, card update timestamp, card source details, and their fallback copy. In the recent-changes list, render each item’s `presentation.changeLabel` beside the latest date and change value. Keep the concept link and latest value formatting.

- [ ] **Step 2: Remove obsolete dashboard provenance styles**

Delete styles that only support the removed source details (`.indicator-actions details`, `.indicator-actions li`, `.indicator-actions small`) while keeping the concept link style, responsive grids, negative change styles, and card metadata layout.

- [ ] **Step 3: Run Dashboard tests and confirm GREEN**

Run:

```bash
node --import tsx --test tests/dashboard.test.mjs
```

Expected: all dashboard tests pass, including the absence of engineering/provenance copy and presence of indicator-specific labels.

- [ ] **Step 4: Commit the dashboard boundary**

```bash
git add src/components/MacroDashboard.astro src/styles/dashboard.css tests/dashboard.test.mjs
git commit -m "feat: simplify dashboard metadata"
```

### Task 4: Implement structured detail-page metadata

**Files:**
- Create: `src/components/IndicatorMetadata.astro`
- Create: `src/styles/indicator-metadata.css`
- Modify: `src/pages/concepts/[id].astro`
- Modify: `src/components/IndicatorChart.astro`
- Modify: `src/styles/data.css`
- Modify: `tests/indicator-presentation.test.mjs`

- [ ] **Step 1: Add failing detail-page boundary tests**

Extend `tests/indicator-presentation.test.mjs` to read `IndicatorMetadata.astro` and `[id].astro`. Assert that the metadata component contains `如何阅读`, `指标定义`, `统计频率`, `变化口径`, `数据来源`, `数据集更新时间`, and `覆盖期间`; assert that the detail page mounts `IndicatorMetadata`.

Assert that the metadata component does not contain `methodologyFingerprint`, `runtime`, `静态生成`, or `规则版本`. Move the existing calculation-method test from `IndicatorChart.astro` to the new metadata component if the user-readable calculation explanation remains part of the detail block.

The new assertions must fail before the component exists.

- [ ] **Step 2: Run the focused detail test and confirm RED**

Run:

```bash
node --import tsx --test tests/indicator-presentation.test.mjs
```

Expected: FAIL because the structured metadata component and page integration do not yet exist.

- [ ] **Step 3: Implement `IndicatorMetadata.astro`**

Accept `{ indicator, definition }`, call `getIndicatorPresentation(indicator)`, and render one section with an accessible heading `如何阅读`. Render a definition paragraph from the concept subtitle, then a definition list containing:

```astro
<dt>统计频率</dt><dd>{presentation.frequencyLabel}</dd>
<dt>变化口径</dt><dd>{presentation.comparisonMethod}</dd>
<dt>数据来源</dt><dd>{presentation.sourceLabel}</dd>
<dt>数据集更新时间</dt><dd>{indicator.updatedAt}</dd>
<dt>覆盖期间</dt><dd>{presentation.coverage}</dd>
```

Render each source as an official link with its publication date and source coverage. If the list is empty, render `来源信息待补充`. If `indicator.calculationEffectiveFrom` is present, present the existing human-readable calculation transition as a `口径说明`, not as a parser/runtime/audit field. Do not render `methodologyFingerprint`.

- [ ] **Step 4: Integrate and style the detail metadata**

In `src/pages/concepts/[id].astro`, import and render `<IndicatorMetadata indicator={indicator} definition={entry.data.subtitle} />` immediately before `IndicatorChart` when an indicator exists. Remove the header’s audit-style definition effective/as-of spans and the duplicated source span, leaving the country/region context in the header.

In `IndicatorChart.astro`, keep the chart markup and script unchanged, remove the old mixed `.data-note` provenance footer, and remove its now-unused local calculation-description helper. Delete the obsolete `.data-note` rules from `src/styles/data.css` if no other component uses them.

Style the new section as a bordered, readable card with a two-column label/value layout on wide screens and one column below 760px. Official source links must retain visible focus and external-link semantics.

- [ ] **Step 5: Run detail tests and confirm GREEN**

Run:

```bash
node --import tsx --test tests/indicator-presentation.test.mjs
```

Expected: all detail boundary and calculation-method presentation tests pass.

- [ ] **Step 6: Commit the detail-page metadata**

```bash
git add src/components/IndicatorMetadata.astro src/styles/indicator-metadata.css src/pages/concepts/[id].astro src/components/IndicatorChart.astro src/styles/data.css tests/indicator-presentation.test.mjs
git commit -m "feat: add readable indicator metadata"
```

### Task 5: Finish snapshot UI and run the full verification suite

**Files:**
- Modify: `src/components/MacroSnapshot.astro`
- Modify: `src/styles/snapshot.css`
- Modify: `tests/macro-snapshot.test.mjs`

- [ ] **Step 1: Remove engineering metadata from Snapshot**

Render the snapshot date as `快照更新：{snapshot.asOf}`. Remove the rules-version span. In signal cards, render `signal.changeLabel` before the formatted change value so the UI no longer exposes a generic “较上一期”. Keep facts, interpretations, conclusions, and disclaimer unchanged.

- [ ] **Step 2: Keep snapshot responsive styles valid**

Retain the existing responsive layout and only adjust `.snapshot-meta` if needed for the shorter user-facing label. Do not add a debug/status panel.

- [ ] **Step 3: Run the focused snapshot tests and confirm GREEN**

Run:

```bash
node --import tsx --test tests/macro-snapshot.test.mjs
```

Expected: all snapshot behavior, change-label, and UI boundary tests pass.

- [ ] **Step 4: Commit the snapshot UI**

```bash
git add src/components/MacroSnapshot.astro src/styles/snapshot.css tests/macro-snapshot.test.mjs
git commit -m "feat: hide snapshot engineering metadata"
```

### Task 6: Verify the complete PR and prepare #83

- [ ] **Step 1: Run the complete test suite**

Run:

```bash
npm test
```

Expected: all repository tests pass with zero failures.

- [ ] **Step 2: Run Astro validation**

Run:

```bash
npm run check
```

Expected: Astro check completes with zero errors, warnings, and hints.

- [ ] **Step 3: Run the static production build**

Run:

```bash
npm run build
```

Expected: the site builds all static pages successfully.

- [ ] **Step 4: Check formatting and scope**

Run:

```bash
git diff --check
git status --short
git diff --stat origin/main...HEAD
git log --oneline --decorate origin/main..HEAD
```

Expected: no whitespace errors; only the adapter, three UI surfaces, related styles/tests, the approved spec, and this plan are changed; no data-ingestion or numerical-calculation files are modified.

- [ ] **Step 5: Request review before PR creation**

Use the requesting-code-review workflow with base `origin/main` and the final branch HEAD. Fix Critical and Important findings, rerun the affected tests, and re-run the full verification commands if production code changes.

- [ ] **Step 6: Push and create PR #83**

```bash
git push -u origin codex/issue-83-metadata-visibility
gh pr create --title "feat: align UI with dataset metadata visibility policy" --body "$(cat <<'EOF'
## Summary
- Align homepage dashboard cards and macro snapshot with the #81/#82 user-facing metadata policy.
- Add a presentation adapter and structured indicator detail metadata for frequency, comparison semantics, sources, update time, and coverage.
- Keep engineering metadata internal without changing ingestion or numerical calculation behavior.

Closes #81

## Test Plan
- [x] npm test
- [x] npm run check
- [x] npm run build
- [x] git diff --check
EOF
)"
```

The PR title must match exactly. GitHub assigns the next available PR number; verify the created URL is PR #83 before reporting the handoff.
