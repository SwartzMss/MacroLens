# Macro Snapshot Analysis Layer

## Context

Issue #70 asks MacroLens to add an interpretation layer above the existing indicator dashboard. The current stored datasets cover eight dashboard indicators with different semantics: PMI is an index with a 50 threshold, GDP/industrial production/retail sales are year-over-year growth rates, fixed-asset investment is cumulative year-over-year growth, and M0/M1/M2 are monetary-growth rates. A snapshot must not flatten these into one unqualified score.

## Goals and non-goals

Goals:

- Produce a deterministic `MacroSnapshot` from the existing eight dashboard datasets only.
- Separate observed facts from rule-based interpretations in the output model and UI.
- Explain every phase, risk, and watch item through indicator evidence and the rule that triggered it.
- Keep the snapshot reproducible from stored data, with a fixed `rulesVersion` and data-derived `asOf` date.
- Add a readable homepage snapshot section while leaving the existing dashboard cards and concept pages independent.

Non-goals:

- Do not add new datasets or fetch data at runtime.
- Do not infer inflation, employment, exchange-rate, or investment advice from indicators that are not in the eight-dataset input set.
- Do not use a weighted black-box score, machine learning model, current wall-clock time, or unsupported causal claim.
- Do not mutate the existing indicator JSON contract.

## Input semantics and explicit rules

The snapshot consumes `getDashboardIndicators()` and applies rules by metric family:

| Family | Inputs | Rule semantics |
| --- | --- | --- |
| Activity threshold | PMI | `latest >= 50` is an expansion signal; `< 50` is below the expansion threshold. A change greater than `0.2` is improving momentum; less than `-0.2` is weakening momentum. |
| Activity growth | GDP, industrial production, retail sales, fixed-asset investment | `latest > 0` is a positive growth signal; `latest <= 0` is a negative growth signal. A change greater than `0.2` is improving momentum; less than `-0.2` is weakening momentum; otherwise stable. |
| Monetary growth | M0, M1, M2 | The latest published rate and period change are reported as facts. A change less than `-0.2` is marked as weakening monetary-growth momentum, but is not translated into a claim about demand, prices, or asset prices. |

The phase rule uses only the five activity indicators. Count positive/negative level signals and weakening activity changes:

- `扩张信号`: at least four positive level signals and no more than one weakening activity change.
- `收缩压力`: at least three negative level signals.
- `增长放缓`: otherwise, at least three weakening activity changes.
- `混合信号`: all remaining combinations.

The order above is intentional and is encoded in tests. A phase explanation lists the evidence IDs and states the rule outcome rather than presenting it as an official classification.

Risk rules are independently triggered and may produce multiple items:

- PMI below 50 → “制造业景气低于荣枯线”。
- At least three activity indicators weakening → “活动指标近期同步走弱”。
- Any activity indicator at or below zero → “存在负增长或负累计增长信号”。
- Any monetary-growth indicator weakening → “货币增速动能走弱，需继续观察”，without asserting a transmission outcome.

Watch items are generated from triggered risks and always include the evidence indicator, its current data period, and a direction to observe the next published observation. They say what to monitor, not what action to take. If no risk rule triggers, the output contains a stable “继续观察下一期数据” item backed by the phase evidence.

## Output model

`src/data/macroSnapshot.ts` exports:

- `macroSnapshotRulesVersion`: a fixed string such as `2026-09-05`.
- `buildMacroSnapshot(indicators = getDashboardIndicators())`.
- Types for `SnapshotEvidence`, `SnapshotSignal`, `SnapshotConclusion`, and `MacroSnapshot`.

Each `SnapshotSignal` contains the raw latest/previous values, period, unit, a human-readable `fact`, and a separate `interpretation`. Each `SnapshotConclusion` contains an ID, title, explanation, kind (`risk` or `watch`), and `evidenceIds`. The phase contains a label, explanation, and evidence IDs. `asOf` is the maximum `dataset.updatedAt` from the input indicators; no current timestamp is used.

## UI and data flow

`src/components/MacroSnapshot.astro` receives a `MacroSnapshot` from the homepage. It renders:

1. A “Macro snapshot” header with `asOf`, `rulesVersion`, and a no-investment-advice note.
2. The phase label and explanation.
3. A facts/interpretations list where each signal shows the observed value/change separately from its rule interpretation.
4. Independent risk and watch-next sections with evidence links to the relevant concept pages.

The homepage keeps `MacroDashboard` unchanged and renders `MacroSnapshot` as a separate section below it. Snapshot computation happens at build time through the imported data module; the browser does not fetch or infer anything.

## Testing strategy

- Unit-test PMI threshold and momentum classification, growth-family classification, monetary-growth caution, phase precedence, risk triggers, watch-item evidence, `asOf`, and fixed `rulesVersion`.
- Test that the snapshot accepts the existing dashboard indicators and rejects missing required IDs rather than silently filling data.
- Add source-level assertions for the snapshot component, homepage integration, fact/interpretation separation, evidence concept links, and investment-advice disclaimer.
- Run the full Node suite, `npm run check`, and `npm run build`.

## Acceptance mapping

| Issue #70 requirement | Design coverage |
| --- | --- |
| Reproducible from stored datasets | `buildMacroSnapshot()` consumes only `getDashboardIndicators()` and derives `asOf` from stored metadata |
| Understand why conclusions were generated | Fixed rule thresholds, evidence IDs, and separate fact/interpretation fields |
| Existing pages/dashboard remain independent | Snapshot is a separate homepage section; indicator data and dashboard adapter stay unchanged |
| Current phase, improving/weakening signals | Phase precedence and per-indicator signal classifications |
| Risks and indicators to watch | Explicit independent risk rules and evidence-backed watch items |
| No unsupported investment advice | Copy and type/model scope explicitly prohibit action recommendations |
