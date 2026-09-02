---
id: household-saving-rate
name: 居民储蓄率
subtitle: 可支配收入中未用于消费的储蓄流量比例，不等于住户存款余额变化
country: CN
category: growth
source: 国家统计局国民经济核算与 OECD
definition: { source: household saving in national accounts, asOf: 2026-08 }
updatedAt: 2026-09-02
related: [disposable-income, household-consumption, m2, real-interest-rate]
graph: macro
order: 14
level: advanced
topics: [household-sector,economic-activity,market-rates]
prerequisites: [disposable-income,household-consumption]
featured: false
---

> 居民储蓄率描述一定时期内住户可支配收入中没有用于最终消费的部分。它是流量概念的比例，不是银行账户余额，也不是家庭财富的直接估计。

## 基本计算

国家统计局说明，住户部门总储蓄可以写为：

```text
住户部门总储蓄 = 住户部门可支配收入 − 居民消费支出
居民储蓄率 = 住户部门总储蓄 / 住户部门可支配收入
```

分子和分母必须来自可比的住户部门国民经济核算口径。若使用居民人均可支配收入和居民人均消费支出自行计算，只能得到与该调查口径对应的近似比率，不能不加说明地称为官方住户部门储蓄率。

## 储蓄不是存款余额

**居民储蓄 ≠ 居民存款余额。** 储蓄是期间内收入减消费形成的流量；居民存款余额是某个时点在金融机构的存量。储蓄可以配置到现金、存款、基金、股票、保险、偿还债务或实物资产，存款余额也会受到过去积累、借款转存、账户转移、资产处置和其他部门资金流动影响。

同样，储蓄流量也不等于累积金融资产或家庭财富。金融资产和财富存量还会受资产价格、汇率、折旧、继承、赠与、负债和估值变化影响。存款增加不能单独证明当期居民储蓄率上升，储蓄率下降也不意味着存款余额必然下降。

## 名义、实际与口径

名义收入和名义消费相减得到的是当期价格下的储蓄流量；实际储蓄需要明确使用什么价格指数、基期和核算口径。住户部门总量、人均调查数据、城镇农村分组和家庭层面数据也不能直接互换。比较储蓄率时，应同时记录期限、分子分母、是否含养老金权益以及数据来源。

## 常见误区

- 用居民存款余额增速替代居民储蓄率。
- 把某一季度储蓄流量当成家庭财富增量。
- 把银行存款增加全部归因于当期收入未消费。
- 不区分调查口径与国民经济核算口径。

## 来源

- [国家统计局：五、国民经济核算（16）](https://www.stats.gov.cn/hd/cjwtjd/202302/t20230207_1902278.html)
- [OECD：Household savings forecast](https://www.oecd.org/en/data/indicators/household-savings-forecast.html)
