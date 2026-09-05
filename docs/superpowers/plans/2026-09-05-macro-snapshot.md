# Macro Snapshot Analysis Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic, explainable macro snapshot layer for the eight existing dashboard indicators, expose it as a separate homepage section, and preserve the existing dashboard and indicator-page contracts.

**Architecture:** Build the snapshot at Astro build time from `getDashboardIndicators()`. A typed rule engine classifies each indicator according to its metric semantics, derives a phase with explicit precedence, and emits evidence-backed risks and watch items. `MacroSnapshot.astro` renders facts and interpretations separately; no browser-side inference or runtime data fetch is introduced.

**Tech Stack:** TypeScript modules, Astro components, CSS, Node `node:test`, Astro check/build scripts.

---

## 1. Establish the red test contract

**Files:** `tests/macro-snapshot.test.mjs` (new)

- [ ] Add test fixtures that model the existing `DashboardIndicator` shape for all eight required IDs, with configurable latest/previous values, periods, units, and `updatedAt` metadata.
- [ ] Add a test that imports the public snapshot API and verifies the default input is the existing dashboard indicator set, with all eight IDs represented exactly once.
- [ ] Add failing classification tests for the metric families:
  - PMI below 50, at 50, above 50, and momentum changes on both sides of the `±0.2` boundary.
  - Growth indicators with positive, zero, and negative latest values plus improving, weakening, and stable changes.
  - Monetary-growth indicators reporting the rate and weakening momentum without claims about demand, prices, or asset prices.
- [ ] Add failing phase tests for the deliberate precedence: expansion, contraction pressure, growth slowing, then mixed signals. Include a case where multiple rules could match to lock the ordering down.
- [ ] Add failing risk tests for each independent risk trigger and a combined case proving multiple risks can coexist.
- [ ] Add failing watch-item tests requiring evidence IDs, current data periods, and next-publication monitoring language; also cover the no-risk fallback watch item.
- [ ] Add tests for deterministic `asOf` (the maximum input `updatedAt`), fixed `macroSnapshotRulesVersion`, and rejection of missing required indicator IDs.
- [ ] Add source-level assertions for the component and homepage contract: facts and interpretations are separate, concept evidence links are present, the no-investment-advice note exists, and the existing dashboard component remains in the page.
- [ ] Run the focused test before implementation and confirm it fails for the missing module/API rather than for a malformed test.

## 2. Implement the deterministic snapshot rule engine

**Files:** `src/data/macroSnapshot.ts` (new)

- [ ] Define and export the typed model from the spec: `SnapshotEvidence`, `SnapshotSignal`, `SnapshotConclusion`, phase output, and `MacroSnapshot`.
- [ ] Export a fixed `macroSnapshotRulesVersion` string and `buildMacroSnapshot(indicators = getDashboardIndicators())`.
- [ ] Validate that the input contains exactly the required dashboard indicator IDs (`gdp`, `pmi`, `m0`, `m1`, `m2`, `industrial-production`, `retail-sales`, `fixed-asset-investment`); throw a clear error for missing inputs instead of silently fabricating data.
- [ ] Implement separate family classifiers using the explicit thresholds from the spec:
  - PMI uses the 50 index threshold and `±0.2` momentum boundaries.
  - GDP, industrial production, retail sales, and fixed-asset investment use positive/non-positive latest growth and `±0.2` change boundaries.
  - M0, M1, and M2 report facts and only label a change below `-0.2` as weakening monetary-growth momentum.
- [ ] Build one signal per indicator in stable dashboard order, retaining latest value, previous value, change, period, unit, fact text, interpretation text, and evidence metadata.
- [ ] Derive the phase from the five activity indicators only, with the exact precedence and counts in the approved design. Include the selected evidence IDs and explain the rule outcome in plain language.
- [ ] Derive independent risk conclusions using the PMI threshold, three-weakening-activity threshold, non-positive activity level, and weakening monetary-growth rules. Do not add causal or investment claims.
- [ ] Generate watch conclusions from the triggered risks with relevant evidence IDs, each current period, and “observe the next published observation” wording. Generate the stable fallback when there are no risks.
- [ ] Derive `asOf` only from input dataset metadata and return a fully serializable object with no wall-clock values or runtime fetches.
- [ ] Run `node --test tests/macro-snapshot.test.mjs` and make the focused suite pass.

## 3. Add the readable snapshot UI

**Files:** `src/components/MacroSnapshot.astro` (new), `src/styles/snapshot.css` (new or existing shared stylesheet if inspection shows the project convention requires it)

- [ ] Define the component prop as the typed `MacroSnapshot` and render the header, data-derived `asOf`, rules version, and no-investment-advice note.
- [ ] Render the selected phase label and explanation as a rule-based interpretation, with links for every referenced evidence ID.
- [ ] Render each indicator signal with observed fact fields visually separate from interpretation fields; show latest value, previous value/change where available, period, and unit.
- [ ] Render risks and watch-next items as independent sections. Each evidence reference must link to `/concepts/{id}` and retain readable indicator text.
- [ ] Add responsive, accessible markup consistent with the existing MacroLens card styles, including headings, lists, link labels, and visible distinction between facts and interpretations.
- [ ] Keep copy scoped to observation and monitoring; do not introduce recommendations to buy, sell, allocate, or take action.
- [ ] Run the component/source contract tests and `npm run check`.

## 4. Integrate without changing existing dashboard behavior

**Files:** `src/pages/index.astro`

- [ ] Import `MacroSnapshot` and `buildMacroSnapshot`.
- [ ] Build `const snapshot = buildMacroSnapshot(dashboardIndicators)` from the same existing dashboard adapter used by `MacroDashboard`.
- [ ] Render `<MacroSnapshot snapshot={snapshot} />` as a separate section below the existing dashboard, leaving `MacroDashboard` props, markup, and data logic unchanged.
- [ ] Update homepage source assertions to verify the dashboard remains present and the new snapshot receives build-time data.
- [ ] Run focused snapshot tests, the complete Node test suite, `npm run check`, and `npm run build`.

## 5. Review, verify, and prepare the pull request

**Files:** implementation files and documentation above

- [ ] Review the diff for accidental edits to indicator JSON, dashboard behavior, relationship explorer behavior, or primary navigation.
- [ ] Run `git diff --check` and inspect `git status --short`.
- [ ] Run the final verification set from the worktree: `npm test`, `npm run check`, and `npm run build`; record the actual results before claiming completion.
- [ ] Commit the implementation with a focused message such as `feat: add deterministic macro snapshot layer`.
- [ ] Push `codex/issue-70-macro-snapshot` to `origin`.
- [ ] Create a new GitHub pull request against `main`, link it to Issue #70 with `Closes #70`, summarize the deterministic rules and fact/interpretation separation, and include the verification commands/results.
- [ ] Inspect the created PR and CI status; report the PR URL and any remaining CI state without merging it.

