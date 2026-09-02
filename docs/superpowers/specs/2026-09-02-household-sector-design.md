# Household Sector Framework Design

**Date:** 2026-09-02  
**Issue:** #41  
**Status:** Approved for implementation

## Goal

Add a coherent household-sector learning path connecting labor income, disposable income, consumption, saving, propensity to consume, and income expectations while preserving the distinction between household surveys, national accounts, retail-sales data, deposits, and wealth.

## Chosen approach

Add a first-class `household-sector` topic rather than scattering the five concepts across labor and economic-activity pages. The topic will use the existing `growth` category and order `55`, between `economic-activity` (`50`) and `fiscal-policy` (`60`). Each new page will also carry secondary topic membership where it improves discovery:

| Concept | Primary topic | Secondary topics | Prerequisites |
| --- | --- | --- | --- |
| `disposable-income` | household-sector | labor-market, economic-activity | `wages` |
| `income-expectations` | household-sector | labor-market, economic-activity | `disposable-income` |
| `household-consumption` | household-sector | economic-activity | `disposable-income`, `income-expectations` |
| `household-saving-rate` | household-sector | economic-activity, market-rates | `disposable-income`, `household-consumption` |
| `propensity-to-consume` | household-sector | economic-activity | `household-consumption` |

The prerequisite graph is acyclic and expresses learning order. Graph relations remain separate from prerequisites: an economic relationship does not automatically mean the source must be learned first.

## Content boundaries

Each page will use the existing static concept-page schema and official-source style, with no charts or data ingestion.

- `disposable-income`: define resident per-capita disposable income from the NBS household survey; explain wage income, net operating income, property income, and transfer income; distinguish it from wages/labor compensation and from household-sector disposable income in national accounts; cover nominal/real and per-capita/aggregate boundaries.
- `household-consumption`: define resident per-capita consumption expenditure from the household survey; distinguish it from household final consumption expenditure in national accounts and explicitly state `社会消费品零售总额 ≠ 居民消费支出`; cover goods/services, domestic/overseas consumption, nominal/real, and per-capita/aggregate boundaries.
- `household-saving-rate`: define saving as an income-flow residual and state the NBS national-accounts formula `住户部门总储蓄 = 住户部门可支配收入 − 居民消费支出`; distinguish `居民储蓄 ≠ 居民存款余额`, saving flow from deposits and accumulated financial assets/wealth, and explain numerator/denominator and nominal/real caveats.
- `propensity-to-consume`: distinguish average propensity (`C / disposable income`) from marginal propensity (`ΔC / ΔY`); explain that consumption level, ratio, and incremental response are different objects and that ratios depend on nominal/real and per-capita/aggregate choices.
- `income-expectations`: define household expectations as forward-looking beliefs rather than realized income or a single official income-growth forecast; explain survey question design, horizon, distribution, revisions, and how expectations may influence consumption without deterministic behavioral claims.

## Graph model

Use indicator nodes for all five concept pages and abstract mechanism nodes for household conditions and behavior:

```text
wages       ──AFFECTS──┐
employment  ──AFFECTS──┴─→ household-income-conditions
                              ↑ REFLECTS
                    disposable-income
                              │ AFFECTS
income-expectations ──────────┴─→ household-consumption
                                      │ COMPONENT_OF
                                      ↓
                               economic-activity

real-interest-rate ──AFFECTS──→ saving-consumption-choice
household-saving-rate ──REFLECTS──→ household-saving-behavior
household-consumption ──REFLECTS──→ household-consumption-behavior
propensity-to-consume ──REFLECTS──→ household-consumption-behavior
```

The graph will retain the existing `retail-sales → consumption-activity (REFLECTS)` relation and will not turn retail sales into household consumption. No `CAUSES` edge will be introduced. The selected `AFFECTS` edges describe conditional mechanisms, not fixed elasticities or deterministic outcomes.

## Files and tests

Production content and metadata:

- Create five Markdown concept pages under `src/content/concepts/`.
- Modify `src/data/topics.ts` to register `household-sector`.
- Modify `data/relations/macro.json` with the five indicator nodes, abstract nodes, and approved relations.
- Leave `src/pages/index.astro` unchanged.

Regression contracts:

- Add a dedicated household-sector content test for stable IDs, metadata, topic membership, prerequisites, official source links, and the required statistical distinctions.
- Add a relation test that verifies every new node resolves, relations are unique/canonical, the approved measurement/mechanism edges exist, existing retail-sales coverage remains, and no new `CAUSES` edge is added.
- Extend topic/IA tests to verify topic uniqueness, ordering, and household topic registration.
- Use the existing catalog validation to enforce prerequisite existence and acyclicity.

Primary sources to cite in the pages include:

- NBS, “什么是居民人均可支配收入”: https://www.stats.gov.cn/zs/tjws/tjzb/202301/t20230101_1903384.html
- NBS, “居民人均可支配收入的基础数据来源”: https://www.stats.gov.cn/zs/tjws/zytjzbqs/jmrj/202501/t20250121_1958392.html
- NBS, “国民经济核算”: https://www.stats.gov.cn/sj/zbjs/202302/t20230202_1897108.html
- NBS, “五、国民经济核算（16）”: https://www.stats.gov.cn/hd/cjwtjd/202302/t20230207_1902278.html
- NBS, “2025年居民收入和消费支出情况”: https://www.stats.gov.cn/sj/zxfb/202601/t20260119_1962321.html
- PBOC, “金融机构人民币信贷收支表”: https://www.pbc.gov.cn/eportal/fileDir/diaochatongjisi/resource/cms/2025/01/2025011417071510290.htm
- OECD, “Household savings forecast”: https://www.oecd.org/en/data/indicators/household-savings-forecast.html

## Non-goals

Do not redesign the homepage, add APIs or databases, ingest household microdata, fetch data automatically, give investment advice, or encode deterministic behavioral models.

## Validation

Before opening the PR, run `npm test`, `npm run check`, `npm run build`, and `git diff --check`. The PR description will link Issue #41 and summarize the topic, concept pages, graph contracts, and explicit statistical boundaries.
