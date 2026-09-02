# 地方财政、地方政府债务与 LGFV 框架设计

## 目标

为 MacroLens 增加一个中国地方政府财政专题簇，解释地方财政预算、法定地方政府债务、专项债、土地出让收入和地方政府融资平台（LGFV）之间的联系，同时保持统计对象、法律责任和融资主体的边界。

## 范围与稳定 ID

新增以下五个概念页，均归入现有 `fiscal` 类别和新建的 `local-government-finance` 主题：

- `local-government-finance`：地方财政
- `local-government-debt`：地方政府债务
- `local-government-special-bonds`：地方政府专项债
- `land-transfer-revenue`：国有土地使用权出让收入 / 土地出让收入
- `lgfv`：地方政府融资平台（LGFV / 城投平台）

学习顺序采用：

```text
fiscal-policy
   ↓
local-government-finance
   ├──→ local-government-debt
   │        ↓
   │   local-government-special-bonds
   │
   ├──→ land-transfer-revenue
   └──→ lgfv
```

## 内容边界

- 地方财政页区分一般公共预算与政府性基金预算，并区分税收/非税收入和土地出让收入。
- 地方政府债务页区分债务余额与年度发行、偿还等流量，区分法定债务限额/官方统计与市场语境中的更广义债务讨论。
- 专项债页与一般债页区分偿债来源、预算管理和资金用途，不把专项债发行直接表述为 GDP 增长。
- 土地出让收入页区分财政入账、土地成交价款和土地市场活动，不写成土地成交额一比一转化为财政收入。
- LGFV 页说明其是具有独立法人资格的企业主体，企业债务与地方政府法定债务不是同一会计或法律对象；不得把全部 LGFV 债务列为地方政府债务。
- 所有页面明确存量/流量、政府债券/企业债券和政府责任/企业偿债责任的区别。

## 图谱设计

加入三个抽象节点：`local-fiscal-space`、`market-financing`、`local-fiscal-and-investment-conditions`，以及以下关系：

```text
local-government-finance --COMPONENT_OF--> fiscal-conditions
land-market --AFFECTS--> land-transfer-revenue
land-transfer-revenue --AFFECTS--> local-government-finance
local-government-debt --AFFECTS--> local-fiscal-space
local-government-special-bonds --COMPONENT_OF--> local-government-debt
lgfv --USES--> market-financing
lgfv --CORRELATES--> local-fiscal-and-investment-conditions
```

不加入 LGFV 债务属于地方政府债务的 `COMPONENT_OF` 关系，不加入土地成交额到财政收入的机械关系，也不加入专项债到 GDP 的确定性因果关系。

## 测试与验收

新增内容 regression tests，锁定：

- 五个稳定概念 ID、类别、主题和 prerequisite DAG；
- 一般公共预算/政府性基金预算、税费/土地出让收入、土地成交价款等关键统计边界；
- 法定地方政府债务/LGFV 企业债务、政府债券/企业债券、一般债/专项债、存量/流量和限额/余额边界；
- 仅存在批准的非确定性图谱关系，所有节点和 related ID 可解析。

验收命令：`npm test`、`npm run check`、`npm run build`。

## 官方来源

- [财政部：2025 年和 2026 年地方政府一般债务余额情况表](https://yss.mof.gov.cn/2026zyczys/202603/t20260324_3986005.htm)
- [财政部：地方政府债务问题答记者问](https://yss.mof.gov.cn/zhuantilanmu/zfzw/201611/t20161122_2463933.htm)
- [国家发展改革委：规范地方政府投融资平台公司发行债券](https://zfxxgk.ndrc.gov.cn/web/iteminfo.jsp?id=1232)
- [国务院：加强地方政府融资平台公司管理](https://www.gov.cn/zhengce/content/2010-06/13/content_1942.htm)

