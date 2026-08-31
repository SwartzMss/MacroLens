# Labor-Market Foundation Design

## Goal

Create MacroLens's foundational labor-market cluster with a `labor` category, five source-grounded concept pages, and cautious relationships that distinguish labor-force status, participation, and pay measures.

## Scope

The change adds these stable concept IDs:

- `employment`
- `unemployment-rate`
- `youth-unemployment`
- `labor-force-participation`
- `wages`

The pages will not include charts. In particular, the published age-group unemployment series changed methodology when the National Bureau of Statistics began publishing rates excluding students, so this batch will explain the break rather than imply a continuous series.

The change will not add vacancy, Beveridge-curve, NAIRU, Phillips-curve, productivity, aging, pension, or labor-data ingestion features.

## Architecture

The implementation uses the existing Astro content architecture:

- Extend `src/data/categories.ts` with `labor`, ordered after `external`.
- Add five Markdown entries under `src/content/concepts/` using the current content schema.
- Extend `data/relations/macro.json` with five concept nodes, two abstract nodes, and typed relationships.
- Leave the indicator registry, chart component, routes, and UI components unchanged.
- Add focused Node contract tests; the existing `npm test` glob automatically runs them in Node 20 CI.

## Content Design

- `employment` defines a stock/status measure and distinguishes employed persons from new urban employment, payroll counts, and job-posting proxies.
- `unemployment-rate` distinguishes surveyed and registered unemployment, states that the denominator is the labor force, explains survey coverage, and warns that a stable rate need not mean a strong market.
- `youth-unemployment` explains current age-group publication excluding students, the historical methodology break, and why old and new series must not be spliced directly.
- `labor-force-participation` defines the labor force as employed plus unemployed and uses the working-age population as its denominator. It explains that unemployment can fall when people leave the labor force.
- `wages` distinguishes average and median, nominal and real, wage/total labor compensation and disposable income, and states the coverage limits of official establishment wage series.

National Bureau of Statistics definitions and methodology are primary. ILO concepts may be used only as a cross-check or international conceptual reference.

## Relationship Design

The graph adds the five linking concept nodes and two abstract, non-linking nodes:

- `labor-market-conditions`
- `labor-supply`

Canonical relationships:

```text
employment --REFLECTS--> labor-market-conditions
unemployment-rate --REFLECTS--> labor-market-conditions
youth-unemployment --REFLECTS--> labor-market-conditions
labor-force-participation --REFLECTS--> labor-supply
wages --AFFECTS--> consumer-price-pressure
wages --AFFECTS--> consumption-activity
labor-market-conditions --AFFECTS--> economic-activity
```

The graph will not encode unemployment as a deterministic cause of GDP, nor participation changes as inherently good or bad. Page prose will describe transmission as conditional on composition, hours, productivity, prices, and the economic cycle.

## Validation

Labor-specific content tests will enforce the category, stable IDs, no-chart scope, essential statistical distinctions, official source links, and valid `related` IDs. Relationship tests will enforce exact nodes and edges, uniqueness, valid endpoints and types, non-linking abstract nodes, and absence of unsupported deterministic `CAUSES` edges.

Full verification will run:

```text
npm test
npm run check
npm run build
```

The Astro build validates content, routes, concept grouping, relationship rendering, and Pagefind indexing.

## Acceptance Mapping

This design satisfies issue #24 by adding the category and five requested concepts; explicitly separating surveyed from registered unemployment; documenting the youth-series break and student treatment; defining participation and wage denominators and coverage; avoiding deterministic macro claims; using official NBS methodology as the primary source; and preserving existing related-concept, relationship, search, and build behavior.
