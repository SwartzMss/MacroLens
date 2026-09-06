# 可解释宏观关系图实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 `/graph` 和 `data/relations/macro.json` 上增加核心宏观关系的 `relation`、`lag`、`explanation` metadata，并在关系卡片中提供可展开的解释。

**Architecture:** 保留图谱现有 `source`、`target`、`type` 字段作为兼容层，在同一 JSON 关系元素上增加可选的解释 metadata。 `graphRegistry.ts` 负责固定类型和运行时校验；`RelationshipCards.astro` 对带 metadata 的关系渲染 `<details>`，旧关系继续使用原有卡片；`/graph` 继续按节点静态生成，JavaScript 只负责节点面板切换。

**Tech Stack:** Astro 7、TypeScript、Node `node:test`、JSON 图谱数据、现有 MacroLens CSS tokens。

---

### Task 1: 为 explainable relationship schema 写失败测试

**Files:**
- Modify: `tests/relationship-graph.test.mjs`

- [ ] **Step 1: 扩展测试 fixture 和固定类型集合**

在现有 `relations` 解析后增加：

    const explainableRelations = relations.filter((relation) => 'relation' in relation);
    const explainableRelationTypes = new Set([
      'leading_indicator',
      'leading_factor',
      'synchronous_indicator',
      'lagging_indicator',
      'transmission',
    ]);

- [ ] **Step 2: 写 metadata 数据契约测试**

增加测试，要求第一批至少有 20 条 explainable relations，并验证字段完整、类型固定，且不出现未批准的因果或评分字段：

    test('defines explainable metadata for the core macro chains', () => {
      assert.ok(explainableRelations.length >= 20);
      for (const relation of explainableRelations) {
        assert.ok(explainableRelationTypes.has(relation.relation));
        assert.equal(typeof relation.lag, 'string');
        assert.ok(relation.lag.trim().length > 0);
        assert.equal(typeof relation.explanation, 'string');
        assert.ok(relation.explanation.trim().length > 0);
        assert.equal(Object.hasOwn(relation, 'causal_effect'), false);
        assert.equal(Object.hasOwn(relation, 'impact_strength'), false);
        assert.equal(Object.hasOwn(relation, 'confidence_score'), false);
      }
    });

- [ ] **Step 3: 写核心链路覆盖测试**

要求以下 20 条稳定关系 key 都带有 metadata，覆盖增长、通胀和货币链：

    const requiredCoreRelations = [
      ['pmi', 'business-activity-conditions', 'REFLECTS'],
      ['business-activity-conditions', 'economic-activity', 'CORRELATES'],
      ['industrial-production', 'industrial-activity', 'REFLECTS'],
      ['industrial-activity', 'economic-activity', 'COMPONENT_OF'],
      ['gdp', 'economic-activity', 'MEASURES'],
      ['employment', 'labor-market-conditions', 'REFLECTS'],
      ['retail-sales', 'consumption-activity', 'REFLECTS'],
      ['consumption-activity', 'economic-activity', 'COMPONENT_OF'],
      ['ppi', 'producer-price-pressure', 'REFLECTS'],
      ['producer-price-pressure', 'downstream-price-pressure', 'AFFECTS'],
      ['downstream-price-pressure', 'consumer-price-pressure', 'AFFECTS'],
      ['cpi', 'consumer-price-pressure', 'REFLECTS'],
      ['monetary-policy', 'policy-rate', 'USES'],
      ['policy-rate', 'financing-conditions', 'AFFECTS'],
      ['financing-conditions', 'credit', 'AFFECTS'],
      ['credit', 'm2', 'AFFECTS'],
      ['credit', 'social-financing', 'OVERLAPS_WITH'],
      ['social-financing', 'real-economy-financing', 'MEASURES'],
      ['fixed-asset-investment', 'investment-activity', 'REFLECTS'],
      ['investment-activity', 'economic-activity', 'COMPONENT_OF'],
    ];
    for (const [source, target, type] of requiredCoreRelations) {
      const relation = relations.find((item) =>
        item.source === source && item.target === target && item.type === type
      );
      assert.ok(relation?.relation && relation.lag && relation.explanation);
    }

- [ ] **Step 4: 写页面渲染契约测试**

在现有 explorer 测试中读取 `RelationshipCards.astro`，要求它包含 `<details>`、`<summary>`、`data-explainable-relation`、`lag` 和 `explanation`；要求 graph 页面说明可展开关系详情且声明不做因果推断。

- [ ] **Step 5: 运行 focused test，确认它按预期失败**

Run: `node --import tsx --test tests/relationship-graph.test.mjs`

Expected: 现有结构完整性测试通过；metadata 数量和页面渲染契约因当前代码没有解释 metadata / `<details>` 而失败。

### Task 2: 实现类型固定和核心关系 metadata

**Files:**
- Modify: `src/data/graphRegistry.ts`
- Modify: `data/relations/macro.json`

- [ ] **Step 1: 在 registry 中定义 explainable relationship 类型**

在 `RelationType` 后增加：

    export const explainableRelationTypes = [
      'leading_indicator',
      'leading_factor',
      'synchronous_indicator',
      'lagging_indicator',
      'transmission',
    ] as const;

    export type ExplainableRelationType = typeof explainableRelationTypes[number];
    export type RelationshipMetadata = {
      relation: ExplainableRelationType;
      lag: string;
      explanation: string;
    };

将 `Relation` 扩展为 `source`、`target`、`type` 加上 `Partial<RelationshipMetadata>`，并提供 `isExplainableRelation` type guard。只有三个字段均为非空字符串且 `relation` 属于固定集合时才返回 true。

- [ ] **Step 2: 在图谱解析时校验 metadata 和结构完整性**

在 `validateGraphElements` / `parseGraph` 中检查节点唯一、关系三元组唯一、关系端点存在、`type` 属于既有 `relationTypes`，并要求 metadata 要么全部缺省要么全部有效。未知类型抛出 `Unknown explainable relationship type`，缺字段抛出 `Incomplete explainable relationship metadata`，禁止 `causal_effect`、`impact_strength` 和 `confidence_score`。保留旧关系兼容读取，不为旧关系补默认解释。

- [ ] **Step 3: 为核心关系写 metadata**

保持 `source`、`target`、`type` 不变，在 Task 1 的 20 条关系以及以下已有链路上增加完整字段：`m2 -> activity`、`social-financing -> financing-conditions`、`real-economy-financing -> activity`、`activity -> macro`、`economic-activity -> macro`。

每条关系使用固定类型之一、非空 lag 和条件性解释。例如：

    {
      "source": "pmi",
      "target": "business-activity-conditions",
      "type": "REFLECTS",
      "relation": "leading_indicator",
      "lag": "1-2 months",
      "explanation": "PMI is released earlier and can signal changes in business activity before broader quarterly output data."
    }

不要新增关系文件，不写 `causes`、强度或置信度结论。

- [ ] **Step 4: 运行数据契约测试，确认 GREEN**

Run: `node --import tsx --test tests/relationship-graph.test.mjs`

Expected: metadata、核心链路和 registry 校验通过；此时页面 `<details>` 契约仍失败。

### Task 3: 将关系 metadata 渲染为可展开详情 card

**Files:**
- Modify: `src/components/RelationshipCards.astro`
- Modify: `src/components/RelationshipExplorer.astro`
- Modify: `src/pages/graph.astro`
- Modify: `src/styles/explorer.css`

- [ ] **Step 1: 在 RelationshipCards 中增加固定关系角色标签**

添加固定映射：

    const explainableLabels: Record<ExplainableRelationType, string> = {
      leading_indicator: '领先指标',
      leading_factor: '领先因素',
      synchronous_indicator: '同步指标',
      lagging_indicator: '滞后指标',
      transmission: '传导环节',
    };

带 metadata 的关系输出 `<details class="relationship-card" data-explainable-relation>`，summary 复用现有两端节点和方向箭头，并显示关系角色；展开内容显示关系角色、`lag` 和 `explanation`，且这些文案使用中文并描述当前 `source → target` 边。`leading_indicator`、`leading_factor`、`lagging_indicator` 和 `transmission` 使用单向箭头；`synchronous_indicator` 仅在底层 `CORRELATES` / `OVERLAPS_WITH` 时保留双向箭头。没有 metadata 的关系继续输出原来的 div card 和旧对称逻辑。

- [ ] **Step 2: 保持节点链接和可访问性**

让 `<summary>` 只包裹关系两端与方向，不把已有 concept link 嵌套进 summary；两端继续指向 `/concepts/<stable-id>`，抽象节点继续显示“图谱概念”。详情使用 `<dl>`，`lag` 和 `explanation` 有明确 `dt`/`dd`。

- [ ] **Step 3: 更新 explorer 和 graph 页面说明**

在 controls 文案中说明点击带有关系说明的卡片可展开阅读关系类型、时间和解释。页面 lead/disclaimer 明确关系是手工维护、用于导航和解释，不是实时模型，不代表确定因果、不提供预测或投资建议。保留 M2 默认 panel、静态 HTML、JS 切换和 noscript fallback。

- [ ] **Step 4: 添加响应式样式**

在 `RelationshipCards.astro` 的现有 style block 中为 explainable card 的纯文本 summary、展开内容、来源/目标链接、metadata grid 和小屏单列布局增加样式，保留现有 tokens，增加 focus outline 和 summary marker 处理，不引入 canvas、force layout 或图形库。

- [ ] **Step 5: 运行 focused test，确认 GREEN**

Run: `node --import tsx --test tests/relationship-graph.test.mjs`

Expected: 所有 relationship graph tests 通过。

- [ ] **Step 6: Commit 功能实现**

    git add data/relations/macro.json src/data/graphRegistry.ts src/components/RelationshipCards.astro src/components/RelationshipExplorer.astro src/pages/graph.astro src/styles/explorer.css tests/relationship-graph.test.mjs
    git commit -m "feat: enrich macro relationship graph with explainable metadata"

### Task 4: 完整验证并准备 PR

**Files:**
- Verify: all files changed by Tasks 1-3
- No new relation data file

- [ ] **Step 1: 运行完整 Node 测试**

Run: `npm test`

Expected: 全部测试通过；visitor statistics 的最新诊断响应契约由同步后的测试覆盖。

- [ ] **Step 2: 运行 Astro 类型检查**

Run: `npm run check`

Expected: 0 errors；若受沙箱阻止 esbuild，使用 escalated npm 命令重跑并记录结果。

- [ ] **Step 3: 运行静态构建**

Run: `npm run build`

Expected: 生成静态站点，`dist/graph/index.html` 存在，页面包含关系角色、lag、解释和可展开 details，Pagefind 完成。

- [ ] **Step 4: 检查 diff 和工作树**

Run:

    git diff --check
    git diff --stat origin/main...HEAD
    git status --short --branch

Expected: 仅包含 issue #88 的设计、关系 metadata、registry/UI/test 变更；不包含新 `/macro-map`、独立 relation 页面或未请求的视觉图谱。

- [ ] **Step 5: 请求代码审查**

基于 `origin/main` 和功能提交 SHA，按 `requesting-code-review` 对 schema 兼容性、核心链路覆盖、静态渲染、可访问性和因果边界进行审查；修复 Critical/Important 反馈后再创建 PR。

- [ ] **Step 6: Push 并创建 PR**

    git push -u origin codex/issue-88-macro-relationship
    gh pr create --repo SwartzMss/MacroLens --base main --head codex/issue-88-macro-relationship --title "feat: enrich macro relationship graph with explainable metadata" --body-file /tmp/macro-relationship-pr.md

PR body 使用：

    Closes #88

    ## Summary

    - Extend the existing data/relations/macro.json relations with explainable metadata for the core growth, inflation, and monetary chains.
    - Reuse /graph and render relation type, lag, and explanation in expandable cards with existing concept links.
    - Add schema, core-chain, UI contract, type-check, and static-build verification without changing indicator calculations.

    ## Test plan

    - [x] node --import tsx --test tests/relationship-graph.test.mjs
    - [x] npm test
    - [x] npm run check
    - [x] npm run build
    - [x] Confirmed no /macro-map or /relations/* route was added.
