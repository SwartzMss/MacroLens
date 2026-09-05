# Global Relationship Explorer

## Context

Issue #17 established the product boundary for MacroLens: keep the knowledge graph as structured data, but present relationships through readable relationship cards and curated transmission paths. A node-link or force graph is not part of the primary product experience. Issue #69 is refined to add a global relationship explorer that follows this decision rather than reopening graph visualization.

## Goals and non-goals

Goals:

- Provide a stable, unlinked `/graph` route for browsing the canonical relationship data when a user has a direct reason to use it.
- Let a user select any node and read its incoming, outgoing, and symmetric relationships as readable cards.
- Reuse `getConceptRelations`, `RelationshipCards`, stable concept IDs, and the existing concept collection.
- Link nodes with real concept pages and show abstract/context nodes as text only.
- Keep `data/relations/macro.json` unchanged as the version-controlled knowledge-graph source.

Non-goals:

- Do not add or restore Cytoscape, ECharts graph series, force layouts, pan/zoom canvases, or network visualizations.
- Do not add `/graph` to primary navigation or the homepage.
- Do not infer, score, or generate new economic relationships at runtime.
- Do not replace the existing homepage transmission paths or concept-page relationship cards.

## User experience

The `/graph` route is titled “关系浏览器” and is intentionally not linked from the header or homepage. It contains:

1. A short explanation that the data is manually curated and does not imply automatic causation.
2. A select control listing every canonical node by label.
3. A readable panel for the selected node. The panel links to the node's concept page when one exists and marks abstract/context nodes as graph concepts.
4. Existing `RelationshipCards` output grouped as upstream/incoming, downstream/outgoing, and symmetric relationships. Relation labels and direction remain those defined by `graphRegistry.ts`.

The page server-renders the M2 panel as the default and embeds all other node panels as accessible static HTML. A small enhancement toggles panels when the select changes and moves focus to the selected heading. There is no visual graph, canvas, or layout engine.

## Architecture and data flow

`src/pages/graph.astro` loads the concept collection and the node list from `getRelationData('macro')`. `src/components/RelationshipExplorer.astro` derives each panel's direct neighborhood with `getConceptRelations('macro', node.id)` and delegates relationship rendering to `RelationshipCards.astro`.

The explorer uses concept collection IDs to decide whether a node gets a stable `/concepts/<id>` link. It does not use `kind` as a presentation category, so concept pages such as monetary policy, fiscal policy, and balance of payments are handled consistently with measured indicators. Abstract nodes remain text-only.

The existing `src/components/TransmissionPaths.astro` and concept-page relationship cards remain the primary relationship presentation. The explorer is a secondary readable query surface over the same data.

## Interaction and safety rules

- Keep `CORRELATES` and `OVERLAPS_WITH` symmetric and render them in the symmetric relationship group.
- Preserve incoming/outgoing direction supplied by `getConceptRelations`.
- Use the existing relation labels; do not introduce new economic semantics in the UI.
- Never create links for nodes absent from the concept collection.
- Keep the explorer readable on mobile without pan or zoom.
- Keep `/graph` out of the primary navigation and homepage.

## Testing strategy

- Validate node uniqueness, edge uniqueness, endpoint integrity, and the Issue #69 relationship clusters from `macro.json`.
- Assert that the route uses `RelationshipExplorer` and `getRelationData('macro')`, and that the explorer uses `RelationshipCards` and `getConceptRelations`.
- Assert that navigation/homepage do not promote `/graph` and that no ECharts, Cytoscape, force-layout, or graph-canvas code remains in the explorer route.
- Run the full Node suite, `npm run check`, and `npm run build`.

## Acceptance mapping

| Requirement | Design coverage |
| --- | --- |
| Explore upstream/downstream relationships | Select a node and read grouped relationship cards |
| Existing concept pages remain compatible | Reuse `RelationshipCards` and stable concept IDs |
| Relationship definitions are version controlled | Continue reading `data/relations/macro.json` through `graphRegistry` |
| Explainable/manual relationships | Existing labels, direction, and symmetric semantics; no inference |
| Respect #17 product decision | No force graph; `/graph` is unlinked and text-first |
