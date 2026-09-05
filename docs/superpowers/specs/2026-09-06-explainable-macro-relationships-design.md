# 可解释宏观关系图设计

## 背景

MacroLens 已经通过 `data/relations/macro.json` 保存关系层，并通过 `/graph` 提供节点关系浏览。Issue #88 的目标不是再建立一个平行的 `/macro-map`，而是把现有关系从“节点之间存在连接”升级为“连接本身可解释”：用户能看到关系类型、时间领先/滞后信息和简短解释，并能从关系两端进入现有概念页。

## 目标与边界

目标：

- 继续使用 `data/relations/macro.json` 作为唯一关系数据源。
- 为第一批核心链路提供结构化的 `relation`、`lag`、`explanation` metadata。
- 在现有 `/graph` 页面中按节点浏览关系，并让每条已纳入核心地图的关系展开为详情 card。
- 连接已有概念页；没有概念页的上下文节点仍以不可点击文本展示。
- 保持 Astro 静态生成和现有指标计算逻辑不变。

第一批关系覆盖 GDP、PMI、CPI、PPI、M2、社融、利率、消费、投资和就业相关节点，但只维护核心链路，不生成这些节点之间的全组合关系：

- 增长链：PMI → 工业生产 → GDP → 就业 → 消费
- 通胀链：PPI → 企业成本 → CPI → 货币政策 → 利率
- 货币链：利率 → 信用环境 → M2 / 社融 → 投资 → GDP

不做预测模型、quantitative causal inference、因果强度、置信度评分或投资建议。关系类型第一版固定为 `leading_indicator`、`leading_factor`、`synchronous_indicator`、`lagging_indicator`、`transmission`。

## 数据模型

现有图谱元素继续使用 `source`、`target` 和已有的大写 `type` 字段，以保持 `graphRegistry.ts`、概念页关系卡片及既有图谱数据兼容。对纳入可解释核心地图的关系元素增加：

```json
{
  "data": {
    "source": "pmi",
    "target": "gdp",
    "type": "CORRELATES",
    "relation": "leading_indicator",
    "lag": "1-2 quarters",
    "explanation": "PMI captures business activity changes before quarterly GDP is released."
  }
}
```

`source` 和 `target` 使用稳定节点 ID，不复制展示名称。`type` 保留用于已有关系方向和分组语义；`relation` 是面向用户的宏观关系角色。`lag` 和 `explanation` 必须是非空字符串。没有纳入核心解释地图的历史关系仍按旧 schema 服务现有概念页，`/graph` 的核心关系视图不会为它们伪造解释。

## 页面与交互

复用 `/graph`，不新增 `/relations/:source-:target` 页面。页面继续服务于按节点阅读关系，但关系 card 增加：

- 关系角色的中文标签和稳定英文类型值。
- 领先、同步或滞后周期信息。
- 一句话解释，明确这是经验性、条件性的宏观关系，而非自动推断的因果结论。
- 关系两端的概念链接；抽象节点显示“图谱概念”文本。

服务器端继续渲染默认节点及所有静态关系内容，JavaScript 只负责节点选择和 card 的展开/收起，因此关闭 JavaScript 时默认关系仍可阅读。现有首页 `TransmissionPaths` 和概念页 `RelationshipCards` 保持兼容；首页不新增第二套关系地图入口。

## 实现结构

- `src/data/graphRegistry.ts` 扩展关系 metadata 类型、允许值和校验/查询函数。
- `data/relations/macro.json` 增加核心关系 metadata，继续作为手工维护的数据文件。
- `src/components/RelationshipCards.astro` 在有 metadata 时渲染详情 card，并为旧关系保留原有展示。
- `src/components/RelationshipExplorer.astro` 只展示可解释核心关系的详情，同时保留按节点浏览能力。
- `src/pages/graph.astro` 更新说明文字，明确关系 map 的解释性和非因果边界。
- `tests/relationship-graph.test.mjs` 校验 schema、核心链路、渲染入口和静态构建契约。

## 错误处理与数据安全

- 未知的 `relation` 类型、空 `lag`、空 `explanation`、重复关系或缺失节点在图谱注册/测试阶段失败。
- UI 不根据关系 metadata 推导新的边，也不把 `leading_*` 显示为确定因果。
- 没有概念页的节点不得生成不存在的 `/concepts/*` 链接。
- 既有不带解释 metadata 的关系不得被赋予默认的伪解释；它们保留旧的关系卡片表现。

## 测试策略

- Node 数据契约测试：节点唯一、边唯一、端点存在、核心关系类型合法，metadata 类型和必填字段完整，禁止未批准的关系类型。
- 组件源码契约测试：`/graph` 使用现有 registry 和 explorer，关系 card 包含详情入口/展开标记及非因果免责声明，导航和首页不重复推广新路由。
- 完整验证：`npm test`、`npm run check`、`npm run build`。visitor statistics 的已知基线测试失败与本功能分离记录，不改变本 PR 的业务范围。

