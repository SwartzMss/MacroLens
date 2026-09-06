# Issue #104 implementation plan

1. Extend the PBOC fetch layer with shared publication discovery and exact credit/social-financing parsers while preserving money-supply wrappers.
2. Add dedicated validation/normalization and a fixture-capable CLI for the two new datasets.
3. Add official-provenance indicator JSON, registry entries, concept-page chart metadata, and workflow paths.
4. Add contract and integration tests, then run the full verification suite.
5. Review the diff for scope, provenance, idempotence, and M0/M1/M2 regressions before pushing and opening the PR.
