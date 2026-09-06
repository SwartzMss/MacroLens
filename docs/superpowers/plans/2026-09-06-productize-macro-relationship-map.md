# 宏观关系地图产品化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 `/graph` 关系浏览器接入主导航、首页和概念页，让解释性关系在正常浏览中可发现、可阅读、可跳转。

**Architecture:** 保留 `macro.json`、`graphRegistry` 和 `/graph` 的静态关系模型。`BaseLayout` 与首页只增加入口；概念页继续把当前关系和全部概念传给 `RelationshipCards`，由该组件统一处理方向、节点链接和解释性字段。解释性卡片默认展开显示关系类型、时间关系和解释；没有解释性字段的旧关系继续走轻量卡片分支。

**Tech Stack:** Astro 7、TypeScript、Astro content collections、Node `node:test`、现有 CSS tokens。

---

### Task 1: 为产品入口和概念页关系契约写失败测试

**Files:**
- Modify: `tests/relationship-graph.test.mjs`

- [ ] **Step 1: 增加导航入口测试**

追加：

```js
test('exposes the relationship map from the primary navigation', () => {
  assert.match(layout, /<a href=["']\/graph["']>宏观关系<\/a>/);
});
```

- [ ] **Step 2: 增加首页关系地图入口测试**

追加：

```js
test('makes the relationship map discoverable from the homepage', () => {
  assert.match(homepage, /href=["']\/graph["']/);
  assert.match(homepage, /宏观关系|关系地图/);
  assert.match(homepage, /领先|滞后|影响|相关/);
});
```

- [ ] **Step 3: 增加概念页复用关系模型测试**

追加：

```js
test('concept pages reuse canonical relationship metadata', () => {
  const conceptPage = readSource(`${root}src/pages/concepts/[id].astro`);
  assert.match(conceptPage, /getConceptRelations\(entry\.data\.graph, entry\.data\.id\)/);
  assert.match(conceptPage, /<RelationshipCards conceptId=\{entry\.data\.id\}/);
  assert.match(conceptPage, /relations=\{relations\}/);
  assert.match(conceptPage, /concepts=\{allConcepts\}/);
  assert.match(relationshipCards, /isExplainableRelation/);
  assert.match(relationshipCards, /metadata\.lag/);
  assert.match(relationshipCards, /metadata\.explanation/);
});
```

- [ ] **Step 4: 增加旧关系不伪造语义的测试**

追加：

```js
test('keeps legacy relationships lightweight without fabricated semantics', () => {
  assert.match(relationshipCards, /if \(metadata\) return <details/);
  assert.match(relationshipCards, /return <div class:list=\{cardClasses\}>\{linkedSummary\}<\/div>/);
  assert.doesNotMatch(relationshipCards, /labels\[item\.relation\.type\].*metadata\.lag/);
});
```

- [ ] **Step 5: 运行 focused test，确认新契约失败**

运行 `node --import tsx --test tests/relationship-graph.test.mjs`。预期现有关系模型测试通过，导航和首页入口测试因当前没有 `/graph` 产品入口而失败。

### Task 2: 增加主导航与首页关系地图入口

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: 在主导航加入宏观关系链接**

在“主题”和“搜索”之间加入 `<a href="/graph">宏观关系</a>`，保持现有导航顺序、静态链接和 sticky header 行为。

- [ ] **Step 2: 在首页加入产品入口卡**

在 `MacroSnapshot` 后加入：

```astro
<section class="section relationship-entry">
  <div class="section-head">
    <div><div class="eyebrow">Macro relationships</div><h2>看懂指标之间的关系</h2></div>
    <p>从关系开始继续探索</p>
  </div>
  <a class="relationship-entry-card" href="/graph">
    <div>
      <div class="number">关系</div>
      <h3>宏观关系地图</h3>
      <p>阅读谁影响谁、哪些指标领先或滞后，以及这些关系在宏观传导中如何连接。</p>
    </div>
    <span aria-hidden="true">打开关系地图 →</span>
  </a>
</section>
```

- [ ] **Step 3: 添加响应式入口卡样式**

复用 `--card`、`--line`、`--green`、`--muted` 增加卡片、hover、focus-visible 和小屏布局样式，不引入脚本。

- [ ] **Step 4: 运行 focused test，确认入口 GREEN**

运行 `node --import tsx --test tests/relationship-graph.test.mjs`，确认导航和首页入口测试通过。

- [ ] **Step 5: Commit 入口变更**

```bash
git add src/layouts/BaseLayout.astro src/pages/index.astro tests/relationship-graph.test.mjs
git commit -m "feat: expose macro relationship map entry points"
```

### Task 3: 将解释性关系在概念页默认可见并隐藏内部字段

**Files:**
- Modify: `src/components/RelationshipCards.astro`
- Modify: `src/components/RelationshipExplorer.astro`
- Modify: `src/pages/graph.astro`

- [ ] **Step 1: 让解释性关系详情默认展开**

将 explainable 分支的 `<details>` 改为带 `open` 属性的详情卡，保留现有 `summary`、来源/目标、关系类型、时间关系和解释，让概念页首次加载即可阅读语义。

- [ ] **Step 2: 保持链接、方向和旧关系分支**

继续使用 `currentIsSource` 和 `item.direction` 渲染端点、箭头与对称关系；保留真实概念的 `/concepts/<id>` 链接和抽象节点的“图谱概念”标签。没有 metadata 时继续渲染 `linkedSummary` 的轻量 `<div>`，不提供默认 `lag` 或解释。

- [ ] **Step 3: 移除主 UI 中的内部关系枚举**

保留中文 `explainableLabels` 映射，只显示“领先指标”“同步指标”“传导环节”等用户语言；删除 `metadata.relation` 的 `<code>` 输出，避免暴露 `leading_indicator` 等内部 schema。

- [ ] **Step 4: 调整关系浏览器说明**

将 `RelationshipExplorer` controls 文案和 `/graph` 页面说明改成正常中文，明确可阅读关系类型、时间关系和解释；保留手工维护、非确定因果和静态浏览边界，不增加实时推断。

- [ ] **Step 5: 运行 focused test，确认关系 UI GREEN**

运行 `node --import tsx --test tests/relationship-graph.test.mjs`，确认关系方向、metadata、页面结构和入口测试全部通过。

- [ ] **Step 6: Commit 关系页面变更**

```bash
git add src/components/RelationshipCards.astro src/components/RelationshipExplorer.astro src/pages/graph.astro tests/relationship-graph.test.mjs
git commit -m "feat: productize explainable relations on concept pages"
```

### Task 4: 完整验证、审查并创建 PR #95

**Files:**
- Verify: `src/layouts/BaseLayout.astro`, `src/pages/index.astro`, `src/components/RelationshipCards.astro`, `src/components/RelationshipExplorer.astro`, `src/pages/graph.astro`, `tests/relationship-graph.test.mjs`

- [ ] **Step 1: 运行完整测试**

运行 `npm test`，预期全部测试通过、0 failures。

- [ ] **Step 2: 运行 Astro 检查**

运行 `npm run check`，预期退出码为 0。

- [ ] **Step 3: 运行静态构建**

运行 `npm run build`，预期静态站点构建成功、`dist/graph/index.html` 生成且 Pagefind 索引完成。

- [ ] **Step 4: 检查变更边界**

运行 `git diff --check origin/main...HEAD`、`git diff --stat origin/main...HEAD` 和 `git status --short --branch`；预期只包含 #95 的设计、导航、首页入口、关系卡片/说明和测试，不新增第二套关系数据或关系路由。

- [ ] **Step 5: 请求代码审查**

以 `origin/main` 为 base、当前功能头提交为 head，检查导航发现性、概念页静态渲染、方向/对称性、旧关系兼容性、可访问性和内部 schema 是否泄露；修复 Critical/Important 问题后再创建 PR。

- [ ] **Step 6: 推送并创建 PR**

```bash
git push -u origin codex/issue-95-macro-relationship
gh pr create --base main --head codex/issue-95-macro-relationship --title "feat: productize macro relationship map across navigation and concept pages" --body-file /tmp/macro-relationship-map-pr.md
```

PR body：

```markdown
## Summary

- Expose the existing macro relationship explorer from primary navigation and the homepage.
- Surface explainable relation type, timing, explanation, and concept links directly on concept pages.
- Keep legacy relationships lightweight and preserve the canonical static relationship model.

## Test plan

- [x] npm test
- [x] npm run check
- [x] npm run build
- [x] No new relationship dataset or inferred causal logic added
```

