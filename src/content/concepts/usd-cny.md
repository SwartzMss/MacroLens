---
id: usd-cny
name: 人民币兑美元（USD/CNY）
subtitle: 境内人民币对美元价格，默认按每美元对应多少人民币报价
country: CN
category: exchange
source: 中国人民银行与中国外汇交易中心
definition: { source: 中国人民银行、中国外汇交易中心, asOf: '2026' }
updatedAt: 2026-08-31
related: [exchange-rate, rmb-exchange-rate-regime, cfets-rmb-index, foreign-exchange-reserves]
graph: macro
order: 3
level: basic
topics: [exchange-rates]
prerequisites: [exchange-rate]
featured: false
---

> 本页 USD/CNY 指境内人民币对美元汇率，按 `1 USD = x CNY` 报价。数值上升表示人民币兑美元贬值，数值下降表示人民币兑美元升值。

## 先读懂报价

`USD/CNY = 7.20` 表示 1 美元对应 7.20 元人民币。若从 7.10 升到 7.30，购买 1 美元需要更多人民币，因此人民币走弱。新闻中的“人民币汇率上涨”可能指人民币价值上涨，也可能指 USD/CNY 数值上涨，必须看原始货币对。

## 即期成交价与中间价

USD/CNY 即期价是境内市场实际交易价格。人民币对美元中间价由人民银行授权中国外汇交易中心在每个工作日公布，是当日交易基准。中间价不是当日每笔成交价，也不能与收盘即期价拼接成同一条没有说明的序列。

## CNY 与 CNH

CNY 是境内市场惯例，CNH 是离岸市场惯例。两者都表达人民币兑美元价格，但交易主体、流动性、时段和制度环境不同，可能暂时偏离。离岸 USD/CNH 不能静默替代境内 USD/CNY。

## 日内、收盘与期末观察

日内最高、最低、某一时点成交、收盘价和月末值回答的问题不同。比较时间序列时应固定观察口径，并说明时区、频率和取值方式。日内波动不等于月度趋势。

## 哪些因素会影响 USD/CNY

中美利率与预期、贸易和跨境收支、全球美元变化、风险偏好、企业结售汇及政策沟通都可能影响价格。单一变量和汇率之间通常不是稳定的一对一关系。

## 为什么不能直接预测出口

人民币兑美元走弱可能改善部分出口商的人民币折算收入，也可能提高进口投入和外币债务成本。合同币种、企业套期保值、海外需求、价格调整与供应链决定最终效果，因此不能推出出口或增长必然改善。

## 若未来添加图表

必须在中间价、境内即期收盘或其他明确观察中选择一种，标注 `CNY per USD`、频率、观察时点和来源。不得混入 CNH，也不得把中间价称为市场收盘价。

## 来源

- [中国外汇交易中心：人民币汇率中间价发布说明](https://www.chinamoney.com.cn/dqs/cm-s-notice-query/fileDownLoad.do?contentId=384571&mode=open&priority=0)
- [中国人民银行：《银行间外汇市场管理规定》](https://www.pbc.gov.cn/zhengwugongkai/attachDir/2025/12/2025122910541412031.pdf)
