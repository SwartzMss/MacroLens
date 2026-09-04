# Structured National Data Provenance Coverage Design

## Goal

Make persisted provenance coverage for structured National Data compact, stable across workflow run times, and truthful about the periods actually represented by each semantic source code.

## Context

`parseNbsRealEconomyResponse` currently stores one `date to date` range for every accepted observation in each structured National Data source. This is especially noisy for long monthly series and for cumulative fixed-asset-investment observations. The existing request provenance stabilization already derives the persisted request range from the response rather than the wall-clock run time; this change must preserve that behavior.

## Design

### Coverage formatting

Add a focused coverage formatter used by the structured National Data parser:

- Sort and de-duplicate source periods before formatting.
- Merge periods that are consecutive under the dataset's existing period semantics into `start to end`.
- Detect a complete sequence of the same `YYYY-01–02` period across consecutive years and represent it as `start to end (annual)`. This keeps the compact representation truthful because it encodes the yearly step instead of implying that all intervening monthly periods exist.
- Leave irregular gaps as separate ranges, while still merging any consecutive runs inside the set.
- Keep the existing `coverage: string` field and human-readable separator conventions so persisted JSON and the source display remain compatible.

Examples:

```text
2026-01–02 to 2026-01–07
2011-03 to 2026-07
2011-01–02 to 2026-01–02 (annual)
```

### Coverage validation

Extend the real-economy coverage parser to understand the optional `(annual)` qualifier. Annual ranges cover only the matching period shape in each year from the start year through the end year. Existing ordinary ranges retain their current inclusive period-rank behavior. This ensures source pruning and final dataset validation do not mistake an annual Jan-Feb series for continuous monthly coverage.

The parser will reject malformed or reversed annual ranges in the same way it rejects malformed ordinary coverage. No changes are made to observation parsing, data values, source URLs, request metadata, or methodology fingerprints.

### Persisted data

The four NBS real-economy indicator JSON files will be regenerated or migrated only for the coverage strings produced by the new formatter. Data observations and all other provenance fields must remain byte-for-byte equivalent except where the compact coverage text replaces its expanded equivalent.

## Data flow

```text
structured response
  -> parse and normalize source periods
  -> compact coverage per source code
  -> normalize with existing observations/sources
  -> validate annual/ordinary coverage semantics
  -> stable JSON writer
```

The request body and request URL continue to be built from the latest response period, so running the workflow on different days against the same response produces identical normalized datasets.

## Error handling

- Invalid source periods continue to fail through the existing `IngestionContractError` path.
- Coverage compression must never invent periods; it only groups already accepted periods according to explicit continuity rules.
- An annual representation is emitted only when every year in its span has the same accepted period. Missing years remain separate ranges.
- Existing source and dataset validation remains the final guard before writing files.

## Testing

Add regression tests for:

1. Consecutive cumulative periods compressing to one range.
2. Monthly periods compressing to one range while preserving the current source split.
3. Consecutive annual Jan-Feb periods using the `(annual)` representation.
4. Annual coverage validation covering Jan-Feb dates but not a missing March date.
5. A gap preventing an over-broad annual or continuous range.
6. Same response fetched at different workflow times yielding deep-equal normalized output and no second-run write.

Retain the existing full ingestion suite. The three known baseline failures in `tests/ingestion-pboc-money-supply.test.mjs` are unrelated to this design and will be reported separately.

## Scope

This change is limited to structured National Data coverage generation/validation and the corresponding persisted NBS real-economy coverage metadata. It does not redesign the provenance schema, alter source request construction, repair unrelated PBOC tests, or change indicator observation semantics.
