# External-Sector Foundation Design

## Goal

Create MacroLens's first coherent external-sector knowledge cluster by adding an `external` category, five foundational concept pages, and defensible relationships to the existing exchange-rate cluster.

## Scope

The change adds these stable concept IDs:

- `balance-of-payments`
- `current-account`
- `financial-account`
- `cross-border-capital-flows`
- `effective-exchange-rate`

The pages will not include charts. This keeps the batch focused on statistical definitions and avoids presenting a series before its provider, frequency, sign convention, unit, base period, and update process are modeled cleanly.

The change will not add homepage sections, an international investment position page, an external-debt page, a standalone capital-account page, a data-ingestion pipeline, or new UI components.

## Architecture

The implementation will use the existing Astro content architecture:

- Extend `src/data/categories.ts` so the content schema accepts `external` and `/concepts` renders it after `exchange`.
- Add five Markdown entries under `src/content/concepts/`, using the existing frontmatter schema and page structure.
- Extend `data/relations/macro.json` with concept and abstract nodes plus typed edges. Existing graph helpers and relationship cards will render these relationships without component changes.
- Keep charts absent from frontmatter, so the indicator registry and chart component remain unchanged.

## Content Design

Each page will cover the existing MacroLens content pattern: definition, statistical or methodological scope, how to read the measure, transmission context, common misconceptions, primary sources, and relationship context.

The cluster will teach accounting structure before macro narratives:

- `balance-of-payments` explains BPM6 current, capital, and financial accounts plus net errors and omissions; it separates residence from nationality, flows from positions, transactions from valuation effects, and accounting balance from economic balance.
- `current-account` covers goods and services, primary income, and secondary income; it distinguishes SAFE balance-of-payments data from Customs trade data.
- `financial-account` covers direct investment, portfolio investment, derivatives, other investment, and reserve assets; it explains asset acquisition, liability incurrence, gross versus net flows, and source-specific signs.
- `cross-border-capital-flows` is an analytical umbrella rather than a universal official series. It names the underlying dataset before interpreting inflow or outflow.
- `effective-exchange-rate` distinguishes USD/CNY, the CFETS RMB index, NEER, and REER, including provider weights, price adjustment, base/index semantics, and methodology differences.

Claims will remain conditional. The pages will not assert that a current-account surplus must appreciate the currency, capital inflows must lift equities, capital outflows must reduce reserves one-for-one, or REER appreciation must reduce exports by the same amount.

## Relationship Design

The graph will add the five linking concept nodes and these abstract, non-linking nodes where needed:

- `cross-border-financial-transactions`
- `multilateral-currency-value`

The canonical relationships will be:

```text
current-account --COMPONENT_OF--> balance-of-payments
financial-account --COMPONENT_OF--> balance-of-payments
financial-account --MEASURES--> cross-border-financial-transactions
cross-border-capital-flows --REFLECTS--> cross-border-financial-transactions
cross-border-capital-flows --AFFECTS--> exchange-rate
cross-border-capital-flows --AFFECTS--> financing-conditions
current-account --CORRELATES--> exchange-rate
effective-exchange-rate --MEASURES--> multilateral-currency-value
effective-exchange-rate --CORRELATES--> cfets-rmb-index
effective-exchange-rate --AFFECTS--> economic-activity
```

`COMPONENT_OF` represents statistical-account structure, not causation. `CORRELATES` remains symmetric through the existing graph registry. The design does not encode the balance-of-payments accounting identity as a causal edge.

The page copy will additionally explain that foreign-exchange reserves are stocks of reserve assets whose changes include transactions and valuation effects, while financial-account entries are transaction flows. It will also explain that USD/CNY is bilateral whereas effective-rate and CFETS measures are multilateral indexes with distinct methodologies.

## Sources and Provenance

Primary and methodological sources will take precedence:

- SAFE for China's balance-of-payments accounts and cross-border datasets.
- IMF BPM6 for account structure, residence, transaction, position, valuation, and sign conventions.
- BIS for NEER and REER concepts and provider methodology.
- CFETS for comparison with the existing RMB basket index.
- China Customs only to explain why customs trade statistics and balance-of-payments goods data answer different questions.

Each page will link directly to the relevant primary source or methodology page and state the definition confirmation date in frontmatter.

## Validation and Failure Handling

The category union in `src/data/categories.ts` is the content-validation boundary. A misspelled or unregistered category must fail Astro content validation.

Graph validation remains in `src/data/graphRegistry.ts`: every linking concept must have a graph node, every relation endpoint must resolve, and existing relation direction and symmetry rules remain unchanged. No new relation type is required.

Verification will check:

- all five stable routes build;
- `/concepts` contains the `external` group after `exchange`;
- Pagefind indexes the five new pages;
- related-concept links resolve where target pages exist;
- abstract graph nodes render as non-linking labels;
- relationship direction and symmetric semantics match the canonical edge list;
- `npm run check` passes;
- `npm run build` passes.

## Acceptance Mapping

This design satisfies issue #23 by adding the category and all five concepts, preserving BPM6 account distinctions and sign warnings, separating flows from stocks and transactions from valuation, avoiding a synthetic capital-flow chart, distinguishing bilateral and multilateral exchange-rate measures, relying on primary sources, and preserving the existing concept-index, search, related-concept, and relationship-card architecture.
