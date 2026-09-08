# Macro Graph Node Type Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the eight clearly misclassified macro graph nodes while preserving all node IDs and relationship edges.

**Architecture:** Keep the existing four-value `MacroNodeType` taxonomy and make the smallest possible data-only correction in `data/relations/macro.json`. Extend the existing graph-type tests with explicit semantic expectations and inventory/alias invariants; no production TypeScript or UI changes are needed.

**Tech Stack:** JSON graph data, Node.js built-in test runner, TypeScript/Astro checks, Astro static build, Pagefind.

---

## File map

- Modify `tests/macro-node-types.test.mjs`: add failing-first regression assertions for the approved semantic classifications and graph invariants.
- Modify `data/relations/macro.json`: change only the `type` and legacy `kind` fields for the eight approved nodes.
- Create `docs/superpowers/specs/2026-09-08-macro-node-type-semantics-design.md`: approved design and taxonomy boundary, already committed in `25ab59b`.
- Create `docs/superpowers/plans/2026-09-08-macro-node-type-semantics.md`: this implementation plan.

### Task 1: Add semantic classification regression tests

**Files:**
- Modify: `tests/macro-node-types.test.mjs`

- [ ] **Step 1: Add the node lookup and approved classification map.**

Immediately after the existing `nodes` declaration, add:

```js
const nodesById = new Map(nodes.map((node) => [node.id, node]));
const correctedNodeTypes = {
  'central-bank': 'concept',
  government: 'concept',
  'phillips-curve': 'mechanism',
  'price-transmission': 'mechanism',
  'interest-rate-parity': 'mechanism',
  'carry-trade': 'mechanism',
  'capital-controls': 'concept',
  'impossible-trinity': 'concept',
};
```

- [ ] **Step 2: Write the failing semantic regression test.**

Add this test after `formalizes every macro graph node with a semantic type`:

```js
test('classifies frameworks, mechanisms, policy constructs, and institutions semantically', () => {
  for (const [id, expectedType] of Object.entries(correctedNodeTypes)) {
    assert.equal(nodesById.get(id)?.type, expectedType, `${id} should be a ${expectedType}`);
  }

  for (const id of Object.keys(correctedNodeTypes)) {
    assert.equal(nodesById.get(id)?.kind, undefined, `${id} must not retain the legacy indicator kind`);
  }
});
```

- [ ] **Step 3: Add graph inventory and legacy alias invariants.**

Add this test after the semantic regression test:

```js
test('keeps the audited graph inventory and legacy indicator alias consistent', () => {
  const relations = graph.filter((element) => 'source' in element.data).map((element) => element.data);
  const nodeIds = new Set(nodes.map((node) => node.id));

  assert.equal(nodes.length, 143);
  assert.equal(relations.length, 143);
  assert.equal(nodeIds.size, nodes.length);
  for (const node of nodes) {
    if (node.kind !== undefined) assert.equal(node.type, 'indicator', `${node.id} has a non-indicator legacy kind`);
  }
  for (const relation of relations) {
    assert.equal(nodeIds.has(relation.source), true, `missing source node: ${relation.source}`);
    assert.equal(nodeIds.has(relation.target), true, `missing target node: ${relation.target}`);
  }
});
```

- [ ] **Step 4: Run the focused test and confirm it fails for the current data.**

Run:

```bash
node --import tsx --test --test-name-pattern='classifies frameworks, mechanisms, policy constructs, and institutions' tests/macro-node-types.test.mjs
```

Expected: the new test fails because the current graph still reports the approved nodes as `indicator` or `mechanism`; this confirms the test protects the intended behavior before the data change.

### Task 2: Correct only the approved node metadata

**Files:**
- Modify: `data/relations/macro.json` node entries for `central-bank`, `government`, `phillips-curve`, `price-transmission`, `interest-rate-parity`, `carry-trade`, `capital-controls`, and `impossible-trinity`

- [ ] **Step 1: Change the two institution nodes to `concept`.**

Replace the two node entries with:

```json
{"data":{"id":"central-bank","label":"中央银行","type":"concept"}},
{"data":{"id":"government","label":"政府","type":"concept"}},
```

- [ ] **Step 2: Change analytical frameworks and economic mechanisms to `mechanism`.**

Replace the four entries with:

```json
{"data":{"id":"phillips-curve","label":"菲利普斯曲线","type":"mechanism"}},
{"data":{"id":"price-transmission","label":"价格传导","type":"mechanism"}},
{"data":{"id":"interest-rate-parity","label":"利率平价（CIP / UIP）","type":"mechanism"}},
{"data":{"id":"carry-trade","label":"套息交易","type":"mechanism"}},
```

- [ ] **Step 3: Change policy constructs to `concept`.**

Replace the two entries with:

```json
{"data":{"id":"capital-controls","label":"资本流动管理","type":"concept"}},
{"data":{"id":"impossible-trinity","label":"不可能三角","type":"concept"}},
```

The six entries above intentionally omit `kind: indicator`; no `kind` field is added to either institution node because neither had one before.

### Task 3: Verify the data-only change and commit it

**Files:**
- Verify: `data/relations/macro.json`
- Verify: `tests/macro-node-types.test.mjs`

- [ ] **Step 1: Run the focused semantic tests and the complete graph-type test file.**

Run:

```bash
node --import tsx --test --test-name-pattern='classifies frameworks, mechanisms, policy constructs, and institutions|keeps the audited graph inventory and legacy indicator alias consistent' tests/macro-node-types.test.mjs
node --import tsx --test tests/macro-node-types.test.mjs
```

Expected: both commands exit 0; the semantic test reports eight corrected classifications and the inventory test reports 143 nodes and 143 relations.

- [ ] **Step 2: Inspect the diff for scope and relationship stability.**

Run:

```bash
git diff -- data/relations/macro.json
git diff --check
git diff --name-only origin/main...HEAD
```

Expected: the data diff contains only the eight approved node metadata lines; no `source`, `target`, relation `type`, relationship metadata, node ID, or label changes appear. `git diff --check` is clean.

- [ ] **Step 3: Commit the implementation.**

Run:

```bash
git add data/relations/macro.json tests/macro-node-types.test.mjs
git commit -m "fix: correct macro graph node type semantics"
```

### Task 4: Run the full repository verification

**Files:**
- Verify: repository test, check, and build outputs

- [ ] **Step 1: Run the full test suite.**

Run:

```bash
npm test
```

Expected: exit 0 with zero failed tests.

- [ ] **Step 2: Run Astro diagnostics.**

Run:

```bash
npm run check
```

Expected: exit 0 with 0 errors, 0 warnings, and 0 hints.

- [ ] **Step 3: Run the production build.**

Run:

```bash
npm run build
```

Expected: exit 0, all static routes generated, and Pagefind completes. An existing Vite chunk-size warning may appear but does not fail the build.

- [ ] **Step 4: Confirm the worktree and final diff.**

Run:

```bash
git status --short --branch
git diff origin/main...HEAD --check
git diff origin/main...HEAD --stat
```

Expected: the worktree is clean; the final diff contains the design/spec history plus only `data/relations/macro.json` and `tests/macro-node-types.test.mjs` for the implementation, with no production source changes.

### Task 5: Review and create the PR

**Files:**
- Verify: committed branch and GitHub PR metadata

- [ ] **Step 1: Request a focused code review of the implementation commit.**

Provide the reviewer the approved spec, the implementation commit SHA, and these requirements: all 143 nodes audited; only the eight approved type changes; six legacy aliases removed; IDs and relationship edges stable; no taxonomy expansion; tests/check/build pass.

- [ ] **Step 2: Push the branch.**

Run:

```bash
git push -u origin codex/issue-129-macro-node-type-semantics
```

- [ ] **Step 3: Create the PR linked to issue #129.**

Run:

```bash
gh pr create --repo SwartzMss/MacroLens --base main --head codex/issue-129-macro-node-type-semantics --title "fix: correct macro graph node type semantics" --body-file /tmp/macrolens-issue-129-pr-body.md
```

The PR body must state that `central-bank` and `government` are temporarily classified as broad `concept` nodes because the current four-type taxonomy lacks an actor/institution category, and must include `Closes #129`, the verification results, and the explicit no-relationship-change scope.
