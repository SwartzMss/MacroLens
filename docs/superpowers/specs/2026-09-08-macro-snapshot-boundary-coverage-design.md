# Macro Snapshot Boundary and Conflict Coverage Design

## Goal

Strengthen deterministic regression coverage for Macro Snapshot decision logic without changing production rules, indicators, or output semantics.

## Scope

Extend `tests/macro-snapshot.test.mjs` with direct assertions for:

- PMI values below, exactly at, and above the 50 expansion threshold.
- Growth momentum at and around the existing `-0.2` / `+0.2` boundaries.
- Price readings that are negative, zero, and elevated positive values across CPI, core CPI, and PPI.
- Recent policy easing and tightening events, unchanged rates, and stale events after `verifiedThrough`.
- Conflicting signals where liquidity differs from credit, policy conditions differ from growth, and price pressure differs from activity.

The tests will assert domain states, conclusion IDs, evidence IDs, and synthesis role assignments. Text assertions remain limited to stable semantic phrases where they add coverage.

## Approach

Keep all new coverage in the existing macro snapshot test file so it reuses `data`, `makeMacroIndicators`, and `domainState` helpers and remains next to the current behavior contract. Use small named tests for each behavior rather than a generic generated matrix, preserving the economic meaning of each scenario.

No production files under `src/` will change. Test inputs will use deterministic two-observation datasets and explicit `verifiedThrough` dates; no network calls, historical replay, scoring, or prediction logic will be introduced.

## Expected coverage

1. Growth: strict PMI threshold classification and strict momentum boundaries do not accidentally turn equality into improvement or weakening.
2. Prices: sign-based classification keeps negative, neutral, and elevated positive readings within the price domain.
3. Policy: event direction maps to easing/tightening only while current, unchanged readings remain stable, and stale event direction expires.
4. Conflicts: each domain retains its own state and evidence; `deriveSynthesis` classifies only activity/labor as supporting or conflicting while preserving other domains as contextual.
5. Regression invariants: stale/unchanged snapshots have no spurious risk conclusions, and existing snapshot behavior remains unchanged.

## Verification

Run the focused macro snapshot test, then the full required checks:

```bash
node --import tsx --test tests/macro-snapshot.test.mjs
npm test
npm run check
npm run build
```

The PR will contain the approved process documents and the test coverage change, with no changes to Macro Snapshot production rules.
