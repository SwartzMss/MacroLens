# Domain-Based Macro State Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat Macro Snapshot phase/rule engine with deterministic domain analysis for all 18 registered official indicator datasets while preserving explicit evidence, conservative wording, and the existing Dashboard boundary.

**Architecture:** Keep `src/data/macroSnapshot.ts` as the public facade. Add focused evidence, six domain, and synthesis modules under `src/data/macroSnapshot/`; domain modules return structured state and conclusions, while synthesis consumes only those domain states. The homepage continues to build the 11-card Dashboard separately and passes a canonical macro-indicator map to the Snapshot component.

**Tech Stack:** TypeScript via `tsx`, Astro 7, Node `node:test`, ECharts-compatible indicator dataset types, existing JSON registry and presentation adapter.

---

## File map

- Create: `src/data/macroSnapshot/types.ts` — canonical macro indicator IDs, normalized evidence, domain state, synthesis, and snapshot types.
- Create: `src/data/macroSnapshot/evidence.ts` — dataset-to-evidence conversion, series/event handling, and freshness metadata.
- Create: `src/data/macroSnapshot/growth.ts` — Growth / Activity rules.
- Create: `src/data/macroSnapshot/prices.ts` — Prices rules.
- Create: `src/data/macroSnapshot/creditLiquidity.ts` — Credit & Liquidity rules.
- Create: `src/data/macroSnapshot/policyFinancialConditions.ts` — policy-rate and LPR rules.
- Create: `src/data/macroSnapshot/labor.ts` — Labor rules.
- Create: `src/data/macroSnapshot/external.ts` — External rules.
- Create: `src/data/macroSnapshot/synthesis.ts` — top-level synthesis from domain states only.
- Modify: `src/data/macroSnapshot.ts` — facade and registry input validation.
- Modify: `src/pages/index.astro` — pass the full macro-indicator map independently of Dashboard indicators.
- Modify: `src/components/MacroSnapshot.astro` — render synthesis, domains, evidence freshness, risks, and watch-next items.
- Modify: `src/styles/snapshot.css` — responsive domain/evidence layout.
- Replace: `tests/macro-snapshot.test.mjs` — domain-focused fixtures and source-contract assertions.
- Modify: `tests/indicator-step-series.test.mjs` and `tests/ingestion-policy-rate.test.mjs` — already committed in `8f6c829`; do not regress their data-driven date assertions.
- Create: `docs/superpowers/specs/2026-09-07-domain-macro-state-design.md` — already committed in `877e3c6`.

## Task 1: Add the normalized macro snapshot model and evidence builder

**Files:**
- Create: `src/data/macroSnapshot/types.ts`
- Create: `src/data/macroSnapshot/evidence.ts`
- Modify: `src/data/macroSnapshot.ts`
- Test: `tests/macro-snapshot.test.mjs`

- [ ] **Step 1: Write the failing model/evidence tests.**

Add tests that describe the public shape before implementation:

```js
test('exposes all registered macro datasets without changing the Dashboard set', () => {
  const macro = getMacroSnapshotIndicators();
  assert.deepEqual(Object.keys(macro), macroIndicatorIds);
  assert.equal(getDashboardIndicators().length, 11);
  assert.equal(macro.lpr.series.length, 2);
  assert.equal(macro['policy-rate'].frequency, 'event');
});

test('normalizes single-series, LPR, and policy-rate evidence with timing context', () => {
  const indicators = getMacroSnapshotIndicators();
  const gdp = makeEvidence(indicators.gdp, 'gdp');
  const lpr = makeEvidence(indicators.lpr, 'lpr');
  const policy = makeEvidence(indicators['policy-rate'], 'policy-rate');

  assert.equal(gdp.frequency, 'quarterly');
  assert.equal(gdp.observationPeriod, indicators.gdp.data.at(-1).date);
  assert.equal(gdp.updatedAt, indicators.gdp.updatedAt);
  assert.equal(gdp.verifiedThrough, null);
  assert.deepEqual(lpr.map(item => item.id), ['lpr:1y', 'lpr:5y-plus']);
  assert.ok(lpr.every(item => item.seriesId));
  assert.equal(policy[0].isEvent, true);
  assert.equal(policy[0].observationPeriod, '2025-05-08');
  assert.equal(policy[0].verifiedThrough, '2026-09-07');
});
```

Use the existing `getIndicatorData`, `getDashboardIndicators`, and a test helper that shallow-clones datasets without mutating imported JSON. Import the planned public functions from `src/data/macroSnapshot.ts`; the initial run must fail because the new facade and evidence builder do not exist.

- [ ] **Step 2: Run the focused test to verify the expected red state.**

Run: `node --import tsx --test tests/macro-snapshot.test.mjs`

Expected: FAIL with a missing export/module error for `getMacroSnapshotIndicators` or `makeEvidence`, not a fixture typo.

- [ ] **Step 3: Define the shared types.**

In `src/data/macroSnapshot/types.ts`, define the fixed IDs and types:

```ts
import type { IndicatorDataset } from '../../domain/indicatorDataset';

export const macroIndicatorIds = [
  'gdp', 'pmi', 'industrial-production', 'retail-sales', 'fixed-asset-investment',
  'cpi', 'core-cpi', 'ppi',
  'm0', 'm1', 'm2', 'credit', 'social-financing',
  'policy-rate', 'lpr', 'unemployment-rate', 'exports', 'imports',
] as const;
export type MacroIndicatorId = typeof macroIndicatorIds[number];
export type MacroIndicatorMap = Record<MacroIndicatorId, IndicatorDataset>;
export type SnapshotChangeUnit = 'percentage-points' | 'points' | 'units';
export type SnapshotEvidence = {
  id: string; seriesId?: string; name: string; metric: string; frequency: string;
  valueLabel: string; changeLabel: string; conceptHref: string; latest: number;
  previous: number | null; change: number | null; changeUnit: SnapshotChangeUnit;
  observationPeriod: string; unit: string; updatedAt: string;
  verifiedThrough: string | null; chartType?: string; isEvent: boolean;
};
export type SnapshotConclusion = { id: string; title: string; explanation: string; kind: 'risk' | 'watch'; evidenceIds: string[] };
export type MacroDomainId = 'growth' | 'prices' | 'credit-liquidity' | 'policy-financial-conditions' | 'labor' | 'external';
export type MacroDomainStateValue = 'strengthening' | 'weakening' | 'stable' | 'mixed' | 'divergent' | 'easing' | 'tightening' | 'elevated' | 'notable';
export type MacroDomainState = { id: MacroDomainId; label: string; state: MacroDomainStateValue; explanation: string; evidence: SnapshotEvidence[]; risks: SnapshotConclusion[]; watchNext: SnapshotConclusion[] };
export type MacroSynthesis = { label: string; explanation: string; supportingDomainIds: MacroDomainId[]; conflictingDomainIds: MacroDomainId[] };
export type MacroSnapshot = {
  rulesVersion: string;
  freshness: { earliestUpdatedAt: string; latestUpdatedAt: string; note: string };
  domains: MacroDomainState[];
  synthesis: MacroSynthesis;
  risks: SnapshotConclusion[];
  watchNext: SnapshotConclusion[];
};
```

- [ ] **Step 4: Implement evidence conversion minimally.**

In `evidence.ts`, export `makeEvidence(dataset, id)` and `makeIndicatorEvidence(dataset, id)`. Use `getIndicatorPresentation(dataset)` only for display labels. Use the last two observations in each series after preserving canonical order; compute `change` numerically. For a regular dataset, emit one item from `data`; for a dataset with `series`, emit one item per series. For an event dataset, set `isEvent: true`, retain `verifiedThrough`, and use the last actual event as `observationPeriod` without synthesizing a point at `verifiedThrough`.

Use these rules for IDs and metadata:

```ts
const evidenceId = (id: string, seriesId?: string) => seriesId ? `${id}:${seriesId}` : id;
const changeUnit = (metric: string): SnapshotChangeUnit => (
  metric === 'index' ? 'points' : ['yoy', 'mom', 'cumulative_yoy'].includes(metric)
    ? 'percentage-points' : 'units'
);
```

Use a small metadata map for names and concept links. It must contain all 18 IDs and only provide presentation metadata; domain rules must not read it.

- [ ] **Step 5: Add the facade registry and run the focused tests.**

In `macroSnapshot.ts`, export `getMacroSnapshotIndicators()` by mapping `macroIndicatorIds` to `getIndicatorData(id)` and returning a `Record` with no missing or unexpected keys. Export the types from `types.ts` and re-export `makeEvidence` for focused tests. Implement no domain behavior yet.

Run: `node --import tsx --test tests/macro-snapshot.test.mjs`

Expected: model/evidence tests pass; domain assertions may still fail until later tasks. Commit the shared model and evidence once their tests are green:

```bash
git add src/data/macroSnapshot.ts src/data/macroSnapshot/types.ts src/data/macroSnapshot/evidence.ts tests/macro-snapshot.test.mjs
git commit -m "feat: add macro snapshot evidence model"
```

## Task 2: Implement Growth / Activity and Prices with test-first domain fixtures

**Files:**
- Create: `src/data/macroSnapshot/growth.ts`
- Create: `src/data/macroSnapshot/prices.ts`
- Test: `tests/macro-snapshot.test.mjs`

- [ ] **Step 1: Add failing Growth / Activity fixtures.**

Define a helper that clones the full `MacroIndicatorMap`, replacing only `data`, `updatedAt`, or series labels. Add tests for:

```js
const data = observations => ({ data: observations });
const makeMacroIndicators = (overrides = {}) => {
  const base = getMacroSnapshotIndicators();
  return Object.fromEntries(macroIndicatorIds.map(id => {
    const override = overrides[id] ?? {};
    return [id, {
      ...base[id],
      ...override,
      ...(override.data ? { data: override.data.data } : {}),
      ...(override.series ? { series: override.series } : {}),
    }];
  }));
};
const domain = (snapshot, id) => snapshot.domains.find(item => item.id === id);
```

```js
test('growth keeps positive levels and weakening momentum separate', () => {
  const snapshot = buildMacroSnapshot(makeMacroIndicators({
    gdp: data([{ date: '2026-Q2', value: 4.3 }, { date: '2026-Q3', value: 3.8 }]),
    'industrial-production': data([{ date: '2026-08', value: 5 }, { date: '2026-09', value: 4 }]),
  }));
  const growth = domain(snapshot, 'growth');
  assert.equal(growth.state, 'mixed');
  assert.match(growth.explanation, /正增长|走弱|放缓/);
  assert.ok(growth.evidence.some(item => item.id === 'gdp' && item.observationPeriod === '2026-Q3'));
});

test('growth reports PMI below 50 while other activity remains positive', () => {
  const growth = domain(buildMacroSnapshot(makeMacroIndicators({
    pmi: data([{ date: '2026-08', value: 49.8 }, { date: '2026-09', value: 49.6 }]),
    gdp: data([{ date: '2026-Q2', value: 4 }, { date: '2026-Q3', value: 4 }]),
    'industrial-production': data([{ date: '2026-08', value: 5 }, { date: '2026-09', value: 5 }]),
    'retail-sales': data([{ date: '2026-08', value: 4 }, { date: '2026-09', value: 4 }]),
  })), 'growth');
  assert.equal(growth.state, 'mixed');
  assert.ok(growth.risks.some(item => item.evidenceIds.includes('pmi')));
  assert.ok(growth.evidence.some(item => item.id === 'pmi'));
});
```

- [ ] **Step 2: Run the Growth tests and verify red.**

Run: `node --import tsx --test tests/macro-snapshot.test.mjs`

Expected: FAIL because `analyzeGrowth` is not implemented.

- [ ] **Step 3: Implement `analyzeGrowth`.**

Export `analyzeGrowth(indicators: MacroIndicatorMap): MacroDomainState`. Build evidence for `['pmi', 'gdp', 'industrial-production', 'retail-sales', 'fixed-asset-investment']`. Classify PMI level as positive when `latest > 50`, negative when `< 50`; classify the other four levels as positive when `latest > 0`, negative when `< 0`. Classify momentum with `change < -0.2` as weakening, `change > 0.2` as improving, otherwise stable.

Return `mixed` when PMI and the majority of other activity indicators disagree, or when positive levels coexist with at least two weakening changes. Return `weakening` when at least three levels are negative or at least three changes are weakening. Return `strengthening` when at least four levels are positive and no more than one change is weakening. Otherwise return `stable`.

Create conclusions with evidence IDs only. Include a PMI-below-50 risk and a synchronized-weakening risk when their conditions hold. Add one watch item for each risk using the observation periods in the explanation. No rule may read `name`, `valueLabel`, or `changeLabel`.

- [ ] **Step 4: Add failing Prices fixtures.**

Add tests that set CPI/core CPI positive while PPI is negative, then assert:

```js
const prices = domain(buildMacroSnapshot(makeMacroIndicators({
  cpi: data([{ date: '2026-08', value: 0.8 }, { date: '2026-09', value: 1 }]),
  'core-cpi': data([{ date: '2026-08', value: 0.4 }, { date: '2026-09', value: 0.5 }]),
  ppi: data([{ date: '2026-08', value: -2 }, { date: '2026-09', value: -1.5 }]),
})), 'prices');
assert.equal(prices.state, 'divergent');
assert.match(prices.explanation, /CPI|核心|PPI/);
assert.doesNotMatch(prices.explanation, /需求|资产价格|投资/);
```

- [ ] **Step 5: Run the Prices test to verify red, then implement `analyzePrices`.**

Run: `node --import tsx --test tests/macro-snapshot.test.mjs`

Implement `analyzePrices` using `['cpi', 'core-cpi', 'ppi']`. Classify each latest value by sign and compare the three signs and changes. Return `divergent` when at least two signs differ, `weakening` when all are negative, `strengthening` when all are positive and at least two changes are non-negative, otherwise return `mixed` or `stable`. The explanation must explicitly describe price evidence only. Add a watch item for divergent price readings; no price rule may create a growth risk.

- [ ] **Step 6: Run the focused domain tests and commit.**

Run: `node --import tsx --test tests/macro-snapshot.test.mjs`

Expected: all evidence, Growth, and Prices assertions pass. Commit:

```bash
git add src/data/macroSnapshot/growth.ts src/data/macroSnapshot/prices.ts tests/macro-snapshot.test.mjs
git commit -m "feat: add growth and price macro domains"
```

## Task 3: Implement Credit & Liquidity, Policy / Financial Conditions, Labor, and External

**Files:**
- Create: `src/data/macroSnapshot/creditLiquidity.ts`
- Create: `src/data/macroSnapshot/policyFinancialConditions.ts`
- Create: `src/data/macroSnapshot/labor.ts`
- Create: `src/data/macroSnapshot/external.ts`
- Test: `tests/macro-snapshot.test.mjs`

- [ ] **Step 1: Write failing fixtures for the four domains.**

Add one explicit fixture for each required divergence:

```js
test('credit separates money growth from credit and social-financing growth', () => {
  const credit = domain(buildMacroSnapshot(makeMacroIndicators({
    m2: data([{ date: '2026-07', value: 7 }, { date: '2026-08', value: 8 }]),
    credit: data([{ date: '2026-07', value: 9 }, { date: '2026-08', value: 8 }]),
    'social-financing': data([{ date: '2026-07', value: 9 }, { date: '2026-08', value: 8 }]),
  })), 'credit-liquidity');
  assert.equal(credit.state, 'mixed');
  assert.match(credit.explanation, /货币|信贷|社会融资/);
  assert.doesNotMatch(credit.explanation, /必然|意味着经济|资产价格/);
});

test('policy domain retains policy event and each LPR series', () => {
  const policy = domain(buildMacroSnapshot(), 'policy-financial-conditions');
  assert.ok(policy.evidence.some(item => item.id === 'policy-rate' && item.isEvent));
  assert.deepEqual(policy.evidence.filter(item => item.seriesId).map(item => item.id), ['lpr:1y', 'lpr:5y-plus']);
  assert.ok(policy.evidence.every(item => item.observationPeriod && item.updatedAt));
});

test('labor weakens independently from a positive growth domain', () => {
  const snapshot = buildMacroSnapshot(makeMacroIndicators({
    'unemployment-rate': data([{ date: '2026-07', value: 5 }, { date: '2026-08', value: 5.3 }]),
    gdp: data([{ date: '2026-Q2', value: 4 }, { date: '2026-Q3', value: 4 }]),
  }));
  assert.equal(domain(snapshot, 'labor').state, 'weakening');
  assert.notEqual(domain(snapshot, 'growth').state, 'weakening');
});

test('external reports exports and imports divergence', () => {
  const external = domain(buildMacroSnapshot(makeMacroIndicators({
    exports: data([{ date: '2026-07', value: 5 }, { date: '2026-08', value: 6 }]),
    imports: data([{ date: '2026-07', value: 4 }, { date: '2026-08', value: 2 }]),
  })), 'external');
  assert.equal(external.state, 'divergent');
  assert.match(external.explanation, /出口|进口/);
});
```

- [ ] **Step 2: Run the four-domain fixtures and verify red.**

Run: `node --import tsx --test tests/macro-snapshot.test.mjs`

Expected: FAIL because the four analysis functions are not implemented.

- [ ] **Step 3: Implement `analyzeCreditLiquidity`.**

Use `m0`, `m1`, and `m2` as the monetary group and `credit` plus `social-financing` as the financing group. For each group, count latest positive/negative values and momentum changes above/below ±0.2. Return `mixed` when group directions disagree; otherwise return the common direction or `stable`. Explanations must state that money and financing evidence are separate and cannot by themselves establish demand or asset-price outcomes. Include divergence as a risk/watch pair tied to the five evidence IDs.

- [ ] **Step 4: Implement `analyzePolicyFinancialConditions`.**

Use `makeIndicatorEvidence` for `policy-rate` and `lpr`. Classify a lower policy-rate event change as `easing`, a higher change as `tightening`, and no change as `stable`. Classify LPR levels independently; if policy and LPR direction disagree, return `mixed`, otherwise use the policy direction or LPR direction. Include event/series wording in the explanation and do not call either observation proof of economic outcomes. Evidence IDs must remain `policy-rate`, `lpr:1y`, and `lpr:5y-plus`.

- [ ] **Step 5: Implement `analyzeLabor`.**

Use `unemployment-rate` only. A positive change is `weakening`, a negative change is `strengthening`, and a null/near-zero change is `stable`. Add a risk when unemployment rises and a watch item referencing the monthly observation period. Do not import or inspect Growth state.

- [ ] **Step 6: Implement `analyzeExternal`.**

Use `exports` and `imports` independently. A positive latest value and positive change are improving evidence; negative latest value or negative change are weakening evidence. Return `divergent` when the two directions differ, `strengthening`/`weakening` when aligned, and `stable` otherwise. Explain only the trade-side evidence and attach both evidence IDs to divergence conclusions.

- [ ] **Step 7: Run the four-domain tests and commit.**

Run: `node --import tsx --test tests/macro-snapshot.test.mjs`

Expected: all four domain fixtures pass. Commit:

```bash
git add src/data/macroSnapshot/creditLiquidity.ts src/data/macroSnapshot/policyFinancialConditions.ts src/data/macroSnapshot/labor.ts src/data/macroSnapshot/external.ts tests/macro-snapshot.test.mjs
git commit -m "feat: add macro credit policy labor and external domains"
```

## Task 4: Add domain-only synthesis and complete the snapshot facade

**Files:**
- Create: `src/data/macroSnapshot/synthesis.ts`
- Modify: `src/data/macroSnapshot.ts`
- Modify: `src/pages/index.astro`
- Test: `tests/macro-snapshot.test.mjs`

- [ ] **Step 1: Write failing synthesis and input-contract tests.**

Add tests that use a positive Growth domain plus a weakening Labor domain and assert:

```js
test('synthesis preserves conflicting domain directions', () => {
  const snapshot = buildMacroSnapshot(makeMacroIndicators({
    'unemployment-rate': data([{ date: '2026-07', value: 5 }, { date: '2026-08', value: 5.3 }]),
    gdp: data([{ date: '2026-Q2', value: 4 }, { date: '2026-Q3', value: 4 }]),
  }));
  assert.match(snapshot.synthesis.label, /混合|分化|谨慎/);
  assert.ok(snapshot.synthesis.supportingDomainIds.includes('growth'));
  assert.ok(snapshot.synthesis.conflictingDomainIds.includes('labor'));
  assert.equal(snapshot.risks.length, snapshot.domains.flatMap(domain => domain.risks).length);
});

test('snapshot rejects missing and unexpected indicator input', () => {
  const indicators = getMacroSnapshotIndicators();
  const missing = { ...indicators };
  delete missing.m2;
  assert.throws(() => buildMacroSnapshot(missing), /m2/);
  assert.throws(() => buildMacroSnapshot({ ...indicators, extra: indicators.m2 }), /unexpected|extra/i);
});

test('freshness is a range and evidence retains heterogeneous periods', () => {
  const snapshot = buildMacroSnapshot();
  assert.ok(snapshot.freshness.earliestUpdatedAt);
  assert.ok(snapshot.freshness.latestUpdatedAt);
  assert.match(snapshot.freshness.note, /各|分别|频率/);
  assert.ok(snapshot.domains.flatMap(domain => domain.evidence).some(item => item.frequency === 'quarterly'));
  assert.ok(snapshot.domains.flatMap(domain => domain.evidence).some(item => item.isEvent));
  assert.ok(snapshot.domains.flatMap(domain => domain.evidence).every(item => item.updatedAt));
});
```

- [ ] **Step 2: Run the tests and verify red.**

Run: `node --import tsx --test tests/macro-snapshot.test.mjs`

Expected: FAIL because `buildMacroSnapshot` still exposes the V1 phase model and does not synthesize domain states.

- [ ] **Step 3: Implement `deriveSynthesis`.**

In `synthesis.ts`, accept only `MacroDomainState[]`. Define `directionalPositive = ['strengthening', 'easing']`, `directionalNegative = ['weakening', 'tightening', 'elevated']`, and treat `mixed`, `divergent`, `stable`, and `notable` as qualified. Return supporting and conflicting domain ID arrays in input order. If both directional groups are non-empty, return a mixed label naming both groups; otherwise return improvement, weakening-pressure, or mixed/qualified wording. Do not calculate a number.

- [ ] **Step 4: Implement facade validation and orchestration.**

In `macroSnapshot.ts`:

1. Validate that the input is a record with exactly `macroIndicatorIds` keys and that every value has the matching `id`.
2. Invoke the six domain functions in the fixed order `growth`, `prices`, `credit-liquidity`, `policy-financial-conditions`, `labor`, `external`.
3. Call `deriveSynthesis(domains)` with no raw indicator argument.
4. Flatten domain risks and watch items in domain order.
5. Derive `freshness.earliestUpdatedAt` and `freshness.latestUpdatedAt` from dataset `updatedAt` values and set a note explaining that evidence periods differ; do not expose a universal `asOf` field.
6. Return `rulesVersion = '2026-09-07.1'` and the structured `MacroSnapshot`.

Export `buildMacroSnapshot(indicators: MacroIndicatorMap = getMacroSnapshotIndicators())` and re-export the public types needed by the component and tests.

- [ ] **Step 5: Update page integration.**

In `src/pages/index.astro`, retain:

```ts
const dashboardIndicators = getDashboardIndicators();
const snapshot = buildMacroSnapshot();
```

Remove the old call that passes Dashboard indicators into the Snapshot. This keeps the Dashboard at 11 indicators while Snapshot reads all 18.

- [ ] **Step 6: Run focused tests and commit.**

Run: `node --import tsx --test tests/macro-snapshot.test.mjs`

Expected: all domain, synthesis, freshness, input-contract, and label-invariance tests pass. Commit:

```bash
git add src/data/macroSnapshot.ts src/data/macroSnapshot/synthesis.ts src/pages/index.astro tests/macro-snapshot.test.mjs
git commit -m "feat: synthesize domain-based macro snapshot"
```

## Task 5: Adapt the Snapshot component without leaking implementation metadata

**Files:**
- Modify: `src/components/MacroSnapshot.astro`
- Modify: `src/styles/snapshot.css`
- Test: `tests/macro-snapshot.test.mjs`

- [ ] **Step 1: Add failing source-contract assertions.**

Assert that the component source references `snapshot.synthesis`, `snapshot.domains`, `domain.evidence`, `observationPeriod`, and `updatedAt`, and does not reference `snapshot.phase`, `snapshot.signals`, `rulesVersion`, or a macro score. Also assert that `index.astro` still contains both `MacroDashboard` and `MacroSnapshot`.

- [ ] **Step 2: Run the component test to verify red.**

Run: `node --import tsx --test tests/macro-snapshot.test.mjs`

Expected: FAIL because the component still renders V1 phase/signals.

- [ ] **Step 3: Implement the component rendering.**

Render the synthesis first, then map `snapshot.domains`. Each domain card must show its label, state, explanation, an evidence list with indicator link, value, observation period, frequency, and update date, followed by domain risks and watch-next items. Use evidence IDs to resolve conclusion links within the current domain. Keep the existing disclaimer exactly as a no-investment-advice boundary.

Do not show rules version or internal methodology fingerprints. Do not use the component to classify or sort evidence; domain order and evidence order are already deterministic from the model.

- [ ] **Step 4: Implement responsive styles.**

Update `snapshot.css` with a two-column domain grid above 1000px, one column below 760px, and a compact evidence metadata row that wraps on mobile. Preserve existing colors, typography, and the `@media (max-width: 760px)` breakpoint. Avoid changing unrelated Dashboard styles.

- [ ] **Step 5: Run component checks and commit.**

Run: `node --import tsx --test tests/macro-snapshot.test.mjs`

Expected: all source-contract and domain rendering assertions pass. Commit:

```bash
git add src/components/MacroSnapshot.astro src/styles/snapshot.css tests/macro-snapshot.test.mjs
git commit -m "feat: render macro snapshot domains and evidence"
```

## Task 6: Complete focused regression coverage and verification

**Files:**
- Modify: `tests/macro-snapshot.test.mjs`
- Modify: implementation files only when a focused test identifies a defect.

- [ ] **Step 1: Add the remaining acceptance tests.**

Cover all issue cases in one fixture per behavior:

- Price signs diverge without growth wording.
- Money growth and credit/social financing diverge without causal wording.
- Policy rate uses event date and LPR keeps both series.
- Exports improve while imports weaken.
- Labor weakens while Growth remains positive.
- All conclusion `evidenceIds` resolve within their domain.
- Replacing presentation `label`, `valueLabel`, or `changeLabel` does not change any domain state or synthesis.
- No returned string contains `Macro Score`, `confidence score`, `投资建议`, or equivalent scoring language.

- [ ] **Step 2: Run the focused macro tests.**

Run: `node --import tsx --test tests/macro-snapshot.test.mjs`

Expected: all focused Macro Snapshot tests pass with no failures.

- [ ] **Step 3: Run the full verification suite.**

Run each command separately and record exit code/output:

```bash
npm test
npm run check
npm run build
npm run test:output
```

Expected: 0 exit code for all commands. Build may print the existing bundle-size warning, but must not print a build error.

- [ ] **Step 4: Review the complete diff.**

Run:

```bash
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git status --short --branch
```

Confirm that the diff contains only issue #119 implementation, its focused tests, the data-driven policy-rate baseline fix, and the committed spec/plan documents. Commit any final test-only correction with a focused message.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-07-domain-macro-state.md`. Execute with `superpowers:executing-plans` in this worktree, keeping the worktree alive for review and PR iteration.
