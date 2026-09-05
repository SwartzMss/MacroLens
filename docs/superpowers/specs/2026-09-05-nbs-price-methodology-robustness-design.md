# NBS Price Methodology Validation Robustness

## Goal

Make the CPI, Core CPI, and PPI price ingestion adapter validate the observable
methodology semantics of official NBS pages even when inline HTML tags introduce
whitespace inside the wording. Preserve explicit failure on real methodology
changes and make failures identify the source publication.

## Scope

In scope:

- Normalize whitespace only inside the methodology guard.
- Accept the existing 2026-01 / 2025-base wording variants for CPI, Core CPI,
  and PPI, including phrases split across HTML elements.
- Include the publication URL in methodology mismatch errors.
- Add deterministic offline regression coverage for split-tag wording, invalid
  base years, missing methodology statements, and existing bare `同比持平`
  parsing.
- Re-run the full live `Update macro data` workflow after the PR is merged.

Out of scope:

- New price indicators.
- Multi-month catch-up.
- Dashboard, Snapshot, or UI changes.
- New sources or broad ingestion-framework refactors.

## Design

`parseNbsPricePublication()` will continue to call `textOf()` for the visible
page text. It will pass that visible text, the dataset ID, and the publication
URL to `assertObservableMethodology()`.

The guard will create a local compact representation with
`text.replace(/\s+/g, '')`. The existing semantic marker will be matched only
against this compact representation, leaving `textOf()` unchanged so numeric
parsing and Core CPI table parsing retain their current behavior.

On failure, `MethodologyMismatchError` will include the dataset ID and official
publication URL without logging the full HTML response.

## Verification

Tests will cover:

1. CPI accepts a valid methodology phrase split across HTML tags.
2. Core CPI accepts the same formal CPI-page structure.
3. PPI accepts split-tag versions of both `起` and `开始编制和发布` wording.
4. Changing the base year still throws `MethodologyMismatchError`.
5. Removing the effective-boundary/base-year statement still throws
   `MethodologyMismatchError` and exposes the publication URL.
6. Existing CPI/Core CPI/PPI parsing, including bare `同比持平`, remains green.

The implementation will be validated with `npm test`, `npm run check`, and
`npm run build`. After the PR is merged, the full `Update macro data` workflow
will be manually dispatched and checked for successful CPI, Core CPI, and PPI
ingestion without an unnecessary data PR when values are unchanged.
