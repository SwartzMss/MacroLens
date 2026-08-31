---
id: effective-exchange-rate
name: 有效汇率（NEER / REER）
subtitle: 汇总本币相对一篮子货币变化的多边指数，并可进一步纳入相对价格
country: CN
category: external
source: 国际清算银行与中国外汇交易中心
definition: { source: BIS effective exchange rates methodology, asOf: 2026-08 }
updatedAt: 2026-08-31
related: [exchange-rate, usd-cny, cfets-rmb-index, current-account]
graph: macro
order: 5
---

> 名义有效汇率（NEER）和实际有效汇率（REER）是多边指数，不是人民币兑美元等双边汇率。不同提供者的篮子、权重、价格指标和基期可能不同。

## NEER 衡量什么

NEER 将本币对多个贸易伙伴货币的双边名义汇率按贸易权重汇总，用一个指数概括多边名义价值。以 BIS 为例，指数采用几何加权，并通过随时间变化的制造业贸易权重考虑直接贸易和第三方市场竞争。

## REER 如何扩展 NEER

REER 在名义有效汇率基础上纳入本经济体与贸易伙伴之间的相对价格或成本变化；BIS 公布的 REER 使用居民消费价格指数（CPI）调整。可以概念性理解为“NEER 经相对价格调整”，但不是一条通用算术公式：提供者可能采用不同价格指标、权重、覆盖经济体和归一化方法。

## 与 USD/CNY、CFETS 的区别

USD/CNY 是每美元对应多少人民币的双边价格；CFETS 人民币汇率指数是中国外汇交易中心按其货币篮子和规则编制的多边指数；BIS NEER 和 REER 则使用 BIS 的跨经济体统一方法。它们可能相关，但篮子、用途与计算方法不同，不能固定换算。

## 指数点位与变化率

有效汇率通常以某个基期等于 100 表示。指数点位本身没有兑换含义，从 100 到 102 才可据此计算相对变化。分析跨来源数据时，要先确认基期、频率、宽口径或窄口径篮子以及方法版本，不能因为两个指数都等于 100 就认为价值相同。

## 如何判断方向

在 BIS 当前约定下，NEER 上升表示名义有效升值，REER 上升表示实际有效升值；其他来源仍应核对方向说明。人民币兑美元贬值时，对一篮子货币的 NEER 或 CFETS 指数不一定同幅下降。

## REER 与竞争力

REER 常被用作国际价格或成本竞争力的汇总指标，但 REER 升值不等于竞争力按同一百分比恶化。企业利润率、生产率、产品质量、供应链、合同货币、需求结构和非价格因素都会影响出口表现。

## 宏观传导

有效汇率变化会影响相对价格、进口成本、外币收入折算与需求转移，但传导具有时滞且受价格调整和政策反应影响。不能从 REER 上升机械推出出口或经济活动必然下降。

## 为什么本页暂不放图

BIS 提供语义清晰的人民币 NEER 与 REER 序列，但接入前需要把提供者、宽窄口径、频率、基期和更新方式写入数据注册表。本批先建立概念边界，不手工复制一段容易过期的指数。

## 常见误区

- 把 NEER 或 REER 点位读成双边兑换价格。
- 把 USD/CNY、CFETS 指数和 BIS 有效汇率视为同一序列。
- 忽略贸易权重、相对价格指标、基期和方法版本。
- 把指数点位差直接称为百分点或货币升贬值幅度。
- 认为 REER 上升必然造成出口同比例下降。

## 来源

- [BIS Data Portal：Effective exchange rates](https://data.bis.org/topics/EER)
- [BIS：About exchange rate statistics](https://www.bis.org/statistics/dataportal/exr.htm)
- [中国外汇交易中心：人民币汇率指数算法说明 v1.4](https://www.chinamoney.com.cn/chinese/zxpl/20211231/2276204.html)
