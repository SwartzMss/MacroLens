# PBOC policy-rate ingestion

`npm run ingest:policy-rate` updates `data/indicators/policy-rate.json` using only official PBOC publications. It is included in the existing weekly/manual macro-data workflow, which opens a reviewable data PR when a dataset changes.

## Data semantics

- `frequency: event`, `chartType: step`, `metric: rate`, `unit: %`, `calculation: published`.
- `data` contains the initial known level and subsequent changes on actual effective/operation dates. There are no manufactured monthly or daily observations.
- The initial point, **2024-07-19 / 1.80%**, is a coverage boundary, not the first effective date of 1.80%. The modern fixed-rate, quantity-tender framework starts on **2024-07-22**. The concept retains the distinction from the historical MLF framework.
- Changes in the bootstrap are **2024-07-22 / 1.70%**, **2024-09-27 / 1.50%**, and **2025-05-08 / 1.40%**. The May decision was published on May 7; its coverage remains May 8. Each point has its exact PBOC publication URL and publication date in `sources`.
- `verifiedThrough` is the most recent effective/operation date explicitly backed by a published 7-day rate. The initial bootstrap verifies through **2026-09-01**. The September 2–4 zero-operation notices do not publish a rate and do not extend this date.
- The generic chart uses a time axis and `step: end`. A display-only terminal segment extends to `verifiedThrough`; it has no event symbol and never enters the canonical observations. Presentation distinguishes the latest event date, latest explicit rate confirmation, and coverage.

## Sources and strictness

The updater reads both the [business announcement archive](https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125469/index.html) and the [operation announcement archive](https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/index.html). Both are necessary: the September 27, 2024 rate decision took effect even though that day's operation notice only listed the 14-day tenor.

Archive discovery follows the actual next-page links back to the overlap boundary. It validates dates, descending page order, publication identity, duplicates and consecutive announcement numbers before excluding irrelevant instruments. Each run also re-fetches every recorded event and the last confirmation. A changed value, effective date, source date, title, missing source, or conflicting overlap causes a hard failure before writing.

The HTML parser checks HTTPS origin, exact archive section, the article's URL metadata, heading, publication timestamp, operation/effective date and operation-office signature. Redirects are refused. Rates are extracted from the exact 7-day row and named interest-rate column of the reverse-repo table. Mixed MLF, overnight, and 14-day tables cannot supply the canonical rate. The parser rejects duplicates, malformed/missing values, unknown tenors and unknown structures. Recognized other instruments, spread-reference notices and zero-operation notices are explicitly excluded, rather than converted into observations.

A decision and an operation on the same effective date may corroborate one another only if their rates agree; the decision's provenance takes precedence. Two decisions or two 7-day observations for the same date fail. Announced previous rates must agree with the preceding canonical level.

An unchanged operation can advance the explicit verification date and replace the last confirmation source; this is a legitimate metadata update, not a new rate event. Re-fetching the same state, reaching a new calendar month, or encountering a zero-operation notice produces no change. JSON field order and writes are deterministic. New future-effective decisions are applied only on/after their stated effective date (Shanghai calendar date); `--as-of YYYY-MM-DD` supports reproducible runs.

## Reproducing the history

Use Node 24. To regenerate into a new, separate target:

```sh
npm run ingest:policy-rate -- --bootstrap --target /path/to/new-policy-rate.json --as-of 2026-09-07
```

Bootstrap refuses to overwrite an existing target. It walks the complete operation archive back to the initial point and cross-checks all relevant business announcements. The initial live bootstrap inspected **547 operation notices and 14 business notices**; 52 notices were excluded because they did not publish the target rate. An incomplete archive or changed parser contract fails rather than fabricating a continuous history.

The fixtures in `tests/fixtures/pboc/policy-rate/` retain the official article title, URL metadata, publication timestamp and article body, with surrounding navigation removed. `publications.json` identifies their exact sources. Tests cover the real change and unchanged publications, nested markup, mixed instruments, zero operations, duplicate/conflicting dates, provenance and overlap mismatches, archive completeness, no-write failures, deterministic updates, actual rendered step geometry, and existing monthly/quarterly/multi-series charts.
