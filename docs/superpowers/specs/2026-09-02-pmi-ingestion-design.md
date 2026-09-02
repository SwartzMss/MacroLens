# Issue #45：NBS PMI 自动更新设计

## 目标与范围

建立 MacroLens 的首个官方数据自动更新闭环：从国家统计局官方发布聚合页发现最新制造业 PMI 数据页，提取“中国制造业 PMI”主指数，标准化为现有 `IndicatorDataset`，严格校验后只在输出变化时更新 `data/indicators/pmi.json`，并通过 GitHub Actions 创建或更新 reviewable PR。

首个 PR 只接入制造业 PMI 主指数。表中的生产、新订单、原材料库存、从业人员和供应商配送时间等构成指数不在本次范围内；CPI、M1、M2 和 SAFE 数据也不在本次范围内。

## 模块边界

代码放在 `scripts/ingest/`，职责分开：

```text
fetch/nbs-pmi.ts
        ↓ official HTML
normalize/pmi.ts
        ↓ normalized observations + source metadata
validate/dataset.ts + validate/overlap.ts
        ↓ validated IndicatorDataset
write/indicator.ts
        ↓ changed / unchanged
data/indicators/pmi.json
```

通用接口保持轻量，不引入插件注册框架：

- fetch 接收 URL 和可注入的 `fetch` 实现，返回带 URL 的 HTML 文本；
- normalize 接收原始 HTML 和发布页 metadata，返回 PMI observations 与 authoritative source；
- validate 检查现有 `IndicatorDataset` 必需字段、PMI 的月度/index 语义、日期唯一性与排序、数值范围、来源 metadata 和方法元数据；
- overlap 将抓取到的历史 observations 与现有序列逐日期比较，任何重叠日期值不一致都抛出 `HistoricalMismatchError`；
- write 使用稳定的 JSON 序列化，只在内容真正变化时替换文件，并返回 `{ changed, output }`。

## 官方页面发现与解析

`fetch/nbs-pmi.ts` 从国家统计局“最新发布和解读聚合”页开始，必须按以下顺序筛选：

1. 匹配明确标题“中国采购经理指数运行情况”，不能只匹配 `PMI`；
2. 读取并验证发布日期为 `YYYY-MM-DD`；
3. 排除“首席统计师解读”等非数据页；
4. 请求匹配到的官方发布页；
5. 验证页面包含“表1 中国制造业PMI及构成指数”；
6. 验证表格包含 `PMI` 列；
7. 只解析 PMI 主指数列，不解析五个构成指数；
8. 验证至少包含连续的 `YYYY年M月` 月份和数值，否则失败。

解析器不依赖页面上的第一个 PMI 链接，也不把解读文章中的叙述数字当作数据。发布聚合页和 2026 年 8 月 PMI 数据页分别作为 checked-in fixtures，保证普通测试不访问网络。

## 数据合并与来源策略

官方 2026 年 8 月数据页提供 2025 年 8 月至 2026 年 8 月共 13 个月。第一次运行将：

- 对 2025-08、2025-09、2025-10 与现有 `pmi.json` 做 overlap equality 校验；
- 在三个月均一致后，追加 2025-11 至 2026-08；
- 保留现有历史 baseline source；
- 将 `sources[]` 维护为一个 historical baseline source 加一个滚动 latest authoritative source，不按月无限追加 URL；
- 更新 `updatedAt` 为最新发布页日期，并保持 `definitionAsOf`、`calculation`、`comparabilityNote` 等系列语义字段不被适配器静默改写。

如果任何历史重叠值不同，命令以 `HistoricalMismatchError` 失败，不覆盖旧文件；如果 definition、frequency、unit、metric 或 coverage 等语义元数据发生不兼容变化，也必须失败并等待人工处理。

## 工作流

新增 `.github/workflows/update-macro-data.yml`：

- 每月在官方 PMI 发布窗口之后执行一次；
- 支持 `workflow_dispatch` 手动运行；
- 使用 Node 20、`npm ci` 和 ingestion CLI；
- live fetch 只访问国家统计局官方域名；
- 无变化时退出 0，不产生 commit 或 PR；
- 有变化时用 PR 创建 action 提交 `data/indicators/pmi.json` 并创建或更新一个 reviewable PR；
- 抓取、解析、校验或 overlap 失败时以非零状态结束，不写入不完整数据；
- 不引入运行时 API、数据库或浏览器端网络请求。

## 测试策略

测试全部使用 fixture 或注入的 deterministic fetch，不依赖 live official service。覆盖：

- 聚合页只选“中国采购经理指数运行情况”数据页；
- 缺少数据页、发布日期、表 1、PMI 列或连续月份时失败；
- 只输出 PMI 主指数，不输出构成指数；
- HTML 数值解析、月份规范化、升序和去重；
- 缺失值、非数字、超出 PMI 合理范围、重复日期和乱序输入；
- frequency/unit/metric/source/provenance 字段校验；
- 2025-08 至 2025-10 overlap 一致时安全追加；
- overlap mismatch 抛出 `HistoricalMismatchError`；
- source metadata 滚动规则和稳定 JSON 输出；
- unchanged output 不写文件；
- 与现有 `IndicatorDataset` 兼容并保持网站构建。

## 验收标准

- `npm run ingest:pmi -- --fixture ...` 可在 fixture 上端到端运行；
- live workflow 可发现并解析最新 NBS PMI 数据页；
- 生成数据仍满足 `IndicatorDataset` 语义和现有 PMI 图表；
- 普通 `npm test` 不访问网络；
- `npm test`、`npm run check`、`npm run build` 通过；
- workflow 具有 schedule 和 `workflow_dispatch`，只在数据变化时创建或更新 PR。
