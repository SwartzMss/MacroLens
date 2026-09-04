# Macro Indicator Relationship Graph

## Context

Issue #69 asks MacroLens to move from isolated indicator pages to an explainable, connected macro knowledge model. The repository already has a manually curated `data/relations/macro.json` dataset, a typed `src/data/graphRegistry.ts` access layer, readable relationship cards on concept pages, and ECharts for existing indicator visualizations. The missing capability is a discoverable global graph that lets a user explore upstream and downstream relationships without creating unsupported economic conclusions.

## Goals and non-goals

Goals:

- Provide a stable `/graph` route where users can explore the canonical macro relationship dataset.
- Reuse existing graph nodes, relation types, concept metadata, and concept-page links.
- Make upstream, downstream, and symmetric relationships distinguishable.
- Keep all economic relationship definitions manually curated and version controlled.
- Preserve compatibility with existing concept pages and the existing JSON graph format.

Non-goals:

- Do not infer, score, or generate new economic relationships at runtime.
- Do not replace the readable relationship cards or existing transmission-path sections.
- Do not add a graph database, server API, or new content-authoring workflow.
- Do not require every abstract graph node to have a concept page.

## User experience

The `/graph` page contains:

1. A short explanation that the graph shows curated relationships rather than automatic causal claims.
2. A search/select control for finding a node by its existing label.
3. An interactive graph canvas with pan, zoom, and node dragging. Nodes are visually separated into indicator nodes and explanatory/context nodes. Directed edges use the existing relation type labels; symmetric relations are rendered without implying direction.
4. A details panel for the selected node. It shows the node label, whether a concept page exists, and grouped incoming/upstream, outgoing/downstream, and symmetric relations. Linked content pages are navigable; abstract nodes remain readable but are not made into fake pages.
5. A concise legend and an accessible text fallback listing the selected node's relationships, so the graph is not the only way to consume the information.

The page is linked from the global site navigation and from the homepage's relationship section. Existing concept-page relationship cards remain unchanged apart from an optional link to the full graph.

## Architecture and data flow

`src/pages/graph.astro` loads the concept collection and calls `getRelationData('macro')`. It passes serialized nodes, relations, and concept IDs to a focused `src/components/RelationshipGraph.astro` component. The component initializes an ECharts graph in the browser using the dependency already used by `IndicatorChart.astro`.

The browser receives only the canonical node and edge records plus the concept-page lookup needed for navigation. It does not derive new edges. Selecting a node filters/highlights its direct adjacency in the chart and renders the same direct relations in the details panel. Relation direction is calculated with the existing `getConceptRelations` semantics, including the existing symmetric relation set.

The graph remains static-site compatible: all graph data is embedded at build time, and the client script is enhancement-only. If JavaScript is unavailable, the page still exposes the node search/list and selected relationship text in the rendered HTML.

## Interaction and safety rules

- Use the existing `RelationType` values and Chinese labels; unknown relation types must not be silently accepted.
- Treat only `CORRELATES` and `OVERLAPS_WITH` as symmetric, matching `graphRegistry.ts`.
- Do not label any edge as deterministic causation unless the canonical dataset explicitly uses that relation type.
- When a node has no concept page, show its graph label and mark it as an explanatory graph node.
- Keep graph initialization resilient to an empty selection and small viewport sizes.
- Avoid random IDs or browser-only assumptions in the server-rendered fallback.

## Testing strategy

- Add a focused graph contract test that loads `data/relations/macro.json`, asserts node and relation uniqueness/referential integrity, checks the Issue #69 relationship clusters, and verifies that the graph has no unsupported duplicate edges.
- Add source-level page/component assertions for the `/graph` route, canonical dataset usage, relation labels, and concept-page links/fallback text.
- Run the full Node test suite, `npm run check`, and `npm run build` before opening the PR.

## Acceptance mapping

| Issue #69 requirement | Design coverage |
| --- | --- |
| Users can explore upstream/downstream relationships | Interactive graph selection plus grouped details panel |
| Existing concept pages remain compatible | Existing graph JSON and concept cards are reused without schema changes |
| Relationship definitions are version controlled | All edges remain in `data/relations/macro.json`; tests guard the contract |
| Reuse metadata and prerequisites | Graph registry and concept collection are the only data sources |
| Explainable/manual relationships | Existing relation types/labels and no runtime inference |
| Reusable frontend graph data | `/graph` consumes the canonical registry shape directly |

