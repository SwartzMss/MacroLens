# Business-Cycle Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five source-grounded business-cycle concepts to the existing `growth` category and connect them through five non-deterministic graph relationships without adding charts.

**Architecture:** Author five Markdown collection entries using stable IDs and existing content-page rendering. Add focused Node contracts for exact metadata, methodology boundaries, related links, and graph direction before Astro performs full schema, route, relationship-card, and Pagefind integration validation.

**Tech Stack:** Astro 5, TypeScript, Markdown content collections, JSON relationship data, Node 20 test runner, `tsx`, Pagefind.

---

## File Map

- Create `tests/business-cycle-content.test.mjs`: stable metadata, no-chart, related-ID, source, and semantic contracts.
- Create `src/content/concepts/output-gap.md`: actual versus potential output and estimation uncertainty.
- Create `src/content/concepts/inventory-cycle.md`: inventory stock, growth, accumulation, GDP contribution, and conditional cycle narrative.
- Create `src/content/concepts/capacity-utilization.md`: NBS industrial coverage, survey method, quarterly frequency, and interpretation.
- Create `src/content/concepts/industrial-profits.md`: above-designated-size scope and cumulative/comparable semantics.
- Create `src/content/concepts/leading-indicators.md`: empirical leading role without homemade composites or guaranteed forecasts.
- Create `tests/business-cycle-relations.test.mjs`: exact graph nodes, abstract nodes, directions, and no-`CAUSES` contract.
- Modify `data/relations/macro.json`: add eight nodes and five relationships.

### Task 1: Establish the Content Contract and Add Output Gap

**Files:**
- Create: `tests/business-cycle-content.test.mjs`
- Create: `src/content/concepts/output-gap.md`

- [ ] **Step 1: Create shared test helpers and exact output-gap metadata**

Use the parser pattern from `tests/market-rates-content.test.mjs` and define:

```js
const approvedMetadata = {
  'output-gap': { id: 'output-gap', name: '产出缺口', subtitle: '实际产出相对潜在产出的估计偏离，不是直接观测的官方 GDP 指标', country: 'CN', category: 'growth', source: '国际货币基金组织与国家统计局', definition: { source: 'IMF output-gap methodology and NBS GDP', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['gdp', 'capacity-utilization', 'unemployment-rate', 'cpi'], graph: 'macro', order: 6 },
};

function assertConcept(id, terms, sourceUrls) {
  const document = readConcept(id);
  assert.deepEqual(parseFrontmatter(document), approvedMetadata[id]);
  assert.doesNotMatch(document, /^chart:/m);
  for (const term of terms) assert.ok(document.includes(term), `${id} must explain ${term}`);
  for (const url of sourceUrls) assert.ok(document.includes(url), `${id} must cite ${url}`);
}

test('output gap remains an estimated and revisable measure of slack', () => {
  assertConcept('output-gap', [
    '实际产出', '潜在产出', '无法直接观测', '估计', '占潜在产出的比重',
    '统计滤波', '生产函数', '多变量模型', '实时估计', '修订', '官方GDP',
    '不能据此创建一条中国官方产出缺口序列',
  ], [
    'https://www.imf.org/external/Pubs/FT/fandd/basics/pdf/jahan_output.pdf',
    'https://www.stats.gov.cn/sj/zxfb/',
  ]);
});
```

- [ ] **Step 2: Run RED**

Run `node --import tsx tests/business-cycle-content.test.mjs`.

Expected: FAIL because `output-gap.md` is missing.

- [ ] **Step 3: Author `output-gap.md`**

Use the exact approved metadata. Define the percentage gap as `(actual − potential) / potential`; explain positive, negative, and zero readings; separate NBS actual GDP from model estimates; cover HP/statistical filters, production functions, multivariate approaches, endpoint uncertainty and revisions; state that no official China output-gap chart is being created.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --import tsx tests/business-cycle-content.test.mjs
git add tests/business-cycle-content.test.mjs src/content/concepts/output-gap.md
git commit -m "feat: explain estimated output gaps"
```

### Task 2: Add Inventory Cycle

**Files:**
- Modify: `tests/business-cycle-content.test.mjs`
- Create: `src/content/concepts/inventory-cycle.md`

- [ ] **Step 1: Add metadata and failing contract**

```js
'inventory-cycle': { id: 'inventory-cycle', name: '库存周期', subtitle: '企业库存存量、变化与需求生产调整形成的条件性周期叙事', country: 'CN', category: 'growth', source: '国家统计局', definition: { source: '国家统计局工业企业财务与国民经济核算口径', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['industrial-production', 'industrial-profits', 'pmi', 'gdp'], graph: 'macro', order: 7 },
```

```js
test('inventory cycle separates stocks, growth, accumulation, and GDP contribution', () => {
  assertConcept('inventory-cycle', [
    '存货存量', '产成品存货', '同比增速', '补库存', '去库存', '存货变动',
    'GDP增长贡献', '并不等价', '主动补库存', '被动补库存', '主动去库存',
    '被动去库存', '不是固定时钟', '价格变化',
  ], [
    'https://www.stats.gov.cn/sj/pcsj/jjpc/1jp/html/indicator2.htm',
    'https://www.stats.gov.cn/sj/zxfb/202601/t20260127_1962382.html',
  ]);
});
```

- [ ] **Step 2: Run RED**

Expected: inventory-cycle page missing.

- [ ] **Step 3: Author `inventory-cycle.md`**

Use exact metadata. Distinguish balance-sheet stock from growth rate and accumulation flow; explain that GDP records changes in inventories and growth contribution depends on changes in that flow; separate total inventory from finished goods; describe the four common demand/inventory narratives conditionally; include price valuation and survey-scope cautions.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --import tsx tests/business-cycle-content.test.mjs
git add tests/business-cycle-content.test.mjs src/content/concepts/inventory-cycle.md
git commit -m "feat: explain inventory cycle semantics"
```

### Task 3: Add Capacity Utilization

**Files:**
- Modify: `tests/business-cycle-content.test.mjs`
- Create: `src/content/concepts/capacity-utilization.md`

- [ ] **Step 1: Add metadata and failing contract**

```js
'capacity-utilization': { id: 'capacity-utilization', name: '工业产能利用率', subtitle: '规模以上工业实际产出相对可持续生产能力的季度调查指标', country: 'CN', category: 'growth', source: '国家统计局', definition: { source: '国家统计局工业产能利用率调查', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['industrial-production', 'output-gap', 'industrial-profits', 'ppi'], graph: 'macro', order: 8 },
```

```js
test('capacity utilization preserves official scope and conditional interpretation', () => {
  assertConcept('capacity-utilization', [
    '实际产出', '生产能力', '价值量', '规模以上工业企业', '大中型企业全面调查',
    '小微企业抽样调查', '按季', '未经季节调整', '行业', '季节性',
    '不自动等于经济过热',
  ], [
    'https://www.stats.gov.cn/zs/tjws/tjzb/202301/t20230101_1903791.html',
    'https://www.stats.gov.cn/sj/zxfb/202501/t20250117_1958324.html',
  ]);
});
```

- [ ] **Step 2: Run RED**

Expected: capacity-utilization page missing.

- [ ] **Step 3: Author `capacity-utilization.md`**

Use exact metadata and include the official ratio, production-capacity definition, value measurement, enterprise survey split, quarterly/non-seasonally-adjusted status, sector differences, structural capacity changes, and why high utilization is not sufficient evidence of economy-wide overheating.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --import tsx tests/business-cycle-content.test.mjs
git add tests/business-cycle-content.test.mjs src/content/concepts/capacity-utilization.md
git commit -m "feat: explain industrial capacity utilization"
```

### Task 4: Add Industrial Profits

**Files:**
- Modify: `tests/business-cycle-content.test.mjs`
- Create: `src/content/concepts/industrial-profits.md`

- [ ] **Step 1: Add metadata and failing contract**

```js
'industrial-profits': { id: 'industrial-profits', name: '规模以上工业企业利润', subtitle: '观察规上工业企业累计利润、收入与利润率，必须保持可比口径', country: 'CN', category: 'growth', source: '国家统计局', definition: { source: '国家统计局工业企业财务状况统计', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['industrial-production', 'inventory-cycle', 'capacity-utilization', 'ppi'], graph: 'macro', order: 9 },
```

```js
test('industrial profits explains cumulative, monthly-derived, and comparable semantics', () => {
  assertConcept('industrial-profits', [
    '2000万元及以上', '工业法人单位', '利润总额', '营业收入', '营业收入利润率',
    '累计值', '1月份数据免报', '可比口径', '不能直接相比计算增速',
    '相邻累计值相减', '推算值', '上年同期累计差额', '基数效应', '由亏转盈',
  ], [
    'https://www.stats.gov.cn/sj/zxfb/202501/t20250127_1958485.html',
    'https://www.stats.gov.cn/sj/zxfb/202601/t20260127_1962382.html',
  ]);
});
```

- [ ] **Step 2: Run RED**

Expected: industrial-profits page missing.

- [ ] **Step 3: Author `industrial-profits.md`**

Use exact metadata. Explain population threshold, cumulative total and growth, revenue/cost/margin distinctions, comparable-population adjustment, January omission, derived monthly amount and matched prior-year difference, base effects, loss/profit transitions, and why production growth need not imply profit growth.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --import tsx tests/business-cycle-content.test.mjs
git add tests/business-cycle-content.test.mjs src/content/concepts/industrial-profits.md
git commit -m "feat: explain industrial profit releases"
```

### Task 5: Add Leading Indicators and Related-Link Validation

**Files:**
- Modify: `tests/business-cycle-content.test.mjs`
- Create: `src/content/concepts/leading-indicators.md`

- [ ] **Step 1: Add metadata and contracts**

```js
'leading-indicators': { id: 'leading-indicators', name: '领先指标', subtitle: '相对特定经济活动和预测期具有经验领先性的信号角色，不是一条通用序列', country: 'CN', category: 'growth', source: '国家统计局与中国人民银行', definition: { source: '官方指标方法与条件性领先关系', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['pmi', 'credit', 'social-financing', 'yield-curve', 'industrial-production'], graph: 'macro', order: 10 },
```

```js
test('leading indicators are scoped signals rather than guaranteed forecasts', () => {
  assertConcept('leading-indicators', [
    '经验角色', '预测目标', '领先期', '历史样本', 'PMI新订单', '扩散指数',
    '信用脉冲', '推导指标', '市场变量', '不保证', '样本外失效',
    '不创建自制综合领先指标',
  ], [
    'https://www.stats.gov.cn/zs/tjws/tjzb/202301/t20230101_1903736.html',
    'https://www.pbc.gov.cn/diaochatongjisi/116219/index.html',
  ]);
});

test('all business-cycle related IDs resolve to stable concept pages', () => {
  const conceptIds = new Set(readdirSync(conceptDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => parseFrontmatter(readFileSync(`${conceptDirectory}/${entry.name}`, 'utf8')).id));
  for (const metadata of Object.values(approvedMetadata)) {
    for (const relatedId of metadata.related) assert.ok(conceptIds.has(relatedId), `${metadata.id} related ID ${relatedId} must resolve`);
  }
});
```

- [ ] **Step 2: Run RED**

Expected: leading-indicators page missing and related-ID validation identifies the missing stable ID.

- [ ] **Step 3: Author `leading-indicators.md`**

Use exact metadata. Define target/horizon/sample requirements; distinguish PMI diffusion indexes, credit growth and explicitly constructed credit impulse, and market pricing; discuss false signals, revisions and regime changes; prohibit a homemade composite and guaranteed forecasts.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --import tsx tests/business-cycle-content.test.mjs
git add tests/business-cycle-content.test.mjs src/content/concepts/leading-indicators.md
git commit -m "feat: explain scoped leading indicators"
```

### Task 6: Add Canonical Graph Relationships

**Files:**
- Create: `tests/business-cycle-relations.test.mjs`
- Modify: `data/relations/macro.json`

- [ ] **Step 1: Write the failing graph contract**

Use the existing graph-test parser and define:

```js
const expectedNodes = new Map([
  ['output-gap', '产出缺口'],
  ['inventory-cycle', '库存周期'],
  ['capacity-utilization', '工业产能利用率'],
  ['industrial-profits', '规模以上工业企业利润'],
  ['leading-indicators', '领先指标'],
  ['economic-slack', '经济闲置程度'],
  ['corporate-operating-conditions', '企业经营状况'],
  ['future-activity-signals', '未来经济活动信号'],
]);

const expectedRelations = [
  ['output-gap', 'economic-slack', 'REFLECTS'],
  ['capacity-utilization', 'industrial-activity', 'REFLECTS'],
  ['industrial-profits', 'corporate-operating-conditions', 'REFLECTS'],
  ['inventory-cycle', 'industrial-activity', 'AFFECTS'],
  ['leading-indicators', 'future-activity-signals', 'REFLECTS'],
];
```

Assert node and triple uniqueness, exact labels, valid endpoints/types, no `kind` and no Markdown page for the three abstract nodes, exact cluster relations, and no `CAUSES` involving any expected node.

- [ ] **Step 2: Run RED**

Run `node --import tsx tests/business-cycle-relations.test.mjs`.

Expected: missing-node assertions fail.

- [ ] **Step 3: Add eight nodes and five exact relations**

Place nodes before the first relationship in `data/relations/macro.json`; append the five relations without reverse duplicates or additional causal edges.

- [ ] **Step 4: Verify and commit**

```bash
node --import tsx tests/business-cycle-relations.test.mjs
npm test
git add tests/business-cycle-relations.test.mjs data/relations/macro.json
git commit -m "feat: connect business cycle concepts"
```

Expected: focused graph test and full unit suite pass.

### Task 7: Full Verification, Review, and PR

**Files:** all files changed since `origin/main`.

- [ ] **Step 1: Run explicit Node 20 contracts**

```bash
npx --yes --package node@20 node --version
npx --yes --package node@20 node --import tsx --test tests/*.test.mjs
```

Expected: Node `v20.x`; zero failed tests.

- [ ] **Step 2: Run Astro validation and production build**

```bash
npm run check
npm run build
```

Expected: zero Astro diagnostics; five new routes generated; Pagefind includes the new pages.

- [ ] **Step 3: Check scope and hygiene**

```bash
git diff --check origin/main..HEAD
git status --short
git diff --stat origin/main..HEAD
```

Expected: clean worktree and no whitespace errors; changes limited to spec, plan, five pages, graph, and two tests.

- [ ] **Step 4: Request independent review**

Give the reviewer issue #26, the design, base/head SHAs, and ask specifically about output-gap observability, inventory/GDP accounting, NBS capacity scope, cumulative industrial-profit semantics, leading-indicator claims, graph direction, sources, and tests. Resolve all Critical and Important findings and repeat Steps 1–3.

- [ ] **Step 5: Push and create the PR**

```bash
git push -u origin codex/issue-26-business-cycle
gh pr create --base main --head codex/issue-26-business-cycle --title "Build business-cycle foundation" --body $'## Summary\n\n- add five business-cycle concepts under growth\n- separate observed data, estimated slack, inventory accounting, and conditional leading signals\n- add non-deterministic graph relationships and Node 20 contracts without charts\n\n## Verification\n\n- explicit Node 20 test suite\n- npm run check\n- npm run build\n- git diff --check origin/main..HEAD\n\nCloses #26'
```

Expected: open, mergeable PR linked to issue #26; preserve the worktree for review feedback.
