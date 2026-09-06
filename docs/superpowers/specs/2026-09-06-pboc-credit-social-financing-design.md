# PBOC Credit and Social-Financing Data Pipelines

## Goal

Add official monthly published YoY series for:

- `credit`: financial institutions' RMB loan balance YoY (`金融机构人民币各项贷款余额同比增速`)
- `social-financing`: stock of social financing YoY (`社会融资规模存量同比增速`)

Both datasets use the existing indicator contract: monthly, `%`, `yoy`, and `published`.

## Design

1. Keep the existing M0/M1/M2 public APIs and outputs unchanged.
2. Extract common PBOC publication metadata discovery and validation so the index can classify both report families while unrelated links remain ignored.
3. Parse credit only from the exact broad RMB-loan label; the narrower “loans to the real economy” wording is not accepted as a substitute.
4. Parse social-financing only from the stock YoY field; monthly increment is intentionally not a primary series.
5. Normalize both series with the existing overlap, continuity, provenance, and atomic-write guarantees.
6. Bootstrap history from official PBOC statistical-table provenance and use monthly official reports for the incremental tail. Any missing/ambiguous/methodology-changed value fails the run.
7. Register both datasets and attach generic charts to the existing concept pages. No new relationship or dashboard model is introduced.

## Verification

Focused tests cover publication discovery, exact extraction, invalid/duplicate values, title/date/month validation, methodology fingerprints, continuity, overlap mismatch, idempotent CLI writes, registry/concept/workflow integration, and unchanged M0/M1/M2 behavior. Full `npm test`, `npm run check`, and `npm run build` are required before the PR.
