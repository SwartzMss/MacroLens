# Global Relationship Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the PR's product-regressing force graph with an unlinked, readable relationship explorer that follows Issue #17.

**Architecture:** Keep `data/relations/macro.json` and `graphRegistry.ts` as the domain model. Render all node neighborhoods through the existing `RelationshipCards` component inside selectable static panels. Use a small DOM enhancement to toggle panels; do not use ECharts, Cytoscape, force layouts, or a canvas.

**Tech Stack:** Astro 5 static routes, TypeScript graph registry, existing relationship-card component, Node test runner, MacroLens CSS tokens.

---

### Task 1: Encode the #17 product boundary in tests

**Files:**
- Modify: `tests/relationship-graph.test.mjs`

- [ ] **Step 1: Assert the canonical data contract**

Keep assertions for unique node IDs, unique `(source,target,type)` triples, valid endpoints/types, and the representative M2, PMI, activity, and investment relationships.

- [ ] **Step 2: Assert the explorer contract**

Require the route to use `RelationshipExplorer` and `getRelationData('macro')`; require the component to use `getConceptRelations`, `RelationshipCards`, `data-explorer-select`, and `data-explorer-panel`. Require upstream/downstream/symmetric-readable wording and the abstract-node fallback.

- [ ] **Step 3: Assert the visual-graph boundary**

Require that `BaseLayout.astro` and `index.astro` do not contain `/graph` links. Require that the route and explorer component do not contain ECharts, Cytoscape, `force`, or `graph-canvas` references.

- [ ] **Step 4: Run the focused test before implementation**

Run `node --import tsx tests/relationship-graph.test.mjs`. The canonical data test passes; explorer assertions fail against the old force-graph implementation. This proves the regression guard is active.

### Task 2: Implement the readable explorer

**Files:**
- Delete: `src/components/RelationshipGraph.astro`
- Delete: `src/styles/graph.css`
- Create: `src/components/RelationshipExplorer.astro`
- Create: `src/styles/explorer.css`
- Modify: `src/pages/graph.astro`

- [ ] **Step 1: Build the server-side panels**

Load every node and derive `getConceptRelations('macro', node.id)`. Pass the existing concept collection to `RelationshipCards`. Render a select of stable node IDs and a panel per node, with only the M2 panel visible by default. Link only IDs in the concept collection; render other nodes with the `图谱概念` marker.

- [ ] **Step 2: Add the accessible panel switcher**

Listen for `change` on `[data-explorer-select]`, toggle each `[data-explorer-panel]` through its `hidden` property, update the selected class, and focus the selected panel's heading. Leave the server-rendered default panel readable without JavaScript.

- [ ] **Step 3: Remove primary-product promotion**

Remove the `/graph` anchor from `BaseLayout.astro` and the homepage relationship section. Keep the existing `TransmissionPaths` content unchanged. Rename the route copy to “关系浏览器” and explain that it is curated relationship data rather than a causal or visual graph.

- [ ] **Step 4: Add responsive explorer styles**

Style the select, selected-node header, and existing relationship cards using existing tokens. Use a single-column layout on mobile; do not add canvas height, zoom, legend, force-layout, or node-link styles.

### Task 3: Update the issue and verify the revised PR

**Files:**
- Modify remotely: GitHub Issue #69 title and body
- Modify: `docs/superpowers/specs/2026-09-05-macro-relationship-graph-design.md`
- Modify: `docs/superpowers/plans/2026-09-05-macro-relationship-graph.md`

- [ ] **Step 1: Rewrite Issue #69 around the refined goal**

Rename it to `Add Global Macro Relationship Explorer` and state that it inherits #17: structured graph data remains, but no node-link visualization, primary `/graph` navigation link, or homepage graph promotion may be added. Acceptance criteria must cover node selection, readable groups, stable links, unlinked route, and canonical data reuse.

- [ ] **Step 2: Run focused and type checks**

Run:

```bash
node --import tsx tests/relationship-graph.test.mjs
npm run check
```

Expected: all focused tests pass and Astro reports 0 errors, warnings, and hints.

- [ ] **Step 3: Run regression and production build checks**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass, `/graph/index.html` is generated as a text-first explorer, and Pagefind completes.

- [ ] **Step 4: Push the same PR branch**

```bash
git push origin codex/issue-69-relationship-graph
```

Update PR #72's summary and test plan to describe the Relationship Explorer and explicitly state that the #17 force-graph regression was removed.
