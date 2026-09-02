# PBOC money-supply ingestion design

## Goal

Extend the ingestion pipeline introduced by #45/#50 to update the existing
`m0.json`, `m1.json`, and `m2.json` indicator datasets from official People's
Bank of China (PBOC) monthly financial-statistics reports. The adapter must
make one report produce all three series while preserving the existing
indicator semantics and making historical, methodological, and provenance
errors fail loudly.

This PR does not change concept prose, graph relations, the static-site data
model, or any other automated indicator family.

## Source and discovery

The adapter uses the official PBOC data-interpretation index:

`https://www.pbc.gov.cn/diaochatongjisi/116219/116225/index.html`

It accepts only links whose visible title matches a monthly
`YYYY年M月金融统计数据报告`, resolves relative URLs against the PBOC origin,
and verifies the report page itself has the same title and a valid publication
date. Annual financial reports, social-financing reports, media pages, and
non-PBOC hosts are rejected.

Each monthly report contains the three values in the same section:

- `广义货币（M2）余额 ... 同比增长/下降 ...`
- `狭义货币（M1）余额 ... 同比增长/下降 ...`
- `流通中货币（M0）余额 ... 同比增长/下降 ...`

The parser extracts the percentage growth rates, not the balance values. A
report is valid only when all three series are present exactly once, the
month can be derived from the report title, and every numeric value is a
finite percentage with an optional negative sign.

The current report is not assumed to contain the complete history. The CLI
discovers all relevant monthly reports exposed by the index and fetches the
reports needed to cover the missing months after the latest stored
observation. This allows the first run to backfill the existing gap between
2025-10 and the latest available report while keeping each report's coverage
truthful.

## Dataset and methodology contract

The three datasets retain their current fields and meanings:

- `frequency: monthly`
- `unit: %`
- `metric: yoy`
- observations are month-end monetary-balance year-on-year growth rates
- `calculation` remains dataset-specific (`published` for M1 and the existing
  balance-derived semantics for M0/M2)

The generic dataset validator will validate field shape, monthly date format,
ordering, continuity, source coverage, official source dates, and the
`methodologyFingerprint` field. PMI-specific constraints remain in the PMI
adapter; in particular, the generic validator will not require an index unit,
the `[0, 100]` range, or an NBS source.

The money-supply adapter uses explicit fingerprints instead of inferring a
methodology from the numeric series:

- M0: currency in circulation, month-end balance YoY, including e-CNY from
  the 2022-12 statistical change;
- M1: the revised definition effective from 2025-01, consisting of M0,
  corporate demand deposits, personal demand deposits, and non-bank payment
  institution customer reserves;
- M2: money and quasi-money, consisting of M1 plus time and other deposits.

The live report must contain the current PBOC M1 revision note and the exact
three series labels. The existing dataset fingerprint and definition dates
are compared before any merge. Missing or changed required methodology text,
series scope, unit, frequency, metric, or definition fingerprint raises
`MethodologyMismatchError`; no historical values or definition dates are
rewritten automatically.

## Merge and provenance invariants

1. Every incoming report must contain M0, M1, and M2 for the same month.
2. Incoming report months must be sorted, unique, and continuous.
3. Every overlap between stored and fetched observations must match exactly;
   a mismatch raises `HistoricalMismatchError` and does not overwrite data.
4. The final merged observations for each dataset must be sorted and fully
   continuous month by month.
5. A report source has coverage equal to the month actually reported by that
   URL, for example `2026-07 to 2026-07`. Coverage is never taken from the
   merged dataset.
6. Source pruning is coverage-based. A source can be removed only if the
   remaining source coverage union still covers every stored observation.
7. A publication date older than the existing dataset `updatedAt` is rejected.
8. All three datasets receive the same report provenance for a report, while
   only datasets whose serialized contents change are written.

## Implementation shape

Reuse the existing writer and contract errors. Add the smallest shared
abstractions needed for the second adapter:

```text
scripts/ingest/
├── fetch/
│   ├── nbs-pmi.ts
│   └── pboc-money-supply.ts
├── normalize/
│   ├── pmi.ts
│   └── money-supply.ts
├── validate/
│   ├── dataset.ts          # generic contract
│   ├── pmi.ts              # NBS/PMI-specific checks
│   ├── money-supply.ts     # PBOC-specific checks
│   └── overlap.ts          # generic strict merge
├── write/
│   └── indicator.ts
└── cli.ts
```

The CLI gains an importable `runMoneySupply` path and a package script
`ingest:pboc-money-supply`. Fixture arguments remain available for ordinary
tests. The PBOC run reads the three existing files, discovers and parses the
needed reports once, normalizes one candidate dataset per series, validates
all candidates before writing any file, then writes only changed JSON files.
If any series fails, none of the three files is modified.

## Tests and workflow

Fixture tests cover official-index discovery, relative links, report title and
date validation, extraction of all three series from one report, negative
growth, missing or duplicate series, malformed numbers, methodology changes,
incoming and final continuity gaps, strict overlap mismatch, unit/frequency/
metric mismatch, truthful single-month source coverage, coverage-safe source
pruning, idempotent writes, and the multi-file CLI behavior.

The existing scheduled/manual `update-macro-data.yml` workflow is extended to
run the PBOC adapter and include `m0.json`, `m1.json`, and `m2.json` in the
reviewable PR paths. It remains a static-data workflow: no browser automation,
runtime API, unofficial mirror, or direct main-branch write is introduced.

## Verification

Before creating the PR, run the full test suite, `npm run check`, and
`npm run build`, plus the fixture CLI and diff checks. The final PR body will
state that the changes close #51 and that the automated update is restricted
to official PBOC data and reviewable JSON changes.
