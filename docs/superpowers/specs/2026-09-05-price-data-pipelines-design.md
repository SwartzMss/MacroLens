# MacroLens Price Data Pipelines Design

Date: 2026-09-05
Issue: #74
Status: Proposed for implementation

## Context

MacroLens already has build-time ingestion for PMI, money supply, and selected
real-economy indicators. The concept pages for CPI, core CPI, and PPI exist,
but these indicators are not yet backed by official monthly datasets. Issue #74
adds that missing price dimension without weakening the project's provenance,
validation, or reproducibility guarantees.

The product contract is deliberately narrow:

| Dataset | Official series | Frequency | Metric | Unit |
| --- | --- | --- | --- | --- |
| `cpi` | 居民消费价格同比 | monthly | `yoy` | `%` |
| `core-cpi` | CPI 扣除食品和能源同比 | monthly | `yoy` | `%` |
| `ppi` | 工业生产者出厂价格同比 | monthly | `yoy` | `%` |

All three values must be published values from the National Bureau of
Statistics (NBS). Core CPI must never be calculated locally from component
prices.

## Goals

- Add `data/indicators/cpi.json`, `core-cpi.json`, and `ppi.json` using the
  existing `IndicatorDataset` contract.
- Retrieve official NBS observations through one coherent price-data adapter.
- Preserve complete available historical monthly sequences rather than a
  rolling fixed window.
- Reject historical overlap mismatches, duplicate months, malformed values,
  gaps, unsupported series, and methodology changes before any target file is
  changed.
- Update all three datasets as one transaction: a failure in one series must
  leave all three existing files untouched.
- Expose the three datasets through the existing dashboard card/adapter path.
- Add price signals to the snapshot as a separate family, without changing the
  existing activity phase rules.
- Keep the scheduled workflow deterministic: no changed data means no data
  diff and no update PR.

## Non-goals

- No locally derived core CPI, CPI components, GDP deflator, housing prices,
  unemployment, credit aggregates, or market rates.
- No unofficial mirror or fallback source.
- No runtime browser fetch.
- No backend, machine-learning forecast, investment recommendation, or
  deterministic claim that PPI changes cause CPI changes.
- No replacement of the existing real-economy or money-supply adapters.

## Source and provenance design

The adapter will use the official NBS National Data structured endpoint used by
the existing real-economy ingestion path:

`https://data.stats.gov.cn/dg/website/publicrelease/web/external/stream/esData`

The implementation must verify the exact official `cid`, indicator IDs, series
titles, unit, frequency, and national-area dimension for all three price
series before adding them to the mapping constants. The identifiers are part
of the source contract and must be covered by fixtures and parser tests; they
must not be guessed from a display label.

Each dataset will retain:

- the structured request URL and request body used to retrieve the series;
- an official NBS data URL suitable for human inspection;
- the latest official release page as a provenance/methodology anchor;
- source publication date and truthful observation coverage;
- a stable methodology fingerprint containing the dataset identity, published
  metric, scope, and any applicable NBS base-year/version boundary.

The NBS National Data portal is the data authority. Official release pages
such as the NBS CPI/PPI monthly release and interpretation pages are used for
publication and methodology evidence, not as an unofficial data fallback.

The current NBS publication cycle includes a CPI base-year change to 2025
starting in 2026. The adapter must represent this explicitly in the
methodology metadata. It may retain historical observations across a documented
and comparable boundary only when the official series and methodology metadata
support that treatment. An undocumented or non-comparable fingerprint change
must raise `MethodologyMismatchError` instead of silently appending data.

If the shared dataset type needs to carry the effective date of a documented
methodology boundary, add an optional `methodologyEffectiveFrom` field. The
field is metadata only; it does not permit mixing incompatible series.

## Data contracts

Add a price-specific contract in `scripts/ingest/types.ts`:

```ts
type PriceDatasetId = 'cpi' | 'core-cpi' | 'ppi';

type PriceContract = {
  id: PriceDatasetId;
  sourceCode: string;
  sourceTitle: string;
  frequency: 'monthly';
  unit: '%';
  metric: 'yoy';
  calculation: 'published';
  methodologyFingerprint: string;
};
```

The source-code mapping will additionally contain the official structured
endpoint collection and indicator IDs. The runtime contract will require:

- dates normalized to `YYYY-MM`;
- strictly increasing, duplicate-free observations;
- numeric finite values only;
- one observation per calendar month;
- exact `unit = '%'`, `frequency = 'monthly'`, and `metric = 'yoy'`;
- source titles matching the expected official series;
- a non-empty official data and methodology provenance record.

Price continuity differs from the real-economy adapter: January and February
are separate monthly observations. A missing month is a validation failure;
the adapter must not synthesize or split a combined period.

The normalized JSON should use deterministic key ordering and the existing
two-space JSON formatting. `updatedAt` is derived from the newest official
source/publication date, never from the wall clock.

## Ingestion architecture

Add a price-specific adapter rather than refactoring the existing pipelines:

- `scripts/ingest/fetch/nbs-prices.ts`: official mapping, request builder,
  structured response parser, and release/provenance discovery;
- `scripts/ingest/normalize/prices.ts`: source-to-dataset normalization,
  exact overlap merge, metadata construction, and deterministic serialization
  inputs;
- `scripts/ingest/validate/prices.ts`: price-specific contract, continuity,
  identity, and methodology validation;
- `scripts/ingest/price-cli.ts`: one CLI that loads all three existing files,
  fetches all three candidates, validates all three, and writes the group;
- a small transactional group writer, shared only where it does not alter the
  behavior of existing single-dataset writers.

The CLI will support the same reviewable fixture/target-directory controls as
the real-economy CLI so tests and maintainers can reproduce a run without live
network access.

### Group transaction

The price CLI must perform these phases in order:

1. Load all existing datasets and fetch/parse all three candidate series.
2. Normalize and validate every candidate, including historical overlap and
   methodology checks, entirely in memory.
3. Serialize all three outputs into a sibling staging directory.
4. Compare every staged output with its current target before committing.
5. If all outputs are valid and at least one changed, commit the complete group
   with a same-filesystem transaction/rollback protocol. If staging,
   verification, or validation fails, remove staging and leave targets
   untouched.
6. If all serialized outputs are unchanged, remove staging and perform no
   target writes.

The transaction tests will inject a failure in one series and assert that none
of the three target files changes. A second run against the same fixtures must
be idempotent.

## Workflow

Add the package script:

`npm run ingest:nbs-prices -- --target-dir data/indicators`

Add one scheduled workflow step after the existing NBS real-economy step. Add
the three price JSON files to the workflow action's `add-paths` list. The
workflow continues to create a PR only when a tracked data file changed.

The adapter must not create a data PR when the official data and deterministic
metadata are unchanged.

## Dashboard integration

Extend `dashboardIndicatorIds`, the dashboard name map, and the registry imports
from eight to eleven datasets:

- `cpi` → `CPI`
- `core-cpi` → `核心 CPI`
- `ppi` → `PPI`

Use the existing dashboard card and concept-link mechanism. The dashboard
change formatter must be metric-aware: all three price series use
“个百分点” for changes because their metric is `yoy`. The same formatter
rule should remain correct for existing `cumulative_yoy` and `index` datasets.

## Snapshot integration

Add `price-yoy` as a distinct signal family. Price signals should report two
separate layers:

- Fact: latest official YoY level and change from the previous month, with the
  change expressed in percentage points.
- Interpretation: descriptive level sign (`同比上涨`, `同比持平`, or
  `同比下降`) plus a cautious momentum description based on the existing
  explicit ±0.2 percentage-point boundary.

Price signals must not participate in the existing five-indicator activity
phase calculation. They must not be flattened into monetary growth or used to
derive an inflation/deflation conclusion solely from one month's movement.
The snapshot may show price signals alongside the existing activity and money
signals, while preserving the existing evidence/fact versus interpretation
separation and concept links.

The snapshot rules version must be incremented because the signal set and
interpretation rules change.

## Test strategy

Add deterministic fixtures for all three official series and tests covering:

- official series identity, exact title, unit, frequency, and `yoy` metric;
- complete historical monthly parsing and continuity;
- official, non-derived core CPI values;
- exact historical overlap acceptance and mismatch rejection;
- duplicate month rejection;
- missing month rejection;
- malformed, non-numeric, non-finite, or unsupported values;
- methodology fingerprint mismatch and documented boundary metadata;
- deterministic `updatedAt`, coverage, request metadata, and idempotent output;
- all-or-nothing group failure behavior;
- CLI and workflow wiring;
- registry and dashboard inclusion;
- dashboard/snapshot percentage-point formatting;
- price snapshot facts and interpretations remaining separate from activity
  phase rules;
- existing ingestion, dashboard, snapshot, check, and build regressions.

The final verification sequence is:

```text
npm test
npm run check
npm run build
```

## Acceptance criteria

Issue #74 is complete when the three official datasets are present with
truthful complete available monthly coverage, reproducible provenance,
explicit methodology metadata, strict validation, and atomic updates; the
scheduled workflow can update them without partial writes; the dashboard
renders all three using percentage-point changes; and the snapshot reports
them as a separate descriptive price family without changing activity-phase
semantics.
