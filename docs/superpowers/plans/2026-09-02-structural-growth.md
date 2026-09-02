# Structural Growth Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structural-growth topic covering productivity, TFP, demographics, labor supply, and potential output while preserving the distinction between observed indicators and model-dependent estimates.

**Architecture:** Add five Markdown concept pages and one topic registry entry, extending existing prerequisite metadata rather than adding a new UI. Reuse the existing `labor-supply` and `output-gap` concepts, add only the abstract graph nodes required by the approved design, and keep the homepage unchanged.

**Tech Stack:** Astro content collections, TypeScript topic/graph registries, Markdown, Node.js built-in tests, Astro check/build, Pagefind.

---

## File map

- Create `src/content/concepts/productivity.md`, `total-factor-productivity.md`, `working-age-population.md`, `demographic-dependency-ratio.md`, `potential-output.md`.
- Modify `src/content/concepts/output-gap.md` to add `potential-output` as a prerequisite.
- Modify `src/data/topics.ts` to register `structural-growth`.
- Modify `data/relations/macro.json` with five indicator nodes, four abstract nodes, and six approved relations.
- Create `tests/structural-growth-content.test.mjs` and `tests/structural-growth-relations.test.mjs`.
- Modify `tests/information-architecture.test.mjs`, `tests/business-cycle-content.test.mjs`, `tests/business-cycle-relations.test.mjs`, and `tests/labor-market-relations.test.mjs` for the new contracts and approved cross-cluster edges.

## Task 1: Lock content, IA, and prerequisite contracts

**Files:**
- Create: `tests/structural-growth-content.test.mjs`
- Modify: `tests/information-architecture.test.mjs`

- [x] **Step 1: Write the failing content contract.**

Create the test using the frontmatter parser in `tests/household-sector-content.test.mjs`. Use this exact metadata map:

```js
const expectedMetadata = {
  productivity: { name: '劳动生产率', category: 'growth', topics: ['structural-growth', 'economic-activity'], prerequisites: ['gdp'], order: 7 },
  'total-factor-productivity': { name: '全要素生产率（TFP）', category: 'growth', topics: ['structural-growth', 'economic-activity'], prerequisites: ['productivity'], order: 8 },
  'working-age-population': { name: '劳动年龄人口', category: 'labor', topics: ['structural-growth', 'labor-market'], prerequisites: [], order: 6 },
  'demographic-dependency-ratio': { name: '人口抚养比', category: 'labor', topics: ['structural-growth', 'labor-market'], prerequisites: ['working-age-population'], order: 7 },
  'potential-output': { name: '潜在产出与潜在增长', category: 'growth', topics: ['structural-growth', 'economic-activity'], prerequisites: ['productivity', 'working-age-population', 'labor-force-participation'], order: 9 },
};
```

Assert every page has `country: CN`, `graph: macro`, `featured: false`, no `chart`, `definition.asOf: 2026-08`, and `level: basic` only for `productivity` and `working-age-population`. Require these terms:

```js
const requiredTerms = {
  productivity: ['劳动生产率', '生产率水平', '生产率增速', '实际产出', '劳动投入', '就业人数', '工时', '名义', '实际', '工资'],
  'total-factor-productivity': ['全要素生产率', '劳动生产率', '生产函数', '资本', '劳动', '残差', '模型', '估计', '修订', '技术'],
  'working-age-population': ['劳动年龄人口', '年龄范围', '劳动力', '就业人口', '失业人口', '劳动参与率', '分母', '年龄边界'],
  'demographic-dependency-ratio': ['人口抚养比', '人口结构', '劳动年龄人口', '儿童', '老年', '比重', '财政', '家庭', '不等于', 'GDP'],
  'potential-output': ['潜在产出', '潜在增长', '实际 GDP 增长', '产出缺口', '无法直接观测', '模型', '估计', '修订', '周期性', '结构性'],
};
```

Require source URLs covering NBS national accounts/population/labor, IMF output-gap methodology, OECD productivity methodology, World Bank `SP.POP.DPND`, and the existing NBS/ILO labor-force methodology. Assert all `related` IDs resolve and the homepage contains none of the five new IDs.

- [x] **Step 2: Add IA and prerequisite assertions.**

In `tests/information-architecture.test.mjs`, assert:

```js
assert.deepEqual(topicRegistry.find((topic) => topic.id === 'structural-growth'), {
  id: 'structural-growth',
  label: '结构性增长',
  description: '理解生产率、人口结构、劳动供给与潜在产出如何共同决定长期增长能力。',
  category: 'growth',
  order: 52,
});
```

Parse `output-gap.md` and assert `prerequisites` equals `['potential-output']`.

- [x] **Step 3: Run the focused tests and confirm the red state.**

Run `node --import tsx tests/structural-growth-content.test.mjs tests/information-architecture.test.mjs`.

Expected: FAIL because the five pages, topic, and prerequisite are absent.

- [x] **Step 4: Commit the failing contracts.**

```bash
git add tests/structural-growth-content.test.mjs tests/information-architecture.test.mjs
git commit -m "test: define structural growth content contracts"
```

## Task 2: Implement topic, pages, and learning order

**Files:**
- Modify: `src/data/topics.ts`
- Modify: `src/content/concepts/output-gap.md`
- Create: `src/content/concepts/productivity.md`
- Create: `src/content/concepts/total-factor-productivity.md`
- Create: `src/content/concepts/working-age-population.md`
- Create: `src/content/concepts/demographic-dependency-ratio.md`
- Create: `src/content/concepts/potential-output.md`

- [x] **Step 1: Register the topic.**

Insert `'structural-growth'` after `'economic-activity'` in `topicIds`, and add this record to `topics`:

```ts
'structural-growth': { label: '结构性增长', description: '理解生产率、人口结构、劳动供给与潜在产出如何共同决定长期增长能力。', category: 'growth', order: 52 },
```

- [x] **Step 2: Add exact metadata and related IDs.**

Use `updatedAt: 2026-09-02`, `graph: macro`, `featured: false`, the Task 1 metadata, no `chart`, and these related sets:

```yaml
# productivity
related: [gdp, total-factor-productivity, employment, labor-force-participation]
# total-factor-productivity
related: [productivity, potential-output, gdp]
# working-age-population
related: [labor-force-participation, employment, demographic-dependency-ratio, labor-supply]
# demographic-dependency-ratio
related: [working-age-population, labor-force-participation, employment]
# potential-output
related: [gdp, productivity, total-factor-productivity, output-gap, labor-supply]
```

Use `definition.asOf: 2026-08` and cite primary or methodological sources before interpretation.

- [x] **Step 3: Write `productivity.md`.**

Include the following claims verbatim or equivalently: labor productivity is output per labor input; level answers output per unit of input while growth answers change in that ratio; productivity can rise while total output falls; actual rather than nominal output is normally used; labor input may be people, hours, or quality-adjusted labor; and productivity is not synonymous with an individual worker's wage. Add industry composition, coverage, comparability, and NBS/OECD sources.

```markdown
> 劳动生产率是单位劳动投入对应的产出。先区分生产率水平与生产率增速，再确认产出和劳动投入的统计口径。

## 水平与增速

生产率水平回答单位劳动投入生产了多少；生产率增速回答这个比值相对上一期如何变化。生产率上升不等于总产出一定上升，总产出增速上升也不自动代表生产率改善。

## 分子、分母与价格口径

劳动生产率通常使用实际产出除以劳动投入，劳动投入可以是就业人数、总工时或质量调整后的劳动投入。名义产出同时受数量和价格影响，不能直接替代实际产出。

## 不等于工资

劳动生产率上升可能支持工资和利润，但工资还受到议价能力、行业结构、利润分配和价格变化影响；生产率不是单个劳动者工资的同义词。
```

- [x] **Step 4: Write `total-factor-productivity.md`.**

Define TFP as the residual/efficiency estimate left after a production function accounts for capital, labor, and their weights. Explicitly distinguish it from labor productivity and state that it is not a directly observed physical technology quantity; capital stocks, labor quality, production-function form, weights, revisions, and identification assumptions make it model-dependent, estimated, and revisable.

```markdown
> 全要素生产率（TFP）是在给定生产函数、资本与劳动投入及其权重后，产出变化中无法由投入增长直接解释的残差或效率估计。

## 与劳动生产率的区别

劳动生产率只比较产出与某类劳动投入；TFP 同时把资本、劳动及其质量或权重放入生产函数。劳动生产率上升可能来自更多资本、更多工时、劳动结构变化或 TFP 变化。

## 为什么是估计值

TFP 不是直接观察到的物理技术数量。资本存量、劳动质量、生产函数形式、要素权重、数据修订和识别假设都会影响结果。因此 TFP 是模型依赖、可估计、可修订的残差；TFP 上升也不直接证明某项具体技术造成了变化。
```

- [x] **Step 5: Write the two demographic pages.**

In `working-age-population.md`, include the age-defined denominator and the identities `劳动力 = 就业人口 + 失业人口` and `劳动参与率 = 劳动力 / 劳动年龄人口`. Explain that age boundaries and survey coverage vary, and that study, retirement, care, or stopped-searching status can keep a person in the age denominator without placing them in the labor force.

```markdown
> 劳动年龄人口是按年龄范围定义的人口分母，不等于劳动力，也不等于就业人口。
```

In `demographic-dependency-ratio.md`, define the common `(children + older population) / working-age population` ratio, explain it as a demographic-structure measure rather than fiscal spending, household burden, or productivity, and state that population decline does not automatically imply GDP decline. Cite NBS population materials and World Bank `SP.POP.DPND`.

- [x] **Step 6: Write `potential-output.md` and update `output-gap.md`.**

Explain actual GDP growth versus potential growth, potential output as a model-dependent estimate, production-function/filter/multivariate methods, sample and revision risk, and the output-gap formula. Include:

```markdown
> 潜在产出是给定生产能力、通胀稳定或其他模型约束下的可持续产出水平；潜在增长是潜在产出的增长率。二者都无法直接观测。

## 实际增长与潜在增长

实际 GDP 增长描述已实现产出如何变化；潜在增长描述可持续供给能力如何变化。实际增长放缓可能来自需求、库存或其他周期因素，也可能包含生产率、人口和劳动供给的结构性变化。

## 估计与修订

潜在产出可以用生产函数、统计滤波或多变量模型估计。样本终点、GDP 修订、资本和劳动投入、通胀约束及模型设定都会改变结果，因此潜在产出是模型依赖、可估计、可修订的分析量。

## 与产出缺口的区别

产出缺口常写作 `(实际产出 - 潜在产出) / 潜在产出 × 100%`，表示实际产出相对估计潜在产出的偏离；它不是潜在产出本身。
```

In `output-gap.md`, add `prerequisites: [potential-output]` and add `potential-output` to `related`, without weakening the existing estimated/revisable boundary.

- [x] **Step 7: Run focused content and IA tests.**

Run `node --import tsx tests/structural-growth-content.test.mjs tests/information-architecture.test.mjs`; expected result is all focused assertions passing.

- [x] **Step 8: Commit the content cluster.**

```bash
git add src/data/topics.ts src/content/concepts/output-gap.md src/content/concepts/productivity.md src/content/concepts/total-factor-productivity.md src/content/concepts/working-age-population.md src/content/concepts/demographic-dependency-ratio.md src/content/concepts/potential-output.md tests/structural-growth-content.test.mjs tests/information-architecture.test.mjs
git commit -m "feat: add structural growth concepts"
```

## Task 3: Implement and verify graph relations

**Files:**
- Create: `tests/structural-growth-relations.test.mjs`
- Modify: `data/relations/macro.json`
- Modify: `tests/business-cycle-content.test.mjs`, `tests/business-cycle-relations.test.mjs`, `tests/labor-market-relations.test.mjs` for approved cross-cluster relations.

- [x] **Step 1: Write the failing graph contract.**

Follow `tests/business-cycle-relations.test.mjs`. Require indicator nodes `productivity: 劳动生产率`, `total-factor-productivity: 全要素生产率（TFP）`, `working-age-population: 劳动年龄人口`, `demographic-dependency-ratio: 人口抚养比`, `potential-output: 潜在产出与潜在增长`, and existing `output-gap: 产出缺口`.

Require abstract nodes `demographic-structure: 人口结构`, `efficiency-and-technology-residual: 效率与技术残差`, `sustainable-growth-capacity: 可持续增长能力`, and `actual-vs-potential-output: 实际与潜在产出对照`, each without `kind` and without a concept page.

Require exactly:

```js
const expectedRelations = [
  ['working-age-population', 'labor-supply', 'AFFECTS'],
  ['productivity', 'potential-output', 'AFFECTS'],
  ['total-factor-productivity', 'efficiency-and-technology-residual', 'REFLECTS'],
  ['potential-output', 'sustainable-growth-capacity', 'REFLECTS'],
  ['output-gap', 'actual-vs-potential-output', 'DERIVED_FROM'],
  ['demographic-dependency-ratio', 'demographic-structure', 'REFLECTS'],
];
```

Assert endpoint existence, canonical relation types, unique triples, and no cluster relation with type `CAUSES`.

- [x] **Step 2: Run the graph test and confirm the red state.**

Run `node --import tsx tests/structural-growth-relations.test.mjs`; expected result is FAIL because the new nodes and triples are absent.

- [x] **Step 3: Add the graph nodes.**

Add five indicator nodes and four abstract nodes to `data/relations/macro.json`, preserving its one-object-per-line style. Indicator objects must use `kind: indicator`; abstract objects must omit `kind`.

- [x] **Step 4: Add only the six approved relation objects.**

Append the six `expectedRelations` triples from Step 1. Do not add a second `labor-force-participation → labor-supply` edge; the existing `REFLECTS` relation remains the measurement representation documented in the spec.

- [x] **Step 5: Run graph and full tests.**

Run `node --import tsx tests/structural-growth-relations.test.mjs` and `npm test`; both must pass, including the prerequisite DAG and all existing relation contracts.

- [x] **Step 6: Commit graph changes.**

```bash
git add tests/structural-growth-relations.test.mjs data/relations/macro.json
git commit -m "feat: connect structural growth graph relations"
```

## Task 4: Verify and create the PR

**Files:** Verify all changed files above against `docs/superpowers/specs/2026-09-02-structural-growth-design.md`.

- [x] **Step 1: Run diff and full verification.**

```bash
git diff --check origin/main...HEAD
npm test
npm run check
npm run build
git status --short
```

Expected: no whitespace errors, all tests pass, Astro reports 0 errors/0 warnings/0 hints, static build and Pagefind succeed, and the worktree has no generated/untracked files.

- [x] **Step 2: Review scope against the spec.**

Confirm `src/pages/index.astro` is unchanged, the five pages contain no charts or forecasts, potential-output/TFP claims remain estimated and revisable, and no new `CAUSES` relation exists.

- [ ] **Step 3: Push and create the Issue #42 pull request.**

```bash
git push -u origin codex/issue-42-structural-growth
gh pr create --base main --head codex/issue-42-structural-growth --title "feat: build structural growth framework" --body "Closes #42. Adds productivity, TFP, demographic, potential-output concepts, structural-growth prerequisites, and non-causal graph relations. Verification: npm test; npm run check; npm run build."
```

Expected: a new PR targeting `main` contains only the Issue #42 changes because the branch starts at the merged PR #46 parent.
