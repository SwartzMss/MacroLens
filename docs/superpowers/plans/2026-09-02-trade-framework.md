# Trade Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a five-page external-trade concept cluster that makes customs, BOP, valuation, price/volume, balance, and terms-of-trade boundaries explicit.

**Architecture:** Keep the five new concepts as external-sector Markdown content with stable IDs and metadata. Extend the existing external-sector content and relation regression contracts, and add only the smallest abstract graph nodes needed by the approved cautious relations; abstract nodes do not receive concept pages.

**Tech Stack:** Astro content collections, Markdown/YAML frontmatter, Cytoscape-style JSON graph data, Node.js `node:test`, TypeScript checks, Pagefind.

---

### Task 1: Lock the five concept contracts in tests

**Files:**
- Modify: `tests/external-sector-content.test.mjs`
- Modify: `tests/external-sector-relations.test.mjs`
- Test: `tests/external-sector-content.test.mjs`, `tests/external-sector-relations.test.mjs`

- [ ] **Step 1: Extend the approved metadata map**

Add entries for `exports`, `imports`, `trade-balance`, `trade-volume-and-price`, and `terms-of-trade` in `approvedMetadata`, with category `external`, graph `macro`, orders 6–10, `level: 'basic'`, `featured: false`, and prerequisites matching the approved learning DAG:

```js
'exports': { prerequisites: ['exchange-rate'], order: 6 },
'imports': { prerequisites: ['exchange-rate'], order: 7 },
'trade-balance': { prerequisites: ['exports', 'imports'], order: 8 },
'trade-volume-and-price': { prerequisites: ['exports', 'imports'], order: 9 },
 'terms-of-trade': { prerequisites: ['trade-volume-and-price'], order: 10 },
```

Use exact metadata values from each new page for `id`, `name`, `subtitle`, `country`, `source`, `definition`, `updatedAt`, `related`, and `graph`; add `current-account` as a related concept for `trade-balance` and `trade-volume-and-price`, and `exchange-rate` for `terms-of-trade`.

- [ ] **Step 2: Add failing content assertions**

Add one test per page through `assertConcept`. Require the following exact phrases so the regression contract protects the main accounting and measurement boundaries:

```js
assertConcept('exports', [
  '海关统计', '国际收支', '货物', '服务', '出口金额', '出口数量', '出口价格',
  '名义出口增长不等于实际或数量增长', '月度', '季节性', '基数效应', 'FOB',
], ['https://www.customs.gov.cn/', 'https://www.safe.gov.cn/', 'https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm']);

assertConcept('imports', [
  '海关统计', '国际收支', '货物', '服务', '进口金额', '进口数量', '进口价格',
  'CIF', '国内需求', '投入品', '月度', '季节性',
], ['https://www.customs.gov.cn/', 'https://www.safe.gov.cn/', 'https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm']);

assertConcept('trade-balance', [
  '出口减进口', '贸易差额', '货物贸易', '服务贸易', '经常账户', '双边贸易差额',
  '总体贸易差额', '不能直接等同', '月度', '季节性', '基数效应',
], ['https://www.customs.gov.cn/', 'https://www.safe.gov.cn/', 'https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm']);

assertConcept('trade-volume-and-price', [
  '金额', '数量', '价格', '名义', '实际', '数量指数', '价格指数',
  '出口价值增长', '出口数量增长', '进口', '基数效应', '季节性',
], ['https://www.stats.gov.cn/', 'https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm']);

assertConcept('terms-of-trade', [
  '出口价格指数', '进口价格指数', '贸易条件', '不是汇率', '相对价格',
  'FOB', 'CIF', '不能机械推出',
], ['https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm', 'https://www.wto.org/english/res_e/statis_e/daily_update_e/merch_methodology_e.pdf']);
```

Also add negative assertions that no page describes customs exports/imports as interchangeable with BOP current-account flows, and that `trade-balance` does not contain `贸易顺差等于经常账户顺差`.

- [ ] **Step 3: Add the relation contract before graph implementation**

Extend `expectedNodes` with these abstract nodes:

```js
['merchandise-trade', '货物贸易'],
['domestic-demand-and-input-demand', '国内需求与投入需求'],
['exports-and-imports', '出口与进口'],
['current-account-goods-balance', '经常账户货物差额'],
['export-import-relative-prices', '进出口相对价格'],
['trade-pricing-and-competitiveness', '贸易定价与竞争力'],
```

Also register the five new concept nodes as indicator nodes in the graph contract: `exports` / `出口`, `imports` / `进口`, `trade-balance` / `贸易差额`, `trade-volume-and-price` / `贸易数量与价格拆分`, and `terms-of-trade` / `贸易条件`.

Extend `expectedRelations` with exactly:

```js
['exports', 'economic-activity', 'AFFECTS'],
['imports', 'domestic-demand-and-input-demand', 'REFLECTS'],
['exports', 'merchandise-trade', 'COMPONENT_OF'],
['imports', 'merchandise-trade', 'COMPONENT_OF'],
['trade-balance', 'exports-and-imports', 'DERIVED_FROM'],
['trade-balance', 'current-account-goods-balance', 'OVERLAPS_WITH'],
['terms-of-trade', 'export-import-relative-prices', 'REFLECTS'],
['exchange-rate', 'trade-pricing-and-competitiveness', 'AFFECTS'],
```

Add all six abstract IDs to the no-concept-page assertion. Keep the existing uniqueness, target-resolution, canonical-type, and no-`CAUSES` assertions.

- [ ] **Step 4: Run the focused tests and verify RED**

Run:

```bash
node --import tsx --test tests/external-sector-content.test.mjs tests/external-sector-relations.test.mjs
```

Expected: failures for missing concept files, metadata, and graph nodes/relations; no test-loader or syntax error.

### Task 2: Add the five concept pages

**Files:**
- Create: `src/content/concepts/exports.md`
- Create: `src/content/concepts/imports.md`
- Create: `src/content/concepts/trade-balance.md`
- Create: `src/content/concepts/trade-volume-and-price.md`
- Create: `src/content/concepts/terms-of-trade.md`

- [ ] **Step 1: Add frontmatter matching the approved metadata**

Each page must use `country: CN`, `category: external`, `graph: macro`, `level: basic`, `featured: false`, `updatedAt: 2026-09-02`, and a stable `order` from 6 to 10. Include only existing concept IDs in `related` and use the exact prerequisite arrays from Task 1.

- [ ] **Step 2: Write the exports and imports pages around source boundaries**

For `exports.md` and `imports.md`, define the customs merchandise flow first, then explain that BOP records resident/non-resident economic transactions and includes services. Distinguish value, volume, and price. Explain FOB/CIF as valuation conventions where relevant, and state that monthly series require checking seasonality, base effects, revisions, and calendar effects. Explicitly state that customs values must not be silently relabeled as BOP current-account flows.

- [ ] **Step 3: Write the trade-balance page around accounting boundaries**

Define the balance as exports minus imports only after naming the scope (goods, services, customs, or BOP). Contrast bilateral and aggregate balances. Explain why a customs merchandise surplus is not automatically a current-account surplus because services, primary income, and secondary income also enter the current account. Include monthly volatility, seasonal adjustment, base effects, and valuation/source differences.

- [ ] **Step 4: Write the quantity-price decomposition page**

Explain that nominal trade value combines price and quantity changes, and that an index or deflator is required to interpret real/volume growth. Use examples such as positive export-value growth with flat or falling volume. Explain that export and import volume/price indices may use different baskets, base periods, weights, and revisions, so comparisons need metadata.

- [ ] **Step 5: Write the terms-of-trade page**

Define terms of trade as an export-price index relative to an import-price index, with the direction and base period stated. Contrast it with bilateral, nominal, real, and effective exchange rates. Explain that improving terms of trade can coexist with currency depreciation and does not mechanically determine export volume, trade balance, or welfare. Include FOB/CIF comparability and price-basket caveats.

- [ ] **Step 6: Run the focused tests and verify GREEN**

Run:

```bash
node --import tsx --test tests/external-sector-content.test.mjs tests/external-sector-relations.test.mjs
```

Expected: content tests pass for all five pages; relation tests still fail only because graph nodes and relations have not yet been added.

### Task 3: Add abstract graph nodes and cautious relations

**Files:**
- Modify: `data/relations/macro.json`
- Test: `tests/external-sector-relations.test.mjs`

- [ ] **Step 1: Add six abstract nodes**

Add the five indicator nodes and six abstract nodes from Task 1 to the node section of `data/relations/macro.json`. The five concept nodes use `kind: "indicator"`; the six abstract nodes have no `kind` property and do not receive concept pages.

- [ ] **Step 2: Add the eight approved relation triples**

Add the exact eight `expectedRelations` triples from Task 1 to the relation section. Do not add reverse duplicates or any `CAUSES` relation. Keep existing external-sector relations unchanged.

- [ ] **Step 3: Run relation tests and verify GREEN**

Run:

```bash
node --import tsx tests/external-sector-relations.test.mjs
```

Expected: all external-sector relation assertions pass, including unique triples, resolved endpoints, abstract-node checks, and no deterministic causes.

### Task 4: Verify the full site and prepare the PR

**Files:**
- Modify only the five concept pages, `data/relations/macro.json`, and the two external-sector test files from Tasks 1–3.

- [ ] **Step 1: Run the full test suite**

Run `npm test`. Expected: exit code 0 and all tests pass.

- [ ] **Step 2: Run Astro validation**

Run `npm run check`. Expected: 0 errors, 0 warnings, and 0 hints.

- [ ] **Step 3: Build and index the site**

Run `npm run build`. Expected: Astro build exits 0 and Pagefind indexes the generated site.

- [ ] **Step 4: Check the diff and working tree**

Run `git diff --check` and `git status --short`. Expected: no whitespace errors and only Issue #44 files plus the already committed design/plan documents are present.

- [ ] **Step 5: Commit the implementation**

```bash
git add src/content/concepts/exports.md src/content/concepts/imports.md src/content/concepts/trade-balance.md src/content/concepts/trade-volume-and-price.md src/content/concepts/terms-of-trade.md data/relations/macro.json tests/external-sector-content.test.mjs tests/external-sector-relations.test.mjs
git commit -m "feat: add external trade framework"
```

- [ ] **Step 6: Push and create PR #44 implementation**

```bash
git push -u origin codex/issue-44-trade-framework
gh pr create --base main --head codex/issue-44-trade-framework --title "feat: add external trade framework" --body-file /tmp/issue-44-pr-body.md
```

The PR body must link Issue #44, list the five concepts and accounting/measurement boundaries covered, and report the exact local verification results. After creation, run `gh pr view` and `gh pr checks` and report the remote status without merging.
