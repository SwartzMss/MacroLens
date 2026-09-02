---
id: output-gap
name: 产出缺口
subtitle: 实际产出相对潜在产出的估计偏离，不是直接观测的官方 GDP 指标
country: CN
category: growth
source: 国际货币基金组织与国家统计局
definition: { source: IMF output-gap methodology and NBS GDP, asOf: 2026-08 }
updatedAt: 2026-08-31
related: [gdp, potential-output, capacity-utilization, unemployment-rate, cpi]
graph: macro
order: 6
level: advanced
topics: [economic-activity,structural-growth]
prerequisites: [potential-output]
featured: false
---

> 产出缺口描述实际产出相对潜在产出的偏离，用于判断经济闲置或需求压力；潜在产出无法直接观测，所以它始终是模型估计，不是另一套 GDP 统计。

## 定义与符号

常见定义是 `(实际产出－潜在产出) / 潜在产出 × 100%`，即偏离占潜在产出的比重。正值表示实际产出高于估计的可持续水平，负值表示存在闲置。但潜在产出会随资本、劳动、生产率及模型设定改变。

## 如何估计

常用方法包括只利用产出路径的统计滤波、拆解资本劳动与生产率的生产函数，以及同时利用通胀、失业等信息的多变量模型。不同方法回答的问题和约束不同，结果不应被视为唯一真值。

## 实时判断为何困难

实时估计只能使用当时可得的数据，GDP 后续修订、样本终点与结构变化都会反过来改变历史缺口。因此最新一期通常最不稳定，跨机构结果也可能明显不同。

## 中国数据边界

国家统计局发布官方GDP，但并未在常规 GDP 发布中给出一条同等地位的官方潜在产出或产出缺口。本页只能解释框架与引用具体机构估计，不能据此创建一条中国官方产出缺口序列。

## 常见误区

- 负缺口不表示 GDP 必然下降，只表示低于估计的潜在水平。
- 正缺口提示需求压力的可能性，不自动证明通胀或经济过热。
- 修订后的历史估计不能当成决策当时已经掌握的信息。

## 来源

- IMF，Output Gaps：https://www.imf.org/external/Pubs/FT/fandd/basics/pdf/jahan_output.pdf
- 国家统计局，数据发布：https://www.stats.gov.cn/sj/zxfb/
