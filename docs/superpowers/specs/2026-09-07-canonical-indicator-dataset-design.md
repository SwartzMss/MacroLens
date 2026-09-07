# Canonical Indicator Dataset Design

Issue: [#116](https://github.com/SwartzMss/MacroLens/issues/116)

## Goal

Define one canonical persisted `IndicatorDataset` contract shared by ingestion and runtime/site code, with structural validation separated from ingestion-specific semantic validation. Existing JSON data and site-visible behavior remain unchanged.

## Design decisions

### 1. Shared domain module is the source of truth

Create `src/domain/indicatorDataset.ts`. This module owns:

- `IndicatorDataset`;
- `IndicatorSeries`;
- `Observation`;
- `IndicatorSource`;
- `IndicatorFrequency`;
- `IndicatorChartType`;
- `IndicatorComparisonType`;
- the structural validator and its error types.

`scripts/ingest/types.ts` will re-export the shared dataset-domain types for existing ingestion imports. It will continue to own ingestion-only contracts such as publication payloads, source-specific contracts, fingerprints, and raw fetch types, but it will no longer declare a competing `IndicatorDataset` shape.

`src/data/indicatorRegistry.ts`, `src/data/indicatorPresentationAdapter.ts`, `src/data/indicatorChartOption.ts`, and `src/data/dashboard.ts` will consume the shared domain types directly where they currently import the registry-local types.

### 2. Structural validation and semantic validation are separate

The shared validator will validate only the durable JSON shape:

```text
shared domain validator
├── required fields and primitive types
├── frequency / chartType / comparisonType enums
├── observation and series structures
└── source and methodology metadata structure
```

It will not enforce chronological order, continuity, source coverage, historical overlap, source-specific methodology fingerprints, or frequency-specific observation rules.

The ingestion validator will retain those rules:

```text
ingestion semantic validation
├── continuity and allowed gaps
├── source coverage
├── historical overlap
├── methodology fingerprint stability
└── source-specific constraints
```

The existing `scripts/ingest/validate/dataset.ts` entry point remains available to callers. It will first call the shared validator, then apply its existing semantic checks and return the validated dataset. Existing specialized validators continue to pass their options for monthly, quarterly, event, and source-specific semantics.

### 3. Validator API returns validated data and reports paths

The shared API will be:

```ts
export function validateIndicatorDataset(input: unknown): IndicatorDataset;
```

The function returns the same input value after structural validation. It does not mutate or normalize the object.

Invalid input throws `IndicatorDatasetValidationError`, which exposes structured issues:

```ts
type IndicatorDatasetValidationIssue = {
  path: Array<string | number>;
  message: string;
};
```

The error message includes the dataset id when available and formats paths deterministically. For example:

```text
indicator "lpr": series[1].data[3].value must be a finite number
```

The validator may collect multiple structural issues before throwing; callers can inspect `error.issues` without parsing the formatted message.

### 4. Dataset dimensions remain orthogonal

The canonical contract will not create four top-level dataset variants. It models two independent dimensions:

| Time semantics | Data organization |
| --- | --- |
| `frequency: "monthly"` | `data: Observation[]` |
| `frequency: "quarterly"` | `data: Observation[]` |
| `frequency: "event"` | `data: Observation[]`, with optional `chartType: "step"` |
| any supported frequency | optional `series: IndicatorSeries[]` for multi-series data |

This preserves the current representations: ordinary indicators use `data[]`, LPR uses `data[]` plus `series[]`, and policy rate uses event-frequency `data[]` with step presentation metadata. The shared validator checks the shape of both `data` and `series`, but leaves date ordering, frequency-specific date syntax, and step/event meaning to ingestion or consumer-specific code.

### 5. Runtime registry validation

After importing the checked-in JSON files, `src/data/indicatorRegistry.ts` will validate every registered dataset through the shared validator before exposing the registry. A malformed checked-in dataset therefore fails at module initialization with the indicator id and field path in the error.

The registry will retain the existing id lookup behavior and will not change derived view models or page output.

## Testing strategy

Add focused tests for the shared contract:

1. Every checked-in file under `data/indicators` passes the shared validator and is returned as an `IndicatorDataset`.
2. Monthly, quarterly, event/step, and multi-series fixtures are accepted by the same validator.
3. Invalid primitive fields, enum values, observation values, source metadata, and nested series values produce deterministic path-aware issues.
4. Structurally valid but semantically unordered or gapped observations are accepted by the shared validator, while the existing ingestion semantic validator still rejects them where appropriate.
5. The registry validates all imported datasets without changing its public lookup behavior.

Existing ingestion tests will remain the coverage for continuity, provenance coverage, overlap protection, methodology fingerprints, and source-specific contracts. The tests will be adjusted only where they currently assert behavior owned by the old duplicated type definition.

## Compatibility and non-goals

- No indicator JSON file is migrated unless the validator identifies an actual structural inconsistency; current files are expected to pass unchanged.
- No new indicator is added.
- No Dashboard, Macro Snapshot, chart layout, or presentation rule is redesigned.
- No database, historical-vintage model, or source methodology change is introduced.
- No new runtime dependency is required; the validator is implemented with existing TypeScript/Node capabilities.

## Planned file changes

- Create `src/domain/indicatorDataset.ts` for shared types, issues, and structural validator.
- Modify `scripts/ingest/types.ts` to re-export shared dataset-domain types.
- Modify `scripts/ingest/validate/dataset.ts` to compose structural and semantic validation.
- Modify registry and consumer imports to use the shared domain types and validate registered JSON.
- Create focused validator tests and update only affected ingestion assertions.
- Add no data-file changes unless required by a failing structural validation test.
