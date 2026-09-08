# Macro Snapshot Boundary and Conflict Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic Macro Snapshot regression tests for threshold boundaries, unchanged/stale periods, and domain-specific conflicting signals without changing production rules.

**Architecture:** Extend the existing `tests/macro-snapshot.test.mjs` contract test file. Reuse its `data`, `makeMacroIndicators`, and `domainState` helpers; assert domain states, conclusion IDs, evidence IDs, and synthesis roles directly.

**Tech Stack:** Node.js test runner, `tsx`, TypeScript source modules imported by `.mjs` tests.

---

### Task 1: Cover growth and price boundaries

**Files:**
- Modify: `tests/macro-snapshot.test.mjs` after the existing growth and price tests

- [ ] **Step 1: Add strict growth threshold tests**

Add a named test that runs `analyzeGrowth` for PMI values `49.9`, `50`, and `50.1`, while three activity indicators remain positive and fixed-asset investment remains neutral and unchanged. This makes the PMI contribution observable in the final domain state:

```js
test('growth keeps PMI below, at, and above the expansion threshold distinct', () => {
  const states = [49.9, 50, 50.1].map(value => analyzeGrowth(makeMacroIndicators({
    pmi: data([{ date: '2026-08', value }, { date: '2026-09', value }]),
    gdp: data([{ date: '2026-Q2', value: 4 }, { date: '2026-Q3', value: 4 }]),
    'industrial-production': data([{ date: '2026-08', value: 5 }, { date: '2026-09', value: 5 }]),
    'retail-sales': data([{ date: '2026-08', value: 5 }, { date: '2026-09', value: 5 }]),
    'fixed-asset-investment': data([{ date: '2026-01–08', value: 0 }, { date: '2026-01–09', value: 0 }]),
  })).state);

  assert.deepEqual(states, ['mixed', 'stable', 'strengthening']);
});
```

- [ ] **Step 2: Add strict momentum boundary tests**

Add a table-driven test with all five growth indicators at level zero. Use previous values `0.2`, `0.21`, `-0.2`, and `-0.21` to prove that only changes strictly below `-0.2` count as weakening and only changes strictly above `+0.2` count as improving:

```js
test('growth treats exact momentum boundaries as neutral', () => {
  const indicatorIds = ['pmi', 'gdp', 'industrial-production', 'retail-sales', 'fixed-asset-investment'];
  const cases = [
    { name: 'exact weakening boundary', previous: 0.2, expectedState: 'stable', expectedRisk: false },
    { name: 'just below weakening boundary', previous: 0.21, expectedState: 'weakening', expectedRisk: true },
    { name: 'exact improving boundary', previous: -0.2, expectedState: 'stable', expectedRisk: false },
    { name: 'just above improving boundary', previous: -0.21, expectedState: 'strengthening', expectedRisk: false },
  ];

  for (const item of cases) {
    const indicators = makeMacroIndicators(Object.fromEntries(indicatorIds.map(id => [
      id,
      data([{ date: id === 'gdp' ? '2026-Q2' : '2026-08', value: item.previous }, {
        date: id === 'gdp' ? '2026-Q3' : '2026-09',
        value: 0,
      }]),
    ])));
    const growth = analyzeGrowth(indicators);

    assert.equal(growth.state, item.expectedState, item.name);
    assert.equal(growth.risks.some(risk => risk.id === 'growth-synchronised-weakening'), item.expectedRisk, item.name);
  }
});
```

- [ ] **Step 3: Add negative, zero, and elevated-positive price tests**

Add a test for the sign-based price states:

```js
test('prices keep negative, zero, and elevated positive readings separate', () => {
  const readings = [
    { value: -1, change: -0.2, expectedState: 'weakening' },
    { value: 0, change: 0, expectedState: 'stable' },
    { value: 6, change: 1, expectedState: 'strengthening' },
  ];

  for (const item of readings) {
    const prices = analyzePrices(makeMacroIndicators({
      cpi: data([{ date: '2026-08', value: item.value - item.change }, { date: '2026-09', value: item.value }]),
      'core-cpi': data([{ date: '2026-08', value: item.value - item.change }, { date: '2026-09', value: item.value }]),
      ppi: data([{ date: '2026-08', value: item.value - item.change }, { date: '2026-09', value: item.value }]),
    }));

    assert.equal(prices.state, item.expectedState, `price value ${item.value}`);
  }
});
```

- [ ] **Step 4: Run focused tests and confirm the new tests are green**

Run: `node --import tsx --test tests/macro-snapshot.test.mjs`

Expected: the focused test file passes, including the new growth and price cases.

- [ ] **Step 5: Commit the boundary coverage**

```bash
git add tests/macro-snapshot.test.mjs
git commit -m "test: cover macro snapshot boundaries"
```

### Task 2: Cover policy direction, unchanged readings, and stale events

**Files:**
- Modify: `tests/macro-snapshot.test.mjs` near the existing policy tests

- [ ] **Step 1: Add recent tightening coverage**

Add the mirror case to the existing easing test and assert that a current policy-rate increase is `tightening` when LPR is unchanged:

```js
test('current policy-rate increases map to tightening conditions', () => {
  const tightening = analyzePolicyFinancialConditions(makeMacroIndicators({
    'policy-rate': data([{ date: '2026-08-01', value: 1.8 }, { date: '2026-09-07', value: 1.9 }]),
    lpr: {
      series: [
        { id: '1y', label: '1年期 LPR', data: [{ date: '2026-08', value: 3 }, { date: '2026-09', value: 3 }] },
        { id: '5y-plus', label: '5年期以上 LPR', data: [{ date: '2026-08', value: 3.5 }, { date: '2026-09', value: 3.5 }] },
      ],
    },
  }));

  assert.equal(tightening.state, 'tightening');
  assert.deepEqual(tightening.risks, []);
});
```

- [ ] **Step 2: Strengthen stale-event assertions**

Update the existing stale policy test to assert both stable classification and the absence of a divergence risk:

```js
assert.equal(policy.state, 'stable');
assert.deepEqual(policy.risks, []);
assert.match(policy.explanation, /最后一次|核验|稳定/);
```

- [ ] **Step 3: Add an unchanged multi-domain snapshot regression test**

Construct a snapshot where every single-series indicator has two zero observations, policy rate is unchanged, and both LPR series are unchanged. Assert every domain is stable, the synthesis has no supporting or conflicting domains, and no risk/watch conclusion is emitted:

```js
test('unchanged readings remain stable without spurious snapshot conclusions', () => {
  const unchanged = data([{ date: '2026-08', value: 0 }, { date: '2026-09', value: 0 }]);
  const unchangedPmi = data([{ date: '2026-08', value: 50 }, { date: '2026-09', value: 50 }]);
  const snapshot = buildMacroSnapshot(makeMacroIndicators({
    gdp: data([{ date: '2026-Q2', value: 0 }, { date: '2026-Q3', value: 0 }]),
    pmi: unchangedPmi,
    'industrial-production': unchanged,
    'retail-sales': unchanged,
    'fixed-asset-investment': data([{ date: '2026-01–08', value: 0 }, { date: '2026-01–09', value: 0 }]),
    cpi: unchanged,
    'core-cpi': unchanged,
    ppi: unchanged,
    m0: unchanged,
    m1: unchanged,
    m2: unchanged,
    credit: unchanged,
    'social-financing': unchanged,
    'policy-rate': data([{ date: '2026-08-01', value: 0 }, { date: '2026-09-01', value: 0 }]),
    lpr: {
      series: [
        { id: '1y', label: '1年期 LPR', data: [{ date: '2026-08', value: 0 }, { date: '2026-09', value: 0 }] },
        { id: '5y-plus', label: '5年期以上 LPR', data: [{ date: '2026-08', value: 0 }, { date: '2026-09', value: 0 }] },
      ],
    },
    'unemployment-rate': unchanged,
    exports: unchanged,
    imports: unchanged,
  }));

  assert.deepEqual(snapshot.domains.map(domain => domain.state), [
    'stable', 'stable', 'stable', 'stable', 'stable', 'stable',
  ]);
  assert.deepEqual(snapshot.synthesis.supportingDomainIds, []);
  assert.deepEqual(snapshot.synthesis.conflictingDomainIds, []);
  assert.deepEqual(snapshot.risks, []);
  assert.deepEqual(snapshot.watchNext, []);
});
```

- [ ] **Step 4: Run focused tests**

Run: `node --import tsx --test tests/macro-snapshot.test.mjs`

Expected: policy direction, stale-event, and unchanged-snapshot tests pass.

- [ ] **Step 5: Commit the policy and unchanged-period coverage**

```bash
git add tests/macro-snapshot.test.mjs
git commit -m "test: cover stale and unchanged macro signals"
```

### Task 3: Cover conflicting signals and synthesis role preservation

**Files:**
- Modify: `tests/macro-snapshot.test.mjs` near the existing credit and synthesis tests

- [ ] **Step 1: Add liquidity/credit divergence coverage**

Add a scenario where M0/M1/M2 improve by one point while credit and social financing fall by more than `0.2`, then assert the mixed state, the divergence risk, and all six local evidence IDs:

```js
test('credit keeps improving liquidity separate from weakening transmission', () => {
  const credit = analyzeCreditLiquidity(makeMacroIndicators({
    m0: data([{ date: '2026-07', value: 7 }, { date: '2026-08', value: 8 }]),
    m1: data([{ date: '2026-07', value: 7 }, { date: '2026-08', value: 8 }]),
    m2: data([{ date: '2026-07', value: 7 }, { date: '2026-08', value: 8 }]),
    credit: data([{ date: '2026-07', value: 8.3 }, { date: '2026-08', value: 8 }]),
    'social-financing': data([{ date: '2026-07', value: 8.3 }, { date: '2026-08', value: 8 }]),
  }));

  assert.equal(credit.state, 'mixed');
  assert.equal(credit.risks[0].id, 'credit-liquidity-divergence');
  assert.deepEqual(credit.risks[0].evidenceIds, [
    'm0', 'm1', 'm2', 'credit', 'social-financing',
  ]);
});
```

- [ ] **Step 2: Add policy-easing/weak-growth cross-domain coverage**

Build a snapshot with a current policy-rate cut, unchanged LPR, PMI below 50, and all activity indicators at negative levels. Assert that growth remains conflicting, policy remains contextual, and the synthesis does not treat easing as growth support:

```js
test('policy easing does not erase weak growth in synthesis', () => {
  const snapshot = buildMacroSnapshot(makeMacroIndicators({
    pmi: data([{ date: '2026-08', value: 49 }, { date: '2026-09', value: 49 }]),
    gdp: data([{ date: '2026-Q2', value: -1 }, { date: '2026-Q3', value: -1 }]),
    'industrial-production': data([{ date: '2026-08', value: -1 }, { date: '2026-09', value: -1 }]),
    'retail-sales': data([{ date: '2026-08', value: -1 }, { date: '2026-09', value: -1 }]),
    'fixed-asset-investment': data([{ date: '2026-01–08', value: -1 }, { date: '2026-01–09', value: -1 }]),
    'policy-rate': data([{ date: '2026-08-01', value: 1.8 }, { date: '2026-09-07', value: 1.7 }]),
    'unemployment-rate': data([{ date: '2026-08', value: 5 }, { date: '2026-09', value: 5 }]),
    lpr: {
      series: [
        { id: '1y', label: '1年期 LPR', data: [{ date: '2026-08', value: 3 }, { date: '2026-09', value: 3 }] },
        { id: '5y-plus', label: '5年期以上 LPR', data: [{ date: '2026-08', value: 3.5 }, { date: '2026-09', value: 3.5 }] },
      ],
    },
  }));

  assert.equal(snapshot.domains.find(domain => domain.id === 'growth').state, 'weakening');
  assert.equal(snapshot.domains.find(domain => domain.id === 'policy-financial-conditions').state, 'easing');
  assert.deepEqual(snapshot.synthesis.supportingDomainIds, []);
  assert.deepEqual(snapshot.synthesis.conflictingDomainIds, ['growth']);
  assert.ok(snapshot.synthesis.contextualDomainIds.includes('policy-financial-conditions'));
});
```

- [ ] **Step 3: Add rising-price/slowing-activity cross-domain coverage**

Build a snapshot with positive and rising prices but activity momentum below the growth weakening boundary. Assert that prices are strengthening, growth is weakening, and synthesis keeps prices contextual:

```js
test('rising price pressure stays contextual when activity slows', () => {
  const snapshot = buildMacroSnapshot(makeMacroIndicators({
    pmi: data([{ date: '2026-08', value: 50 }, { date: '2026-09', value: 50 }]),
    gdp: data([{ date: '2026-Q2', value: 1 }, { date: '2026-Q3', value: 0 }]),
    'industrial-production': data([{ date: '2026-08', value: 1 }, { date: '2026-09', value: 0 }]),
    'retail-sales': data([{ date: '2026-08', value: 1 }, { date: '2026-09', value: 0 }]),
    'fixed-asset-investment': data([{ date: '2026-01–08', value: 1 }, { date: '2026-01–09', value: 0 }]),
    cpi: data([{ date: '2026-08', value: 4 }, { date: '2026-09', value: 5 }]),
    'core-cpi': data([{ date: '2026-08', value: 3 }, { date: '2026-09', value: 4 }]),
    ppi: data([{ date: '2026-08', value: 2 }, { date: '2026-09', value: 3 }]),
    'unemployment-rate': data([{ date: '2026-08', value: 5 }, { date: '2026-09', value: 5 }]),
  }));

  assert.equal(snapshot.domains.find(domain => domain.id === 'growth').state, 'weakening');
  assert.equal(snapshot.domains.find(domain => domain.id === 'prices').state, 'strengthening');
  assert.deepEqual(snapshot.synthesis.conflictingDomainIds, ['growth']);
  assert.ok(snapshot.synthesis.contextualDomainIds.includes('prices'));
});
```

- [ ] **Step 4: Run focused tests and inspect evidence ownership**

Run: `node --import tsx --test tests/macro-snapshot.test.mjs`

Expected: all conflict tests pass, with no evidence ID from another domain used in a domain conclusion.

- [ ] **Step 5: Commit the conflict coverage**

```bash
git add tests/macro-snapshot.test.mjs
git commit -m "test: cover conflicting macro snapshot signals"
```

### Task 4: Verify the PR scope and required checks

**Files:**
- Verify: `tests/macro-snapshot.test.mjs`
- Verify: `src/**` has no changes
- Verify: `docs/superpowers/specs/2026-09-08-macro-snapshot-boundary-coverage-design.md`
- Verify: `docs/superpowers/plans/2026-09-08-macro-snapshot-boundary-coverage.md`

- [ ] **Step 1: Inspect the final diff and scope**

Run: `git diff origin/main...HEAD --stat && git diff origin/main...HEAD --check && git status --short`

Expected: only the approved spec, plan, and `tests/macro-snapshot.test.mjs` appear as tracked changes; no `src/` file is modified and there are no whitespace errors.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`

Expected: all tests pass with zero failures.

- [ ] **Step 3: Run type and production checks**

Run: `npm run check`

Expected: Astro check exits with code 0.

Run: `npm run build`

Expected: Astro production build and Pagefind indexing exit with code 0.

- [ ] **Step 4: Request code review**

Compare `origin/main` with the final branch tip and review the test-only diff against Issue #127. Address all Critical and Important findings before pushing.

- [ ] **Step 5: Commit any review fixes and verify again**

```bash
git add tests/macro-snapshot.test.mjs docs/superpowers/specs/2026-09-08-macro-snapshot-boundary-coverage-design.md docs/superpowers/plans/2026-09-08-macro-snapshot-boundary-coverage.md
git commit -m "test: finalize macro snapshot regression coverage"
```

Re-run `npm test`, `npm run check`, and `npm run build` after any fix commit.
