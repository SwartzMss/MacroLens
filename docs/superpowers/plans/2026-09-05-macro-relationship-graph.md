# Macro Indicator Relationship Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a discoverable `/graph` page that lets users explore the canonical macro indicator relationship graph with upstream/downstream details and concept-page links.

**Architecture:** Keep `data/relations/macro.json` as the only relationship source. A new Astro route loads the existing graph registry and concept collection, renders a server-side node/relationship fallback, and passes the same payload to a focused ECharts component for client-side pan, zoom, selection, and adjacency highlighting. The site navigation and homepage relationship section expose the route.

**Tech Stack:** Astro 5 static routes, TypeScript graph registry, ECharts 6, Node test runner, existing MacroLens CSS tokens.

---

### Task 1: Lock the graph data and page contract with failing tests

**Files:**
- Create: `tests/relationship-graph.test.mjs`
- Test input: `data/relations/macro.json`
- Test source contracts: `src/pages/graph.astro`, `src/components/RelationshipGraph.astro`, `src/layouts/BaseLayout.astro`, `src/pages/index.astro`

- [ ] **Step 1: Write the failing graph contract test**

Create tests that load the JSON and source files. The data test must assert that every node ID is unique, every edge has a valid source/target/type, every endpoint exists, and every `(source,target,type)` triple is unique. It must also assert the required Issue #69 clusters exist:

```js
const expectedRelations = [
  ['m2', 'activity', 'CORRELATES'],
  ['pmi', 'business-activity-conditions', 'REFLECTS'],
  ['industrial-activity', 'economic-activity', 'COMPONENT_OF'],
  ['activity', 'macro', 'AFFECTS'],
  ['investment-activity', 'economic-activity', 'COMPONENT_OF'],
];
for (const relation of expectedRelations) assert.ok(relationKeys.has(relation.join('|')));
```

The source contract must initially fail because the graph route and component do not yet exist. It should require `/graph`, `getRelationData('macro')`, ECharts graph configuration, grouped upstream/downstream wording, a no-JavaScript fallback, a graph navigation link, and a homepage graph link.

- [ ] **Step 2: Run only the new test and confirm the expected RED state**

Run:

```bash
node --import tsx --test tests/relationship-graph.test.mjs
```

Expected: the data assertions pass, while the source contract fails with missing graph route/component or missing links. Fix only test typos if the failure is a module or syntax error; do not add production code yet.

- [ ] **Step 3: Commit the failing contract test**

```bash
git add tests/relationship-graph.test.mjs
git commit -m "test: define relationship graph contract"
```

### Task 2: Add the graph page and canonical server-side payload

**Files:**
- Create: `src/pages/graph.astro`
- Create: `src/components/RelationshipGraph.astro`
- Modify: `src/styles/global.css` (homepage graph-link styling)
- Modify: `src/layouts/BaseLayout.astro:15` (navigation)
- Modify: `src/pages/index.astro:19` (relationship section entry)

- [ ] **Step 1: Add the route using existing registries**

In `src/pages/graph.astro`, import `getCollection`, `BaseLayout`, `RelationshipGraph`, and `getRelationData`. Load the concepts collection, create a `conceptIds` array from `concept.data.id`, call `getRelationData('macro')`, and pass `{ nodes, relations, conceptIds, initialNodeId: 'm2' }` to the component. Keep the page copy explicit that this is a manually curated relationship map and not an automatic causal model.

- [ ] **Step 2: Add server-rendered graph fallback and details markup**

In `src/components/RelationshipGraph.astro`, define typed props for `RelationNode[]`, `Relation[]`, `conceptIds`, and `initialNodeId`. Use `getConceptRelations('macro', initialNodeId)` for the initial details panel, and render:

```astro
<section class="graph-shell" data-graph data-payload={JSON.stringify({ nodes, relations, conceptIds, initialNodeId })}>
  <label for="graph-node">查找节点</label>
  <select id="graph-node" data-graph-select>{nodes.map(node => <option value={node.id} selected={node.id === initialNodeId}>{node.label}</option>)}</select>
  <div class="graph-layout">
    <div class="graph-canvas" data-graph-canvas role="img" aria-label="宏观指标关系图"></div>
    <aside data-graph-details aria-live="polite">
      <h2>{selectedNode.label}</h2>
      {conceptIds.includes(selectedNode.id) ? <a href={`/concepts/${selectedNode.id}`}>打开概念页 →</a> : <p>图谱概念：用于解释关系，不单独提供概念页。</p>}
      {groupedRelations.map(([heading, items]) => <section><h3>{heading}</h3><ul>{items.map(item => <li>{item.relationLabel} {item.arrow} {item.otherLabel}</li>)}</ul></section>)}
    </aside>
  </div>
  <noscript>启用 JavaScript 后可拖拽、缩放并聚焦节点；下方关系列表仍可直接阅读。</noscript>
</section>
```

Before the template, define `selectedNode`, `relationLabels`, and `groupedRelations` from `getConceptRelations('macro', initialNodeId)`. Group `incoming` as `上游 / 指向它`, `outgoing` as `下游 / 它指向`, and `symmetric` as `相互关联`; derive `arrow` as `←`, `→`, or `↔`. Use the existing relation labels and node lookup to fill `otherLabel`. 

Each relation list must show the existing relation label, arrow direction, and either a `/concepts/<id>` link when `conceptIds` contains the node or plain text marked `图谱概念` for abstract nodes. Use only the existing relation labels and make symmetric relations visibly `↔`.

- [ ] **Step 3: Add the static route and discovery links**

Add `<a href="/graph">关系图</a>` to the shared navigation. In the homepage relationship section, add `<a class="section-link" href="/graph">查看完整关系图 →</a>` next to the existing explanatory copy. Preserve all existing learning-path content.

- [ ] **Step 4: Run the contract test and confirm only the client behavior remains RED**

Run:

```bash
node --import tsx --test tests/relationship-graph.test.mjs
```

Expected: the source and server fallback assertions pass; assertions requiring `echarts.init`, graph series configuration, and selection updates still fail.

- [ ] **Step 5: Commit the static route and fallback**

```bash
git add src/pages/graph.astro src/components/RelationshipGraph.astro src/layouts/BaseLayout.astro src/pages/index.astro
git commit -m "feat: add macro relationship graph route"
```

### Task 3: Implement interactive ECharts graph behavior

**Files:**
- Modify: `src/components/RelationshipGraph.astro` client script
- Create: `src/styles/graph.css`
- Modify: `src/pages/graph.astro` to import `../../styles/graph.css`

- [ ] **Step 1: Write the minimal browser payload assertions**

Extend `tests/relationship-graph.test.mjs` to require the component script to:

```js
assert.match(source, /import \* as echarts from ['"]echarts['"]/);
assert.match(source, /echarts\.init/);
assert.match(source, /type:\s*['"]graph['"]/);
assert.match(source, /force/);
assert.match(source, /data-graph-select/);
assert.match(source, /data-graph-details/);
assert.match(source, /CORRELATES|OVERLAPS_WITH/);
```

- [ ] **Step 2: Run the focused test and verify it fails for missing client behavior**

Run `node --import tsx --test tests/relationship-graph.test.mjs`. Expected: failure states that the component lacks ECharts initialization or graph series configuration.

- [ ] **Step 3: Add the ECharts graph enhancement**

In the component script, parse the JSON payload, initialize the canvas once, and set an ECharts `graph` series with `layout: 'force'`, `roam: true`, `draggable: true`, node categories for indicators/context nodes, and links from the canonical relations. Use `focus: 'adjacency'` for hover emphasis. Treat `CORRELATES` and `OVERLAPS_WITH` as symmetric when building the selected-node detail view; all other edges retain source-to-target direction. On chart click, update the select value, replace the details panel, and call `chart.setOption` with the selected node emphasized. On select change, update the same state. Build details with DOM APIs or escaped text; never inject raw relationship labels as unsanitized HTML.

- [ ] **Step 4: Add responsive and accessible graph styles**

Create `src/styles/graph.css` using existing tokens. Set a card-like graph shell, a minimum 640px desktop canvas, a two-column graph/details layout, visible focus styles for the select and links, and a single-column layout below 900px. Keep the fallback lists readable when the canvas is unavailable. Add a `.section-link` rule to `src/styles/global.css` for the homepage entry link.

- [ ] **Step 5: Run focused tests and build checks**

Run:

```bash
node --import tsx --test tests/relationship-graph.test.mjs
npm run check
```

Expected: the focused contract test passes and Astro reports no type/template errors. If the Astro checker rejects browser-only types, scope the script types to `HTMLElement`, `HTMLSelectElement`, and the existing ECharts API without weakening the server-side props.

- [ ] **Step 6: Commit the interactive graph**

```bash
git add src/components/RelationshipGraph.astro src/pages/graph.astro src/styles/graph.css src/styles/global.css tests/relationship-graph.test.mjs
git commit -m "feat: make macro relationship graph explorable"
```

### Task 4: Verify the complete feature and prepare the PR

**Files:**
- Modify only if verification exposes a defect: the files from Tasks 1–3

- [ ] **Step 1: Run the complete regression suite**

Run:

```bash
npm test
```

Expected: all existing tests plus `tests/relationship-graph.test.mjs` pass with zero failures.

- [ ] **Step 2: Build the static site**

Run:

```bash
npm run build
```

Expected: Astro emits the `/graph/index.html` route and Pagefind completes without errors.

- [ ] **Step 3: Inspect the diff and worktree**

Run:

```bash
git diff --check
git status --short
git log --oneline origin/main..HEAD
```

Confirm the diff contains only the Issue #69 graph, its tests, design/plan docs, and the required navigation links. Confirm no generated `dist` or dependency files are staged.

- [ ] **Step 4: Push the branch**

```bash
git push -u origin codex/issue-69-relationship-graph
```

- [ ] **Step 5: Create the pull request**

```bash
gh pr create --base main --head codex/issue-69-relationship-graph \
  --title "feat: add macro indicator relationship graph" \
  --body-file /tmp/issue-69-pr-body.md
```

The PR body should summarize the `/graph` route, canonical data reuse, interactive selection/details behavior, and tests (`npm test`, `npm run check`, `npm run build`). It should include `Closes #69` and explicitly note that relationships remain manually curated and no unsupported causal conclusions are generated.
