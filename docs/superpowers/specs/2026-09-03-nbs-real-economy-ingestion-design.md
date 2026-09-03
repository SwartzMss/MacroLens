# NBS Real-Economy Ingestion Design

## Goal

Automatically update the existing NBS GDP, industrial-production, retail-sales, and fixed-asset-investment indicator datasets while preserving each series' published statistical semantics and requiring manual review for historical, provenance, or methodology changes.

## Scope

This change is limited to the offline-testable ingestion pipeline, the four existing indicator JSON files, and the existing scheduled/manual macro-data workflow. It does not add concepts, redesign the site, add runtime networking, or ingest CPI/PPI.

## Architecture

The implementation adds one real-economy CLI beside the existing PMI and PBOC adapters. The series contracts distinguish the official NBS National Data codes for monthly/cumulative data from GDP's official quarterly release-page table; each contract identifies expected dataset fields, wire-period parser, sequence validator, source URL, and observable methodology anchors.

The adapter pipeline is:

```text
official National Data response
  -> publication/series metadata validation
  -> series-specific period and value normalization
  -> dataset contract validation
  -> historical overlap check
  -> merged dataset validation
  -> stable candidate files
  -> all-or-nothing writes
```

The generic dataset validator will support monthly, quarterly, combined Jan–Feb, and cumulative year-to-date period labels. Existing PMI and PBOC behavior remains covered by their specialized validators. The new CLI computes all four candidates before writing any target, so a failure in one series leaves every target unchanged.

## Series contracts

| Dataset | NBS code(s) | Frequency | Metric | Period semantics |
| --- | --- | --- | --- | --- |
| GDP | official quarterly release-page GDP YoY table (not A010101 current-quarter level) | quarterly | yoy | `YYYY-Q1` through `YYYY-Q4`; no monthly continuity |
| Industrial production | `A020101`, `A020102` | monthly | yoy | `YYYY-01–02`, then `YYYY-03` through `YYYY-12`; no synthetic Jan/Feb |
| Retail sales | `A070103`, `A070104` | monthly | yoy | `YYYY-01–02`, then `YYYY-03` through `YYYY-12`; nominal YoY |
| Fixed-asset investment | `A040102` | monthly | cumulative_yoy | `YYYY-01–02`, `YYYY-01–03` through `YYYY-01–12`; cumulative values are preserved |

Each normalized dataset must retain `id`, `country=CN`, expected frequency/unit/metric/source/calculation, truthful source coverage, ordered unique observations, and the existing dataset metadata. Methodology checks only assert labels, units, codes, and definition text present in the fetched official response.

## Failure and write behavior

Malformed or missing values, duplicate/invalid periods, wrong metadata, incomplete source coverage, non-official origins, methodology changes, and historical overlap mismatches throw typed ingestion errors. Agreement on overlap is accepted; disagreement is never overwritten.

The CLI writes only after all four normalized datasets pass validation. Stable JSON serialization makes repeated unchanged runs report no changes. The workflow continues to run PMI and PBOC first, then the four-series CLI, and passes all six indicator paths to the existing `create-pull-request` action.

## Testing

Checked-in fixtures model the official GDP release-page HTML and National Data `returndata.wdnodes`/`datanodes` wire shape for a successful four-series update, plus malformed/changed variants. Tests cover GDP table methodology, real `YYYYMM` wire periods, Jan–Feb code routing, fixed-asset cumulative progression, wrong contract metadata, provenance/coverage, methodology mismatch, duplicate/invalid periods, overlap mismatch, idempotency, and group atomicity. No test or ordinary CI command makes a live NBS request.
