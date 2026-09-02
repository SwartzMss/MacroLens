# Inflation Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four connected inflation concepts to MacroLens with validated metadata, prerequisite DAG edges, canonical graph relations, and regression coverage.

**Architecture:** Extend the existing `inflation` content collection and the `macro` JSON graph. New concepts use existing static concept routes, catalog validation, relationship cards, and topic/category discovery; the homepage remains untouched.

**Tech Stack:** Astro 5, Markdown content collections, TypeScript, JSON graph data, Node test runner with `tsx`.

---

### Task 1: Define the inflation framework contract with failing tests

**Files:**
- Create: `tests/inflation-framework.test.mjs`
- Read: `src/content/concepts/*.md`, `data/relations/macro.json`

- [ ] **Step 1: Write the failing contract tests**

Create a test module that:

1. Requires these four concept files and exact stable IDs, names, category `inflation`, `graph: macro`, and metadata:

```js
const expectedMetadata = {
  'gdp-deflator': {
    name: 'GDP 平减指数', category: 'inflation', graph: 'macro', level: 'basic',
    topics: ['prices-inflation', 'economic-activity'], prerequisites: ['gdp', 'cpi'],
  },
  'inflation-expectations': {
    name: '通胀预期', category: 'inflation', graph: 'macro', level: 'advanced',
    topics: ['prices-inflation'], prerequisites: ['cpi'],
  },
  'phillips-curve': {
    name: '菲利普斯曲线', category: 'inflation', graph: 'macro', level: 'advanced',
    topics: ['prices-inflation', 'economic-activity'], prerequisites: ['inflation-expectations', 'output-gap'],
  },
  'price-transmission': {
    name: '价格传导', category: 'inflation', graph: 'macro', level: 'advanced',
    topics: ['prices-inflation'], prerequisites: ['cpi', 'ppi'],
  },
};
```

2. Requires the four concepts to contain explanatory sections for their measurement boundaries, timing, uncertainty, and common misreadings. Assert these concrete terms:

```js
const requiredTerms = {
  'gdp-deflator': ['名义GDP', '实际GDP', '国内生产', '权重', '不等于CPI'],
  'inflation-expectations': ['预期通胀', '调查', '市场价格', '实现通胀', '锚定'],
  'phillips-curve': ['失业率', '产出缺口', '通胀', '预期', '不是稳定的因果定律'],
  'price-transmission': ['上游', '下游', '成本', '需求', '传导时滞', 'PPI上涨不必然带来CPI上涨'],
};
```

3. Parses `data/relations/macro.json`, asserts all new indicator and abstract nodes exist with exact labels, and asserts exactly these seven new relation triples:

```js
const expectedRelations = [
  ['gdp-deflator', 'economy-wide-price-level', 'MEASURES'],
  ['inflation-expectations', 'price-setting', 'AFFECTS'],
  ['inflation-expectations', 'real-interest-rate', 'AFFECTS'],
  ['output-gap', 'inflation-pressure', 'CORRELATES'],
  ['phillips-curve', 'inflation-slack-relationship', 'REFLECTS'],
  ['ppi', 'downstream-price-pressure', 'AFFECTS'],
  ['price-transmission', 'upstream-downstream-price-pass-through', 'REFLECTS'],
];
```

4. Rejects `CAUSES` relations in the new cluster and asserts the homepage source contains none of the four new IDs.

- [ ] **Step 2: Run the focused test to verify it fails for missing concepts/nodes**

Run: `node --import tsx --test tests/inflation-framework.test.mjs`

Expected: FAIL because the four files and new graph nodes/relations do not exist yet.

- [ ] **Step 3: Commit the red contract**

```bash
git add tests/inflation-framework.test.mjs
git commit -m "test: define inflation framework contracts"
```

### Task 2: Register canonical graph nodes and cautious relations

**Files:**
- Modify: `data/relations/macro.json`
- Test: `tests/inflation-framework.test.mjs`

- [ ] **Step 1: Add the seven abstract nodes and four indicator nodes**

Add these nodes once to the node section of `macro.json`:

```json
{"data":{"id":"gdp-deflator","label":"GDP 平减指数","kind":"indicator"}},
{"data":{"id":"inflation-expectations","label":"通胀预期","kind":"indicator"}},
{"data":{"id":"phillips-curve","label":"菲利普斯曲线","kind":"indicator"}},
{"data":{"id":"price-transmission","label":"价格传导","kind":"indicator"}},
{"data":{"id":"economy-wide-price-level","label":"经济整体价格水平"}},
{"data":{"id":"price-setting","label":"价格设定"}},
{"data":{"id":"inflation-pressure","label":"通胀压力"}},
{"data":{"id":"inflation-slack-relationship","label":"通胀与经济松弛关系"}},
{"data":{"id":"downstream-price-pressure","label":"下游价格压力"}},
{"data":{"id":"upstream-downstream-price-pass-through","label":"上下游价格传导"}},
```

- [ ] **Step 2: Add exactly the seven approved relation triples**

Append these records to the relation section:

```json
{"data":{"source":"gdp-deflator","target":"economy-wide-price-level","type":"MEASURES"}},
{"data":{"source":"inflation-expectations","target":"price-setting","type":"AFFECTS"}},
{"data":{"source":"inflation-expectations","target":"real-interest-rate","type":"AFFECTS"}},
{"data":{"source":"output-gap","target":"inflation-pressure","type":"CORRELATES"}},
{"data":{"source":"phillips-curve","target":"inflation-slack-relationship","type":"REFLECTS"}},
{"data":{"source":"ppi","target":"downstream-price-pressure","type":"AFFECTS"}},
{"data":{"source":"price-transmission","target":"upstream-downstream-price-pass-through","type":"REFLECTS"}},
```

- [ ] **Step 3: Run the contract to verify graph data passes while concept assertions remain red**

Run: `node --import tsx --test tests/inflation-framework.test.mjs`

Expected: graph node/relation assertions pass; concept file and metadata assertions fail because Task 3 is not complete.

- [ ] **Step 4: Commit the graph data**

```bash
git add data/relations/macro.json
git commit -m "feat: add inflation framework graph nodes"
```

### Task 3: Add the four inflation concept pages and metadata

**Files:**
- Create: `src/content/concepts/gdp-deflator.md`
- Create: `src/content/concepts/inflation-expectations.md`
- Create: `src/content/concepts/phillips-curve.md`
- Create: `src/content/concepts/price-transmission.md`
- Test: `tests/inflation-framework.test.mjs`

- [ ] **Step 1: Add `gdp-deflator.md` with validated metadata and bounded explanation**

Use `country: CN`, `category: inflation`, `graph: macro`, `level: basic`, `topics: [prices-inflation,economic-activity]`, `prerequisites: [gdp,cpi]`, `featured: false`, `order: 4`, source `国家统计局国民经济核算`, and related IDs `[gdp,cpi,ppi]`. Explain the nominal/real GDP ratio, domestic production coverage, changing weights, current-price versus volume effects, revision, and why the GDP deflator is not CPI.

- [ ] **Step 2: Add `inflation-expectations.md` with validated metadata and uncertainty boundaries**

Use `country: CN`, `category: inflation`, `graph: macro`, `level: advanced`, `topics: [prices-inflation]`, `prerequisites: [cpi]`, `featured: false`, `order: 5`, source `中国人民银行与国际货币基金组织`, and related IDs `[cpi,core-cpi,real-interest-rate,phillips-curve]`. Explain survey expectations, market-implied measures, realized inflation, anchoring, horizon matching, risk premia, and why expectations are not directly observed or guaranteed forecasts.

- [ ] **Step 3: Add `phillips-curve.md` with non-causal interpretation**

Use `country: CN`, `category: inflation`, `graph: macro`, `level: advanced`, `topics: [prices-inflation,economic-activity]`, `prerequisites: [inflation-expectations,output-gap]`, `featured: false`, `order: 6`, source `经济学文献与国际货币基金组织`, and related IDs `[cpi,core-cpi,inflation-expectations,output-gap,unemployment-rate]`. Explain the empirical relationship between inflation dynamics and slack, expected inflation, supply shocks, changing coefficients, identification, and why it must not be presented as a stable causal law.

- [ ] **Step 4: Add `price-transmission.md` with conditional pass-through language**

Use `country: CN`, `category: inflation`, `graph: macro`, `level: advanced`, `topics: [prices-inflation]`, `prerequisites: [cpi,ppi]`, `featured: false`, `order: 7`, source `国家统计局价格统计与宏观经济学文献`, and related IDs `[ppi,cpi,core-cpi,exchange-rate,wages]`. Explain upstream/downstream prices, margins, demand, competition, imported inputs, exchange rates, inventories, contracts, lag, asymmetric pass-through, and why PPI increases do not guarantee CPI increases.

- [ ] **Step 5: Run focused tests to verify all four pages and metadata pass**

Run: `node --import tsx --test tests/inflation-framework.test.mjs`

Expected: all focused inflation contract tests pass.

- [ ] **Step 6: Commit the concept pages**

```bash
git add src/content/concepts/gdp-deflator.md src/content/concepts/inflation-expectations.md src/content/concepts/phillips-curve.md src/content/concepts/price-transmission.md
git commit -m "feat: add inflation framework concepts"
```

### Task 4: Verify integration and request review

**Files:**
- Test: `tests/inflation-framework.test.mjs`
- Verify: `src/pages/index.astro`, `src/pages/concepts/[id].astro`, `src/pages/topics/[id].astro`

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run Astro diagnostics**

Run: `npm run check`

Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 3: Build the static site**

Run: `npm run build`

Expected: build exits 0, creates `/concepts/gdp-deflator/`, `/concepts/inflation-expectations/`, `/concepts/phillips-curve/`, and `/concepts/price-transmission/`, and leaves homepage content unchanged.

- [ ] **Step 4: Review the diff and working tree**

Run: `git diff --check origin/main...HEAD`, `git status --short`, and `git diff --stat origin/main...HEAD`.

Expected: no whitespace errors, only scoped files changed, and no generated artifacts staged.

- [ ] **Step 5: Dispatch a code reviewer**

Review the complete branch against this plan, with special attention to metadata prerequisite direction, exact relation triples, non-causal wording, and homepage immutability. Resolve any important findings before pushing.

- [ ] **Step 6: Push and create the PR**

```bash
git push -u origin codex/inflation-framework
gh pr create --repo SwartzMss/MacroLens --base main --head codex/inflation-framework --title "feat: build inflation framework" --body "$(cat <<'EOF'
## Summary
- Add GDP deflator, inflation expectations, Phillips curve, and price transmission concepts.
- Connect the concepts through validated prerequisite metadata and cautious canonical graph relations.
- Keep the homepage curated and unchanged.

## Test plan
- [x] npm test
- [x] npm run check
- [x] npm run build
EOF
)"
```
