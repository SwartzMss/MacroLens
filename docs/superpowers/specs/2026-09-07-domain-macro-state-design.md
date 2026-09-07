# Domain-Based Macro State Analysis

## Context

MacroLens currently builds a deterministic `MacroSnapshot` from the original Dashboard indicator set. That model produces one activity phase and a flat list of signals, risks, and watch items. The data registry now also contains credit, social-financing, LPR, policy-rate, unemployment-rate, exports, and imports. Adding those datasets to the existing flat activity rules would mix incompatible economic domains and observation cadences.

Issue #119 evolves the interpretation layer into a domain-based macro state model while preserving the existing strengths of the V1 implementation: deterministic rules, explicit numeric evidence, versioned behavior, cautious wording, and auditable tests.

## Goals

- Analyze six explicit domains: Growth / Activity, Prices, Credit & Liquidity, Policy / Financial Conditions, Labor, and External.
- Use all 18 registered official indicator datasets, including the seven newer datasets, without expanding the Dashboard card set.
- Return structured domain states with supporting evidence, risks, and watch-next items.
- Keep heterogeneous observation periods, frequencies, event semantics, and freshness visible.
- Derive any top-level synthesis from domain states and preserve meaningful conflicts.
- Keep classification dependent on numeric and structural facts, never presentation labels or prose.
- Preserve the existing `MacroSnapshot` entry point and homepage integration with a focused UI adaptation.

## Non-goals

- No new indicator ingestion or JSON semantic migration.
- No numeric macro score, weighted score, confidence score, or probability.
- No causal-strength estimates, asset-price prediction, trading signal, or investment recommendation.
- No LLM, RAG, agent workflow, database, or historical vintage storage.
- No replacement of the curated Dashboard with all 18 indicators.

## Design alternatives

### A. Extend the current flat `macroSnapshot.ts`

This is the smallest diff, but it would keep six independent economic rule sets, evidence construction, and synthesis in one module. It would also make it easy for new rules to accidentally depend on the old activity phase.

### B. Domain modules behind one snapshot facade — selected

Keep `src/data/macroSnapshot.ts` as the public orchestration boundary and move domain-specific rules into focused modules under `src/data/macroSnapshot/`. A shared evidence builder handles common data and time semantics; each domain owns its indicator membership, thresholds, wording, and domain-specific state. A separate synthesis module consumes only domain outputs. This gives each unit a small test surface and prevents domain rules from becoming a shared scoring engine.

### C. Keep V1 and add a parallel V2 model

This would reduce immediate migration risk, but would leave two interpretation models and two sources of truth in the homepage. It would also make it unclear which model downstream consumers should trust.

Option B is selected because the issue asks for an architectural evolution, not another parallel view, while the public builder and static homepage can remain stable.

## Architecture

### Public orchestration

`src/data/macroSnapshot.ts` remains the public entry point and exports:

- `macroSnapshotRulesVersion`
- domain and evidence types
- `getMacroSnapshotIndicators()`
- `buildMacroSnapshot(indicators = getMacroSnapshotIndicators())`

`getMacroSnapshotIndicators()` reads the canonical datasets from `getIndicatorData()` for this fixed set:

```text
gdp, pmi, industrial-production, retail-sales, fixed-asset-investment,
cpi, core-cpi, ppi,
m0, m1, m2, credit, social-financing,
policy-rate, lpr,
unemployment-rate,
exports, imports
```

`getDashboardIndicators()` remains responsible only for the existing 11-card Dashboard. The homepage passes Dashboard indicators to `MacroDashboard` and the separate macro indicator map to `MacroSnapshot`.

### Module boundaries

```text
src/data/macroSnapshot.ts
  ├── macroSnapshot/evidence.ts
  ├── macroSnapshot/growth.ts
  ├── macroSnapshot/prices.ts
  ├── macroSnapshot/creditLiquidity.ts
  ├── macroSnapshot/policyFinancialConditions.ts
  ├── macroSnapshot/labor.ts
  ├── macroSnapshot/external.ts
  └── macroSnapshot/synthesis.ts
```

The exact file names may be adjusted to match repository conventions, but responsibilities must remain separate:

- `evidence.ts` converts canonical datasets into numeric evidence and preserves time/provenance metadata. It must not classify a domain.
- Each domain module evaluates only its declared indicators and returns a `MacroDomainState`.
- `synthesis.ts` consumes domain states only. It must not read raw indicators or recreate parallel V1 rules.
- `macroSnapshot.ts` validates the indicator set, invokes all domains in stable order, flattens their risks/watch items for compatibility, and returns the snapshot.

## Data model

### Evidence

`SnapshotEvidence` is the normalized fact used by every domain. It contains at least:

```ts
type SnapshotEvidence = {
  id: string;
  seriesId?: string;
  name: string;
  metric: string;
  frequency: string;
  valueLabel: string;
  changeLabel: string;
  conceptHref: string;
  latest: number;
  previous: number | null;
  change: number | null;
  changeUnit: SnapshotChangeUnit;
  observationPeriod: string;
  unit: string;
  updatedAt: string;
  verifiedThrough: string | null;
  chartType?: string;
  isEvent: boolean;
};
```

For regular single-series datasets, evidence is built from `data` and the last two observations. For LPR, each canonical series becomes separate evidence with a stable `seriesId` such as `1y` or `5y-plus`. For policy-rate, evidence uses the event data and marks `isEvent: true`; no synthetic monthly observation is created.

Evidence IDs are stable and unambiguous. A series evidence ID is formed from the dataset ID and series ID, for example `lpr:1y`. Conclusions reference these IDs, so the UI can render the exact facts supporting a state.

Classification may use `latest`, `previous`, `change`, `frequency`, `metric`, and event/series structure. It must never use `valueLabel`, `changeLabel`, `name`, or generated prose as a rule input.

### Domain output

```ts
type MacroDomainState = {
  id: MacroDomainId;
  label: string;
  state: MacroDomainStateValue;
  explanation: string;
  evidence: SnapshotEvidence[];
  risks: SnapshotConclusion[];
  watchNext: SnapshotConclusion[];
};
```

`MacroDomainStateValue` is a small semantic vocabulary (`strengthening`, `weakening`, `stable`, `mixed`, `divergent`, `easing`, `tightening`, `elevated`, or `notable`). Domain explanations provide the precise meaning; no domain is forced to pretend that every signal has the same economic interpretation.

`SnapshotConclusion` keeps the existing explainable shape but accepts evidence IDs from all registered datasets:

```ts
type SnapshotConclusion = {
  id: string;
  title: string;
  explanation: string;
  kind: 'risk' | 'watch';
  evidenceIds: string[];
};
```

### Snapshot output and freshness

```ts
type MacroSynthesis = {
  label: string;
  explanation: string;
  supportingDomainIds: MacroDomainId[];
  conflictingDomainIds: MacroDomainId[];
  contextualDomainIds: MacroDomainId[];
};

type MacroSnapshot = {
  rulesVersion: string;
  freshness: {
    earliestUpdatedAt: string;
    latestUpdatedAt: string;
    note: string;
  };
  domains: MacroDomainState[];
  synthesis: MacroSynthesis;
  risks: SnapshotConclusion[];
  watchNext: SnapshotConclusion[];
};
```

The top-level freshness range is descriptive metadata only. The UI must show each evidence item's observation period and update context. It must not label `latestUpdatedAt` as though every indicator were observed through that date. The prior V1 `phase` and one-signal-per-Dashboard-indicator contract are replaced by domain output; no compatibility field should reintroduce a second aggregate scoring model.

## Domain rules

All rules use explicit numeric boundaries and deterministic ordering. Threshold constants live with the domain that owns them and are covered by focused tests.

### Growth / Activity

Evidence: PMI, GDP, industrial production, retail sales, and fixed-asset investment.

- PMI uses 50 as its level reference; growth indicators use zero as the level reference.
- Level and momentum are reported separately.
- A positive level with weakening momentum produces a qualified/slowing state, not an expansion claim.
- PMI below 50 while other activity levels remain positive produces a mixed state and cites both sides of the evidence.
- Risks mention activity weakness or synchronized momentum loss only when their explicit counts are met.

### Prices

Evidence: CPI, core CPI, and PPI.

- Each series retains its own level and recent change.
- Divergence across consumer, core, and producer prices produces `divergent` or `mixed`.
- Explanations remain about price evidence and do not infer demand, asset prices, investment, or a single inflation regime without aligned evidence.

### Credit & Liquidity

Evidence: M0, M1, M2, credit, and social financing.

- Monetary growth evidence and credit/financing evidence are evaluated as two explicit groups.
- A group can be strengthening, weakening, or stable based on its numeric levels and momentum.
- Divergence between money growth and credit/social-financing produces a mixed state.
- Wording explicitly avoids `more liquidity => stronger economy` and does not convert monetary or financing growth into demand or asset-price conclusions.

### Policy / Financial Conditions

Evidence: policy-rate event series and every LPR series.

- Policy-rate observations retain event/step semantics and use the last actual event plus `verifiedThrough` context.
- LPR observations retain separate series identity and level semantics.
- A policy-rate move and unchanged LPR levels can produce mixed or qualified evidence; neither is treated as direct proof of realized financing demand or economic outcomes.
- The domain may describe easing/tightening/stability in policy or quoted financing conditions only, with risks/watch items tied to the exact event/series evidence.

### Labor

Evidence: unemployment rate.

- Rising unemployment relative to the previous monthly observation is weakening labor evidence.
- Falling unemployment is strengthening labor evidence; unchanged values are stable.
- Labor remains its own domain and is not mechanically added to Growth / Activity.

### External

Evidence: exports and imports.

- Exports and imports are classified independently using level and momentum of their published growth rates.
- Improving exports with weakening imports, or the reverse, produces a divergent/mixed state.
- The domain reports trade-side evidence only and does not infer domestic demand or a causal growth outcome from one series.

## Synthesis

`deriveSynthesis(domains)` accepts only domain states. It creates a concise label and names supporting, conflicting, and contextual domains using deterministic, domain-aware rules:

- Only Growth / Activity and Labor `strengthening`/`weakening` states may support or conflict with a top-level activity direction.
- Prices, Credit & Liquidity, Policy / Financial Conditions, and External remain contextual regardless of whether their local state is `strengthening`, `weakening`, `easing`, or `tightening`; those states must not be treated as a universal macro polarity.
- If Growth / Activity and Labor directions conflict, return a qualified synthesis and list both groups.
- If several activity-oriented domains strengthen or weaken without a conflicting activity-oriented domain, return a direction-specific synthesis while naming the domains.
- If no activity-oriented domain has a clear direction, return a contextual synthesis rather than forcing directionality.

The synthesis never computes or exposes a score. Flattened top-level `risks` and `watchNext` are stable-order concatenations of domain outputs and do not run another set of rules.

## UI adaptation

`MacroSnapshot.astro` will render:

- the synthesis label and explanation;
- one section/card per domain with its state and explanation;
- evidence links/facts for each domain, including observation period and freshness context;
- domain risks and watch-next items;
- the existing disclaimer against investment advice.

The UI will not expose `rulesVersion` as a user-facing label. It will not hide event or quarterly timing behind a single snapshot date. CSS changes are limited to responsive domain/evidence layout.

## Error handling and input validation

`buildMacroSnapshot` must reject missing, duplicate, or unexpected indicator IDs with an explicit error naming the missing/invalid IDs. It must also reject empty observations and invalid series input rather than silently dropping evidence. The canonical registry already performs structural validation; this layer assumes structurally valid datasets and focuses on interpretation semantics.

## Testing strategy

Replace the V1 phase-centric macro snapshot assertions with focused domain fixtures and keep the homepage source-contract checks. Tests must cover:

- all six domains are returned in a stable order;
- the seven newer registered datasets participate in their expected domains;
- growth level positive + momentum weakening;
- PMI below 50 while other activity indicators are positive;
- diverging CPI/core CPI/PPI;
- diverging monetary growth and credit/social financing;
- policy-rate event evidence and LPR multi-series evidence;
- exports/imports divergence;
- labor weakening independently of growth;
- conflicting domains yield a mixed/qualified synthesis;
- quarterly, monthly, and event observation periods remain visible;
- `updatedAt`/`verifiedThrough` context remains per evidence and no top-level max date is presented as a universal as-of claim;
- changing presentation labels does not change classification;
- missing/duplicate input is rejected;
- all domain conclusions have evidence IDs that resolve to domain evidence;
- no numeric score, confidence score, investment recommendation, or causal overclaim is introduced in output or UI.

The pre-existing policy-rate date assertions are kept data-driven so later official unchanged-rate verification updates do not make the full baseline fail.

Required verification commands remain:

```bash
npm test
npm run check
npm run build
npm run test:output
```
