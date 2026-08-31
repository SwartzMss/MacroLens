---
id: interest-rate-parity
name: 利率平价（CIP / UIP）
subtitle: 连接利率、即期汇率与远期汇率的两类跨货币定价关系
country: CN
category: exchange
source: 国际清算银行与国际货币基金组织
definition: { source: BIS cross-currency pricing methodology, asOf: 2026-08 }
updatedAt: 2026-08-31
related: [exchange-rate, usd-cny, usd-cnh, carry-trade]
graph: macro
order: 7
---

> “利率平价”至少要拆成有套期保值的 CIP 和无套期保值的 UIP，不能把两者当作同一条预测公式。

## CIP：有套期保值的无套利关系

Covered interest parity（CIP）把两种货币的利率、即期汇率和远期汇率联系起来。投资者用远期合约锁定换回本币的汇率时，如果市场无摩擦且不存在套利机会，远期汇率应与利差相容。实际市场还会出现流动性、抵押品、监管和信用因素造成的跨货币基差，因此观察到偏离不等于可以无风险获利。

## UIP：无套期保值的经验关系

Uncovered interest parity（UIP）不使用远期合约锁定汇率，而是把利差与未来即期汇率的预期变化联系起来。它是理论和经验研究中的关系，预期会受风险溢价、意外冲击和行为因素影响，不能保证短期预测，也不应把较高名义利率直接解释成确定的汇率贬值。

## 阅读顺序

先确认利率和汇率的期限、报价方向、是否有远期或掉期套期保值，再区分 CIP 的无套利定价与 UIP 的预期关系。跨市场比较还要说明资金成本、抵押品、交易时点和基差口径。

## 来源

- [国际清算银行：Covered interest parity lost](https://www.bis.org/publ/qtrpdf/r_qt1809e.htm)
- [国际货币基金组织：Uncovered Interest Parity](https://www.imf.org/en/publications/wp/issues/2016/12/31/uncovered-interest-parity-19096)
