# Household Sector Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five household-sector concepts, a dedicated browsing topic, a valid prerequisite DAG, and cautious graph relations distinguishing income, consumption, saving, deposits, and retail sales.

**Architecture:** Extend the existing Astro Markdown collection and topic registry. Add a `household-sector` topic in the `growth` category at order 55. New pages use frontmatter prerequisites for learning order; graph indicators point to abstract measurement/behavior nodes, with conditional `AFFECTS` edges and no new `CAUSES` edge. The homepage remains unchanged.

**Tech Stack:** Astro, TypeScript, Markdown, JSON, Node test runner with `tsx`, Pagefind.

---

### Task 1: Add the topic and failing content contract

**Files:** Create `tests/household-sector-content.test.mjs`; modify `tests/information-architecture.test.mjs` and `src/data/topics.ts`.

- [ ] **Step 1: Write the failing test.**

Create a test using the existing frontmatter parsing pattern. It must require these exact metadata values:

```js
const expected = {
  'disposable-income': { name: '居民人均可支配收入', category: 'growth', topics: ['household-sector', 'labor-market', 'economic-activity'], prerequisites: ['wages'], order: 11 },
  'income-expectations': { name: '收入预期', category: 'growth', topics: ['household-sector', 'labor-market', 'economic-activity'], prerequisites: ['wages'], order: 12 },
  'household-consumption': { name: '居民消费支出', category: 'growth', topics: ['household-sector', 'economic-activity'], prerequisites: ['disposable-income', 'income-expectations'], order: 13 },
  'household-saving-rate': { name: '居民储蓄率', category: 'growth', topics: ['household-sector', 'economic-activity', 'market-rates'], prerequisites: ['disposable-income', 'household-consumption'], order: 14 },
  'propensity-to-consume': { name: '消费倾向', category: 'growth', topics: ['household-sector', 'economic-activity'], prerequisites: ['household-consumption'], order: 15 },
};
```

Require every page to have `country: CN`, `graph: macro`, `level`, `featured: false`, non-empty `source` and `definition`, no `chart`, resolvable `related` IDs, and no new ID in `src/pages/index.astro`. Require these terms:

```js
const terms = {
  'disposable-income': ['工资性收入', '经营净收入', '财产净收入', '转移净收入', '工资与劳动报酬', '国民经济核算', '名义', '实际', '人均', '总量'],
  'income-expectations': ['收入预期', '调查', '期限', '分布', '实现收入', '消费', '不等于', '不保证'],
  'household-consumption': ['居民人均消费支出', '居民消费支出', '社会消费品零售总额', '不等于', '服务', '名义', '实际', '人均', '总量'],
  'household-saving-rate': ['住户部门总储蓄', '可支配收入', '居民消费支出', '居民储蓄', '居民存款余额', '流量', '金融资产', '财富'],
  'propensity-to-consume': ['平均消费倾向', '边际消费倾向', '消费水平', '可支配收入', '名义', '实际', '人均', '总量'],
};
```

Require NBS URLs `https://www.stats.gov.cn/zs/tjws/tjzb/202301/t20230101_1903384.html`, `https://www.stats.gov.cn/zs/tjws/zytjzbqs/jmrj/202501/t20250121_1958392.html`, `https://www.stats.gov.cn/hd/cjwtjd/202302/t20230207_1902278.html`, and `https://www.stats.gov.cn/sj/zxfb/202601/t20260119_1962321.html`; PBOC URL `https://www.pbc.gov.cn/diaochatongjisi/fileDir/resource/cms/2025/03/2025032117142239782.pdf`; and OECD URL `https://www.oecd.org/en/data/indicators/household-savings-forecast.html` in the applicable pages.

Extend the IA test to require one `household-sector` topic with label `居民部门`, category `growth`, order `55`, and a non-empty description.

- [ ] **Step 2: Run the test and verify red.** Run `node --import tsx tests/household-sector-content.test.mjs` and `node --import tsx tests/information-architecture.test.mjs`. Expected: missing page/topic failures.

- [ ] **Step 3: Register the topic.** Add `household-sector` after `economic-activity` in `topicIds`, and add `{ label: '居民部门', description: '理解劳动收入、可支配收入、消费、储蓄与预期之间的统计边界和传导关系。', category: 'growth', order: 55 }` to `topics`.

- [ ] **Step 4: Run `node --import tsx tests/information-architecture.test.mjs`.** Expected: topic checks pass while page checks remain red.

- [ ] **Step 5: Commit.** Run `git add src/data/topics.ts tests/information-architecture.test.mjs tests/household-sector-content.test.mjs && git commit -m "test: define household sector content contracts"`.

### Task 2: Add the five concept pages

**Files:** Create `src/content/concepts/disposable-income.md`, `income-expectations.md`, `household-consumption.md`, `household-saving-rate.md`, and `propensity-to-consume.md`.

- [ ] **Step 1: Confirm the page test is red.** Run `node --import tsx tests/household-sector-content.test.mjs`; all five existence checks should fail.

- [ ] **Step 2: Add each page with the exact metadata from Task 1.** Use `updatedAt: 2026-09-02`, `graph: macro`, `featured: false`, and no `chart`.

  - `disposable-income`: define NBS household-survey per-capita disposable income and its wage, net operating, property, and transfer components; distinguish wages/labor compensation, survey income, and national-accounts household income; cover nominal/real and per-capita/aggregate.
  - `income-expectations`: define forward-looking household beliefs rather than realized income or a guaranteed forecast; cover survey population, horizon, question form, distribution, revisions, and conditional consumption effects.
  - `household-consumption`: define resident per-capita consumption expenditure; explicitly state `社会消费品零售总额 ≠ 居民消费支出`; explain goods/services, in-kind and imputed consumption, resident/domestic coverage, nominal/real, and per-capita/aggregate.
  - `household-saving-rate`: state `住户部门总储蓄 = 住户部门可支配收入 − 居民消费支出`; distinguish `居民储蓄 ≠ 居民存款余额`, saving flows, deposit stocks, financial assets, and wealth; explain denominator and nominal/real limits.
  - `propensity-to-consume`: define average propensity as `C / disposable income` and marginal propensity as `ΔC / ΔY`; distinguish level, ratio, and incremental response, including nominal/real and per-capita/aggregate choices.

- [ ] **Step 3: Add the source links required by the content contract.** Use the NBS, PBOC, and OECD URLs named in Task 1 on the relevant pages.

- [ ] **Step 4: Run `node --import tsx tests/household-sector-content.test.mjs`.** Expected: all page metadata, terms, sources, prerequisites, related IDs, and homepage-scope assertions pass.

- [ ] **Step 5: Commit.** Run `git add src/content/concepts tests/household-sector-content.test.mjs && git commit -m "feat: add household income consumption and saving concepts"`.

### Task 3: Add graph nodes and relations with a regression contract

**Files:** Create `tests/household-sector-relations.test.mjs`; modify `data/relations/macro.json`.

- [ ] **Step 1: Write the failing graph test.** Require indicator nodes `disposable-income` / `居民人均可支配收入`, `income-expectations` / `收入预期`, `household-consumption` / `居民消费支出`, `household-saving-rate` / `居民储蓄率`, and `propensity-to-consume` / `消费倾向`. Require abstract nodes `household-income-conditions` / `居民收入条件`, `household-consumption-behavior` / `居民消费行为`, `household-saving-behavior` / `居民储蓄行为`, and `saving-consumption-choice` / `储蓄与消费选择`.

Require these exact relations:

```js
const expected = [
  ['wages', 'household-income-conditions', 'AFFECTS'],
  ['employment', 'household-income-conditions', 'AFFECTS'],
  ['disposable-income', 'household-income-conditions', 'REFLECTS'],
  ['disposable-income', 'household-consumption', 'AFFECTS'],
  ['income-expectations', 'household-consumption', 'AFFECTS'],
  ['household-consumption', 'household-consumption-behavior', 'REFLECTS'],
  ['propensity-to-consume', 'household-consumption-behavior', 'REFLECTS'],
  ['household-consumption', 'economic-activity', 'COMPONENT_OF'],
  ['real-interest-rate', 'saving-consumption-choice', 'AFFECTS'],
  ['household-saving-rate', 'household-saving-behavior', 'REFLECTS'],
];
```

Also require existing `retail-sales → consumption-activity (REFLECTS)`, forbid `retail-sales → household-consumption`, reject duplicate nodes/triples, validate endpoints/types, and reject `CAUSES` in the household cluster.

- [ ] **Step 2: Run `node --import tsx tests/household-sector-relations.test.mjs` and verify red.** Expected: missing node/relation failures.

- [ ] **Step 3: Add the five indicator nodes, four abstract nodes, and exactly the ten relations above.** Preserve all existing graph data, especially the retail-sales relation.

- [ ] **Step 4: Run the graph test and verify green.**

- [ ] **Step 5: Commit.** Run `git add data/relations/macro.json tests/household-sector-relations.test.mjs && git commit -m "feat: connect household sector in macro graph"`.

### Task 4: Validate the complete change

- [ ] **Step 1:** Run `npm test`; expect zero failures, including catalog prerequisite/DAG validation.
- [ ] **Step 2:** Run `npm run check`; expect 0 errors, 0 warnings, 0 hints.
- [ ] **Step 3:** Run `npm run build`; expect all static routes and Pagefind index generation to complete.
- [ ] **Step 4:** Run `git diff --check`, `git status --short`, `git diff --stat 883e764...HEAD`, and `git diff -- src/pages/index.astro`; expect no whitespace errors, only intended household files, and an empty homepage diff.
- [ ] **Step 5:** Commit any final test-only adjustment with `git add tests src/data/topics.ts data/relations/macro.json && git commit -m "test: validate household sector integration"`; skip if clean.

### Task 5: Push and open the PR

- [ ] **Step 1:** Confirm `git branch --show-current` is `codex/issue-41-household` and `git status --short` is empty.
- [ ] **Step 2:** Run `git push -u origin codex/issue-41-household`.
- [ ] **Step 3:** Run `gh pr create --repo SwartzMss/MacroLens --base main --head codex/issue-41-household` with title `feat: add household income consumption and saving framework`, a summary of the five pages/topic/graph/statistical boundaries, validation commands, and `Closes #41`.
- [ ] **Step 4:** Run `gh pr view --repo SwartzMss/MacroLens --json number,title,url,headRefName,baseRefName,state` and confirm the new PR targets `main` and closes Issue #41.
