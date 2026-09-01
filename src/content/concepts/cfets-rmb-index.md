---
id: cfets-rmb-index
name: CFETS 人民币汇率指数
subtitle: 衡量人民币相对一篮子货币价值的多边指数，不是另一个 USD/CNY
country: CN
category: exchange
source: 中国外汇交易中心
definition: { source: 中国外汇交易中心, asOf: 2026-01 }
updatedAt: 2026-08-31
related: [exchange-rate, usd-cny, rmb-exchange-rate-regime, foreign-exchange-reserves]
graph: macro
order: 4
level: advanced
topics: [exchange-rates]
prerequisites: []
featured: false
---

> CFETS 人民币汇率指数汇总人民币相对一篮子货币的变化，用于观察多边价值。指数点位不是“每美元多少人民币”。

## 它衡量什么

指数参考 CFETS 货币篮子，将人民币对多种篮子货币的双边汇率按权重汇总。指数上升通常表示人民币相对这组篮子货币整体走强，下降表示整体走弱；它不能直接读成升贬值百分比，除非明确计算相对变化。

## 为什么不同于 USD/CNY

USD/CNY 只比较人民币与美元，CFETS 指数同时考虑多种货币。美元可能对全球多种货币普遍走强，使人民币兑美元走弱，但人民币对其他篮子货币相对稳定甚至走强；反向情况也可能发生。

## 篮子和权重

中国外汇交易中心公布篮子构成、权重和算法。权重采用考虑转口贸易因素的贸易权重方法，并可能随贸易结构和规则调整。2025 年 12 月 31 日公布的新版采用 2024 年贸易数据调整权重，自 2026 年 1 月 1 日起生效。分析跨越调整点的历史数据时，应记录方法版本，不能假设所有时期篮子完全不变。

## 指数基准与点位

指数是相对基期的无量纲指标，不是 7.2 CNY/USD 这类可直接兑换的市场价格。比较时要看基准、发布日期和方法说明。指数从 100 到 102 表示相对基准的指数变化，不等于人民币对每一种篮子货币都升值 2%。

## 与 USD/CNY 的关系

美元在篮子和全球外汇市场中具有重要影响，两者常会相关，但不是同一个指标，也不存在固定换算。用 `CORRELATES` 描述其共变比把一方当作另一方组成项更稳妥。

## 常见误区

- 把指数点位当作双边汇率。
- 看到 USD/CNY 上升就断言 CFETS 指数必然下降。
- 忽略篮子权重和方法版本调整。
- 把指数点位变化直接称为同幅度百分比升贬值。

## 来源

- [中国外汇交易中心：《人民币汇率指数算法说明 v1.4》](https://www.chinamoney.com.cn/chinese/zxpl/20211231/2276204.html)
- [中国外汇交易中心：《关于调整 CFETS 人民币汇率指数、BIS 货币篮子人民币汇率指数货币篮子和权重的公告》（2025 年 12 月 31 日发布，2026 年 1 月 1 日生效）](https://www.chinamoney.com.cn/dqs/rest/cm-s-security/dealPath?cp=zxpl&path=Jnw5ofpjlbE%253DuZ9TuHgZHBAAf1R6YB58X8wnHcWN2ZBANiGVmKdotTDJ5IU%252Bv28k9LapeMkbRGOz%252F4w98v7X5aDxKqu7zVqQiA%253D%253D&sign=Q%2Fd8solfMh3GOoMI5WmGUaZA1ukiCpO5sMwap9ByMZnt4tsJZeSkX6Wq1v3lRrKsnQLcWdAPun00%0ALsYa5AtcTZpCs2CvuKf8xTKL5JKkAphGIIEbpsADAhjeg2dCZIBVMUOFd2LaiLvRLJLML9AfJTc%2F%0AI44XV2MvFkyyEBuTLsA%3D%0A&ut=gmHKE0%2BS3B%2FcwRC50Qngm7yln6mNRiJ7IRJhsVCyeP%2Bmp6iyzd0CK832DOfWGQywHXoUpkWU1NQ5%0A2589GVb9C4jHBMITPiOOCUIiiH4LNq4B7ZeE1tjKxOKY0tEINxjcxScKYzlRA7q64xxZRdlv%2Fgn9%0AtXmWUecDvNUPbgRRu6M%3D%0A)
