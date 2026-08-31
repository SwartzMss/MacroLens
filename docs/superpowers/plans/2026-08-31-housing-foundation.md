# Housing Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the China housing macro category, five boundary-focused concepts, and six non-deterministic macro-graph relations for Issue #27.

**Architecture:** Follow the existing Markdown concept schema and single `data/relations/macro.json` graph. Add contract tests before production changes so metadata, source links, scope language, node kinds, and relation direction are enforced without adding charts.

**Tech Stack:** Astro content collections, TypeScript category registry, JSON graph data, Node 20 test runner with `tsx`, npm check/build.

---

### Task 1: Add housing contract tests

**Files:**
- Create: `tests/housing-content.test.mjs`
- Create: `tests/housing-relations.test.mjs`

- [ ] **Step 1: Write failing content tests**

  Assert `housing` exists with label `房地产`; each of the five IDs has exact frontmatter (`category: housing`, `graph: macro`, no `chart`, ordered 1–5), valid related IDs, primary source URLs, and required boundary phrases: cumulative/monthly investment; area/value/implied price/contract sales and primary versus secondary housing; 70-city scope and MoM/YoY/new versus second-hand; mortgage rate/LPR/stock/new lending/repayment; land conveyance/transaction value/transfer revenue and government-fund versus general public budget. Run `node --import tsx tests/housing-content.test.mjs`; expect missing-page/category failures.

- [ ] **Step 2: Write failing relation tests**

  Parse `data/relations/macro.json`; assert unique IDs/triples, indicator nodes for the five pages, abstract nodes `housing-market-prices` and `fiscal-conditions` without concept pages, and exactly these six triples: mortgage→property-sales AFFECTS; property-sales→real-estate-investment AFFECTS; house-price-index→housing-market-prices REFLECTS; real-estate-investment→investment-activity COMPONENT_OF; land-market→fiscal-conditions AFFECTS; property-sales→economic-activity AFFECTS. Assert no housing-cluster `CAUSES`. Run `node --import tsx tests/housing-relations.test.mjs`; expect missing-node/relation failures.

- [ ] **Step 3: Commit tests**

  `git add tests/housing-content.test.mjs tests/housing-relations.test.mjs && git commit -m "test: define housing macro contracts"`

### Task 2: Register category and write five concept pages

**Files:**
- Modify: `src/data/categories.ts`
- Create: `src/content/concepts/real-estate-investment.md`
- Create: `src/content/concepts/property-sales.md`
- Create: `src/content/concepts/house-price-index.md`
- Create: `src/content/concepts/mortgage.md`
- Create: `src/content/concepts/land-market.md`

- [ ] **Step 1: Add the category**

  Add `'housing'` to `categoryIds` and add `{ label: '房地产', description: '理解住房价格、交易、融资、建设与土地财政的不同统计口径。', order: 45 }` between growth and fiscal.

- [ ] **Step 2: Add investment and sales pages**

  Use stable metadata and `updatedAt: 2026-08-31`; cite NBS release/methodology URLs. Explain investment’s above-designated-size development scope, cumulative headline and adjacent-cumulative monthly derivation, nominal valuation versus physical construction. Explain sales area, value, implied average price, contract sales, cumulative/base effects, and exclude secondary-market transactions from new-home series.

- [ ] **Step 3: Add price and mortgage pages**

  Cite NBS 70-city releases and PBOC mortgage/LPR sources. Explain 70-city index coverage, MoM/YoY, new/second-hand separation, city aggregation limits, mortgage pricing versus LPR, outstanding stock versus new lending and repayment, and household-loan denominator differences.

- [ ] **Step 4: Add land page**

  Cite Ministry of Finance and Ministry of Natural Resources sources. Separate land conveyance/transaction value, land-transfer revenue, real-estate investment, and government-fund budget; explicitly state land-transfer revenue is not general public budget revenue and relate it to `fiscal-revenue`.

- [ ] **Step 5: Run content tests and commit**

  Run `node --import tsx tests/housing-content.test.mjs`; expect all content tests to pass. Then run `npm run check` and commit: `git add src/data/categories.ts src/content/concepts/*.md && git commit -m "feat: add housing macro concepts"`.

### Task 3: Add graph nodes and approved relations

**Files:**
- Modify: `data/relations/macro.json`

- [ ] **Step 1: Register nodes**

  Add five indicator nodes labeled exactly as their concept pages and abstract nodes `housing-market-prices` (`住房市场价格`) and `fiscal-conditions` (`财政条件`) without `kind`.

- [ ] **Step 2: Register relations**

  Add only the six approved triples from Task 1, preserving existing JSON ordering and avoiding reverse duplicates or new `CAUSES` edges.

- [ ] **Step 3: Run relation/full tests and commit**

  Run `node --import tsx tests/housing-relations.test.mjs` and `npm test`; expect all tests to pass. Commit with `git add data/relations/macro.json && git commit -m "feat: connect housing macro relations"`.

### Task 4: Verify, review, and create PR

**Files:**
- Verify only; no additional production files expected.

- [ ] **Step 1: Run complete verification**

  Run `npx --yes --package node@20 node --version && npx --yes --package node@20 node --import tsx --test tests/*.test.mjs`, `npm run check`, `npm run build`, and `git diff --check origin/main...HEAD`. Confirm zero test failures/diagnostics and all five routes generated.

- [ ] **Step 2: Request independent review**

  Review the diff against Issue #27 and this spec. Fix Critical/Important findings with a focused regression test and rerun verification; record Minor follow-ups in the PR if needed.

- [ ] **Step 3: Push and open PR**

  Push `codex/issue-27-housing`, create a PR titled `Build housing foundation concepts`, summarize the five pages, category, graph relations, and verification evidence, and include `Closes #27`. Preserve the worktree for review iteration.
