# MacroLens 信息架构设计

## 目标

将 MacroLens 从按 `Category -> Concept` 的平面目录扩展为可持续浏览的静态信息架构，同时保留现有的 Markdown/JSON 内容源、稳定概念 ID、关系数据模型、Pagefind 搜索和首页精选入口。

本次只改善发现路径、学习顺序和浏览结构，不新增宏观概念，不引入后端、账户、推荐系统或节点连线图。

## 现状与约束

- 概念来自 `src/content/concepts/*.md`，由 `src/content.config.ts` 定义 Astro collection schema。
- `/concepts` 当前按 `category` 分组并渲染全部卡片；`/concepts/[id]` 使用稳定 `id` 生成静态页面。
- `src/data/categories.ts` 是已有分类注册表；`data/relations/macro.json` 和 graph registry 的语义不能改变。
- 构建命令为 `npm test`、`npm run check`、`npm run build`。
- 不引入第二套全文搜索；筛选必须使用静态生成的数据并在无 JavaScript 时仍能浏览全部概念。

## 方案

采用共享 catalog 层，而不是在每个页面单独处理 metadata：

1. `src/data/topics.ts` 集中定义稳定 topic registry。每个 topic 包含 `id`、中文 `label`、`description`、所属已有 `category` 和显示 `order`。
2. `src/data/conceptCatalog.ts` 接收 Astro collection entries，建立稳定 ID 索引并验证跨概念约束：topic 存在、prerequisite 存在、不能自依赖、不能重复、不能形成环。页面只消费验证后的派生目录。
3. content schema 增加可选字段：`level`（`basic`/`advanced`）、`topics`、`prerequisites`、`featured`。现有 `category`、`related`、`graph`、`order` 语义不变。
4. `/topics` 展示 topic registry；`/topics/[id]` 通过静态 paths 从 registry 生成详情，并从 concept metadata 派生概念列表。概念排序优先使用现有 `order`，再使用稳定 ID 作为确定性 tie-breaker；页面显示 level 和先修入口。
5. `/concepts` 增加 category、topic、level 原生控件。页面初始 HTML 仍包含全部卡片，客户端脚本仅按控件状态隐藏/显示卡片并更新结果计数；脚本不可用时仍可访问全部静态链接。
6. `/concepts/[id]` 在正文内容前显示配置的 prerequisite 卡片及顺序链接；related concepts 和 relationship cards 继续从现有字段/graph registry 派生，绝不从关系数据推断 prerequisites。

## 初始 topic taxonomy

初始 registry 聚合已有内容，使用以下 12 个主题方向，不为单一概念创建 filler topic：

- `money-supply`：货币供应与流动性
- `credit-financing`：信用与融资
- `monetary-transmission`：货币政策传导
- `prices-inflation`：通胀与价格
- `economic-activity`：经济活动与周期
- `fiscal-policy`：财政政策
- `labor-market`：劳动力市场
- `housing-market`：房地产与住房
- `market-rates`：市场利率
- `exchange-rates`：汇率与跨货币定价
- `balance-of-payments`：国际收支与外部流量
- `external-balance-sheets`：外部资产负债表

一个概念可以进入多个 topic。每个现有概念至少进入一个与其内容直接相关的 topic；没有充分学习依赖的概念保持空 prerequisite 列表。

## 数据流与错误处理

页面在静态构建阶段调用 catalog 工具。任何稳定 ID、topic 或 prerequisite 的无效引用、重复值或 prerequisite 环都会抛出带概念 ID 和具体字段的错误，使 `npm run check`/`npm run build` 失败，而不是生成部分可用页面。topic 详情页对未知路径不生成静态页面。

catalog 校验器使用与 Astro collection entry 解耦的最小结构类型，因此可以在 Node 测试中直接使用 fixture 验证算法。页面侧只负责将 `getCollection('concepts')` 传入 catalog，并复用其索引、分组和排序结果。

## 测试策略

- 为 schema/catalog 约束增加 Node 测试：合法 metadata、缺失 topic、缺失 prerequisite、自依赖、重复 topic、重复 prerequisite 和 prerequisite cycle。
- 测试所有 Markdown 概念具有有效 level、至少一个真实 topic、可解析的 prerequisites，并验证 registry topic ID 唯一且覆盖策略不产生 filler topic。
- 测试 topic 派生顺序和静态概念链接来自 metadata，而非页面局部硬编码数组。
- 运行完整 `npm test`、`npm run check` 和 `npm run build`，确保现有关系测试、Pagefind 构建和首页继续工作。

## 不在本次范围内

- 新增概念内容或数据抓取。
- explainers/articles、登录、进度、个性化推荐。
- 后端/API/数据库。
- 节点连线知识图谱。
- 替换 Pagefind 或把首页改成完整目录。
