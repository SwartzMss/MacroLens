# Macro Graph Node Type Semantics Design

## Background

Macro graph nodes now expose one of four explicit types: `indicator`, `concept`, `mechanism`, or `state`. The Relationship Explorer groups nodes by that type, so a legacy `kind: indicator` classification on an analytical framework or economic mechanism is visible to users as a misleading indicator label.

Issue #129 audits all 143 macro graph nodes and corrects only classifications that are clearly inconsistent with the existing taxonomy.

## Goals

- Review all 143 nodes against the existing four-type definitions.
- Correct the eight clearly misclassified nodes identified by the audit.
- Remove `kind: indicator` from every node that is no longer an indicator.
- Preserve every node ID, relationship edge, edge direction, and relationship metadata object.
- Add regression coverage for representative semantic classifications and legacy alias consistency.
- Document the institution/actor taxonomy limitation without expanding the enum.

## Classification decisions

The following changes are in scope:

| Node IDs | Current type | New type | Reason |
| --- | --- | --- | --- |
| `central-bank`, `government` | `mechanism` | `concept` | Institutions/behavioral actors are not processes or transmission channels; `concept` is the least misleading existing bucket. |
| `phillips-curve`, `price-transmission`, `interest-rate-parity`, `carry-trade` | `indicator` | `mechanism` | These represent an economic relationship, pricing/transmission process, or behavioral strategy rather than a published data series. |
| `capital-controls`, `impossible-trinity` | `indicator` | `concept` | These are policy/institutional constructs or named analytical frameworks, not measured variables. |

For all six nodes changing away from `indicator`, remove their legacy `kind: indicator` field. The two institution nodes do not currently expose `kind`, so no `kind` change is needed for them.

All other nodes remain unchanged after the full audit. In particular, directly published or plausibly estimable variables such as `output-gap`, `terms-of-trade`, `capital-account`, and `inventory-cycle` remain indicators under the current definition.

## Non-goals

- Do not add `actor`, `institution`, or `policy-tool` to the node type enum.
- Do not rewrite relationships, infer new edges, rename node IDs, or alter relationship metadata.
- Do not change Macro Snapshot behavior, ingestion, concept pages, or graph rendering.

## Implementation

1. Update only the `type` and legacy `kind` fields in `data/relations/macro.json` for the eight decisions above.
2. Extend `tests/macro-node-types.test.mjs` with representative assertions for each corrected category, including both institution nodes, analytical frameworks, mechanisms, and policy constructs.
3. Keep the existing runtime validation test and add explicit invariants that every legacy `kind` is paired with `type: indicator`, the graph still contains 143 nodes and 143 relations, and all relation endpoints resolve to the unchanged node ID set.
4. Use the final diff to verify that no relationship object or node ID changed.
5. In the PR description, state that `central-bank` and `government` are temporarily represented as broad concepts because the current taxonomy has no actor/institution type; future expansion should be evaluated separately.

## Testing and acceptance

- `npm test` passes, including the semantic classification regression tests.
- `npm run check` reports zero errors, warnings, and hints.
- `npm run build` succeeds.
- `git diff --check` is clean.
- The data diff contains only the approved node type/legacy alias changes; node IDs and relationships remain stable.

