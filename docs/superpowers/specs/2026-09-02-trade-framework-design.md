# Issue #44：外贸与贸易条件概念框架设计

## 目标

新增一个聚焦的外贸概念簇，覆盖出口、进口、贸易差额、贸易数量与价格拆分、贸易条件，并把它与现有汇率、国际收支、外部部门和增长概念连接起来。内容优先帮助读者确认统计口径，再解释增长或外部平衡。

## 概念与学习顺序

新增稳定 ID：

- `exports`：出口
- `imports`：进口
- `trade-balance`：贸易差额
- `trade-volume-and-price`：贸易数量与价格拆分
- `terms-of-trade`：贸易条件

metadata 中的 prerequisite 只表达学习顺序：

```text
exchange-rate
   ↓
exports / imports
   ↓
trade-balance

exports + imports
   ↓
trade-volume-and-price
   ↓
terms-of-trade

trade-balance
   ↓
current-account
```

该结构必须是无环 DAG；一般经济关联放在 graph relation 或正文中，不扩大 prerequisite 的含义。

## 内容边界

五个页面共同明确以下边界：

- 海关货物贸易统计与 BOP 的货物和服务交易不是可互换口径；
- 出口/进口金额、数量（实际量）和价格指数分别回答不同问题；
- 名义出口增长不等于实际或数量增长，月度变化需要考虑季节性、基数和价格；
- 贸易差额是货物/服务出口减进口的差额，不能直接等同经常账户余额；
- 双边贸易差额与总体贸易差额可能因伙伴、转口、统计方法和估价不同而不同；
- 贸易条件是出口价格相对于进口价格的比值或指数，不是汇率；
- FOB/CIF 等估价和运输保险处理会影响跨来源比较。

页面使用海关总署、国家统计局、国家外汇管理局、IMF BPM6 和 WTO 等权威来源，避免把海关出口/进口直接描述为 BOP 经常账户流量。

## 图关系

只新增谨慎、非决定性的关系：

- `exports --AFFECTS--> economic-activity`
- `imports --REFLECTS--> domestic-demand-and-input-demand`
- `exports --COMPONENT_OF--> merchandise-trade`
- `imports --COMPONENT_OF--> merchandise-trade`
- `trade-balance --DERIVED_FROM--> exports-and-imports`
- `trade-balance --OVERLAPS_WITH--> current-account-goods-balance`
- `terms-of-trade --REFLECTS--> export-import-relative-prices`
- `exchange-rate --AFFECTS--> trade-pricing-and-competitiveness`

如果仓库没有对应的抽象节点，将按现有 graph 约定复用已有节点或新增最小抽象节点，并为每个节点提供可解析的定义；不新增 `CAUSES`，也不编码“贬值必然提高出口”等确定性命题。关系回归测试会锁定关系唯一性、节点解析和禁止 `CAUSES`。

## 测试与验收

先扩展内容和关系回归测试，再添加实现内容。测试覆盖：

- 五个概念 ID、标题、关键正文边界、官方来源和 related ID；
- 海关统计/BOP、金额/数量/价格、贸易差额/经常账户和贸易条件/汇率的反混淆措辞；
- prerequisite DAG 无环且引用可解析；
- 新增关系属于批准集合、无重复、节点可解析且不含确定性因果关系。

完成后运行：

```text
npm test
npm run check
npm run build
```

并检查 `git diff --check`，确认只包含 Issue #44 相关内容。

## 非目标

不加入关税政策倡议、公司级出口敞口、贸易战时间线、投资建议、自动数据接入或完整服务贸易分类体系；服务贸易只在解释海关与 BOP 边界所必需的范围内出现。
