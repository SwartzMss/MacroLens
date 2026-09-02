# Inflation Framework Design

## Goal

Extend MacroLens's existing inflation and price-observation framework with four connected concept pages: GDP deflator, inflation expectations, the Phillips curve, and price transmission.

## Scope

This PR will:

- Add four concept documents under the existing `inflation` category.
- Register each concept in the existing `prices-inflation` topic, with `gdp-deflator` and `phillips-curve` also in `economic-activity`.
- Add explicit prerequisite metadata as a DAG:
  - `gdp-deflator`: `gdp`, `cpi`
  - `inflation-expectations`: `cpi`
  - `phillips-curve`: `inflation-expectations`, `output-gap`
  - `price-transmission`: `cpi`, `ppi`
- Add the four concepts as indicator nodes and add only cautious, non-deterministic relation triples to `data/relations/macro.json`.
- Add regression tests for metadata, stable graph nodes, exact relation triples, and prohibited causal claims.

The homepage remains unchanged. Existing category/topic navigation and static generation should discover the new concepts through their existing data sources.

## Content and relation design

The four pages should explain definitions, measurement boundaries, interpretation, timing, and common mistakes. They must distinguish price indexes, expectations, relationships, and mechanisms rather than presenting a single deterministic inflation story.

The relation additions are:

```text
gdp-deflator          --MEASURES-->   economy-wide-price-level
inflation-expectations --AFFECTS-->  price-setting
inflation-expectations --AFFECTS-->  real-interest-rate
output-gap            --CORRELATES--> inflation-pressure
phillips-curve        --REFLECTS-->  inflation-slack-relationship
ppi                   --AFFECTS-->   downstream-price-pressure
price-transmission    --REFLECTS-->  upstream-downstream-price-pass-through
```

The graph must not claim that unemployment or an output gap causes inflation, that PPI increases guarantee CPI increases, or that expectations have a one-way mechanical effect. Abstract nodes remain graph concepts without concept pages.

## Architecture

Use the current content collection schema and concept catalog for metadata, the current `macro` graph registry for relation data, and existing concept-page rendering. Do not introduce a new route, chart, homepage path, or alternate relation source. The four new concepts should use `graph: macro` so their relation cards render from the canonical graph dataset.

## Verification

Add focused tests alongside the existing content and relation contract tests. The full acceptance check is:

```text
npm test
npm run check
npm run build
```

The build must produce static pages for all four concepts and retain the existing homepage markup.
