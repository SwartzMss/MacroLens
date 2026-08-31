# Business-Cycle Foundation Design

## Goal

Create a coherent business-cycle cluster inside MacroLens's existing `growth` category while keeping observed statistics, estimated economic slack, and heuristic cycle narratives clearly separated.

## Scope

The change adds these stable concept IDs:

- `output-gap`
- `inventory-cycle`
- `capacity-utilization`
- `industrial-profits`
- `leading-indicators`

The pages will not include charts. This avoids presenting an unofficial China output-gap series and postpones capacity-utilization and profit charts until their provider, frequency, cumulative or point-in-time semantics, comparable-population rules, and update process are explicitly modeled.

The change will not add recession dating, a homemade composite leading indicator, an investment clock, sector rotation, equity-market timing, or new data-ingestion infrastructure.

## Architecture

The implementation uses the existing Astro content architecture:

- Keep the existing `growth` category and add five Markdown entries under `src/content/concepts/`, ordered 6 through 10 after the current growth concepts.
- Extend `data/relations/macro.json` with five concept nodes, three abstract nodes, and five typed relationships.
- Leave category registration, indicator registry, chart component, routes, and other UI components unchanged.
- Add focused Node contracts. The current `npm test` glob will execute them in Node 20 CI.

## Content Design

### Output gap

`output-gap` will define the gap as actual output relative to estimated potential output, normally expressed as a share of potential output. Actual GDP is observed through the official national-accounts process; potential output and the output gap are not directly observable. Statistical filters, production-function approaches, and multivariate models can produce different real-time estimates, especially near the sample endpoint, and estimates may be revised as data and model assumptions change. The page will not present an IMF, OECD, or private estimate as an official National Bureau of Statistics GDP series.

### Inventory cycle

`inventory-cycle` will distinguish the stock of inventories on enterprise balance sheets, finished-goods inventory growth, the flow of inventory accumulation or depletion, and the change-in-inventories component in expenditure-side GDP. A rise in inventory stock, a positive inventory growth rate, and a positive contribution to GDP growth are not interchangeable statements. The common active/passive restocking and destocking narrative will be presented as a conditional analytical framework whose timing depends on demand, production, prices, financing, and firms' expectations—not as a deterministic clock.

### Capacity utilization

`capacity-utilization` will explain the official NBS ratio of actual output to production capacity, both measured in value terms. It will state that the published industrial statistic is based on a survey of above-designated-size industrial enterprises, combining a census of large and medium enterprises with a sample of small and micro enterprises, and is published quarterly without seasonal adjustment. Interpretation must consider industry production technology, seasonal patterns, long-run comparisons, and structural changes. A high utilization rate will not be equated automatically with economy-wide overheating.

### Industrial profits

`industrial-profits` will anchor its scope in industrial legal entities with annual principal business revenue of at least RMB 20 million. It will distinguish profit total, profit growth, operating revenue, operating cost, and operating revenue margin. Regular releases report year-to-date cumulative values; January is not separately reported. Published growth rates use a comparable-population calculation because the surveyed enterprise set and historical base can change. A monthly amount may be approximated by subtracting adjacent cumulative totals, but it must be labeled as derived, and a monthly year-on-year rate requires matching the corresponding prior-year cumulative differences. Base effects and loss-to-profit transitions require separate treatment.

### Leading indicators

`leading-indicators` will define “leading” as an empirical role relative to a specified target, horizon, and historical sample—not as one universal official series. PMI new orders, explicitly defined credit measures, and market variables may be examples, but each requires a named construction and scope. The page will distinguish diffusion indexes, growth rates, levels, and derived impulses; it will not create a composite CLI or imply that any signal guarantees a turning point.

## Sources and Provenance

Primary sources take precedence:

- National Bureau of Statistics for GDP, industrial capacity utilization, industrial-enterprise finance, finished-goods inventories, and PMI definitions.
- People's Bank of China only when discussing a specifically defined credit-related signal.
- IMF or OECD only for methodology concepts such as potential output, output-gap estimation, and real-time revision uncertainty.

Each page will cite the precise official definition or release used. Methodological estimates will be labeled by provider and never described as directly observed official China data.

## Relationship Design

The graph adds five linking concept nodes and three abstract, non-linking nodes:

- `economic-slack`
- `corporate-operating-conditions`
- `future-activity-signals`

Canonical relationships:

```text
output-gap --REFLECTS--> economic-slack
capacity-utilization --REFLECTS--> industrial-activity
industrial-profits --REFLECTS--> corporate-operating-conditions
inventory-cycle --AFFECTS--> industrial-activity
leading-indicators --REFLECTS--> future-activity-signals
```

No new relation will use `CAUSES`. The graph will not encode a deterministic inventory clock, guaranteed recession signal, fixed link from utilization to inflation, or profit-to-equity-market timing rule.

## Data Flow and Rendering

Astro's content collection validates the five entries against the existing `growth` category. Stable IDs produce concept routes and related links; order values place them after current growth concepts; the graph registry supplies relationship cards; and Pagefind indexes rendered pages during production build. With no chart frontmatter, the indicator registry and data-fetch path are not involved.

## Validation and Failure Handling

`tests/business-cycle-content.test.mjs` will enforce:

- exact stable frontmatter and growth orders 6–10;
- absence of chart frontmatter;
- valid related IDs;
- unobservable, estimated, model-dependent, and revisable output-gap semantics;
- inventory stock, growth, accumulation, and GDP-contribution distinctions;
- official capacity-utilization coverage, quarterly frequency, lack of seasonal adjustment, and conditional interpretation;
- industrial-profit scope, cumulative reporting, January omission, comparable-population growth, monthly derivation, margin, and base-effect semantics;
- leading-indicator scope, horizon, empirical instability, and no homemade composite;
- direct authoritative source links.

`tests/business-cycle-relations.test.mjs` will enforce unique graph nodes and relation triples, valid endpoints and relation types, the exact five relationships, non-linking abstract nodes, and absence of unsupported `CAUSES` relations involving the cluster.

Full verification will run:

```text
npm test
npm run check
npm run build
git diff --check
```

The build must generate all five concept routes and include them in Pagefind. Missing related pages, invalid frontmatter, graph drift, and lost semantic contracts must fail CI rather than degrade silently.

## Acceptance Mapping

This design satisfies issue #26 by adding all five concepts under `growth`; separating official observations from estimated slack; distinguishing inventory stocks, growth, flows, and GDP contribution; preserving the official capacity-utilization and industrial-profit scope; treating leading signals and inventory narratives as conditional; using official sources wherever observed data are involved; and adding only non-deterministic graph relationships without premature chart integration.
