# Structural Growth Framework Design

## Goal

为 MacroLens 增加一个结构性增长主题，解释生产率、人口结构、劳动供给和潜在产出如何帮助判断经济的长期可持续增长能力，同时把实际 GDP 增长、短期周期走弱与模型估计的潜在产出明确分开。

## Scope

新增五个稳定概念 ID：

| ID | 中文名称 | 主题 | 类别 | 学习前置 |
| --- | --- | --- | --- | --- |
| `productivity` | 劳动生产率 | `structural-growth`, `economic-activity` | `growth` | `gdp` |
| `total-factor-productivity` | 全要素生产率（TFP） | `structural-growth`, `economic-activity` | `growth` | `productivity` |
| `working-age-population` | 劳动年龄人口 | `structural-growth`, `labor-market` | `labor` | 无 |
| `demographic-dependency-ratio` | 人口抚养比 | `structural-growth`, `labor-market` | `labor` | `working-age-population` |
| `potential-output` | 潜在产出与潜在增长 | `structural-growth`, `economic-activity` | `growth` | `productivity`, `working-age-population`, `labor-force-participation` |

`output-gap` 保留现有概念 ID，但增加 `potential-output` 作为学习前置，使学习链落到已有的产出缺口页面。

新增 `structural-growth` 主题，放在 `economic-activity` 之后、`household-sector` 之前；主题说明应强调长期供给能力、人口结构和生产率，而不是短期需求周期。

首页保持不变。新概念不添加 chart，也不引入自动数据抓取或国家预测。

## Content boundaries

### Productivity

页面必须区分劳动生产率水平与劳动生产率增速，并说明劳动生产率通常以产出相对劳动投入衡量。产出、就业人数、工时和劳动报酬不是同一个分子或分母；跨行业、跨国家和跨时期比较必须注明实际产出、劳动投入、覆盖范围和价格口径。

页面还要说明劳动生产率上升不必然等于单个劳动者工资同步上升，也不能仅凭总产出增速判断生产率改善。

### Total-factor productivity

TFP 必须与劳动生产率明确区分：劳动生产率只相对某类劳动投入，TFP 则是在给定生产函数、资本与劳动投入及其权重后，对无法由投入增长直接解释的产出变化所作的残差或效率估计。

TFP 不是直接观察到的物理技术数量。它依赖生产函数、资本存量、劳动质量、要素权重、数据修订和识别假设，因此必须写成模型依赖、可估计、可修订；TFP 上升也不能直接断言某项具体技术造成了变化。

### Working-age population and dependency ratio

劳动年龄人口必须与劳动力、就业人口和劳动参与率分开：劳动年龄人口是年龄范围定义下的人口分母，劳动力是就业人口与失业人口之和，就业人口是处于就业状态的存量，劳动参与率是劳动力占劳动年龄人口的比重。年龄边界和调查范围可能因来源不同而变化。

人口抚养比用于描述人口年龄结构，不是财政抚养支出、家庭实际负担或劳动生产率的直接测量。人口老龄化、劳动年龄人口变化和劳动参与率变化可能通过不同渠道影响劳动供给，不能把人口减少写成 GDP 必然下降。

### Potential output

潜在产出是给定生产能力、通胀稳定或其他模型约束下的可持续产出水平；潜在增长是潜在产出的增长率。二者都不能直接观测，必须注明模型、样本、估计窗口和修订风险。

实际 GDP 增长回答已实现产出如何变化，潜在增长回答可持续供给能力如何变化。实际增长放缓可能是短期需求或库存周期走弱，也可能包含生产率、人口和劳动供给的长期结构性变化，不能仅凭一个季度的实际增速识别长期趋势。

潜在产出与产出缺口也要分开：产出缺口是实际产出相对估计潜在产出的偏离，常见表达为 `(实际产出 - 潜在产出) / 潜在产出 × 100%`。产出缺口继承潜在产出的模型不确定性，不能当成直接发布的官方 GDP 指标。

## Learning order

```text
GDP
 ↓
productivity
 ↓
total-factor-productivity

working-age-population ──→ labor-supply
labor-force-participation ─→ labor-supply

productivity + working-age-population + labor-force-participation
                         ↓
                 potential-output
                         ↓
                     output-gap
```

Prerequisites express the intended learning sequence rather than every semantic relationship. The existing `labor-force-participation → labor-supply` graph edge remains a measurement relation (`REFLECTS`); the new `working-age-population → labor-supply` edge represents a conditional influence (`AFFECTS`).

## Graph design

The five new concept pages and existing `output-gap` are indicator nodes. Add only these abstract nodes:

| Abstract ID | Label | Purpose |
| --- | --- | --- |
| `demographic-structure` | 人口结构 | receives the demographic composition measurement |
| `efficiency-and-technology-residual` | 效率与技术残差 | names the model-dependent TFP residual |
| `sustainable-growth-capacity` | 可持续增长能力 | names the capacity represented by potential output |
| `actual-vs-potential-output` | 实际与潜在产出对照 | names the comparison from which an output gap is derived |

The approved new relation triples are:

```text
working-age-population --AFFECTS--> labor-supply
productivity --AFFECTS--> potential-output
total-factor-productivity --REFLECTS--> efficiency-and-technology-residual
potential-output --AFFECTS--> sustainable-growth-capacity
output-gap --DERIVED_FROM--> actual-vs-potential-output
demographic-dependency-ratio --REFLECTS--> demographic-structure
```

No new `CAUSES` relation is allowed. The graph must keep observed or published indicators separate from abstract modeled mechanisms and measurement targets.

## Sources

Each page must cite an appropriate primary or methodological source before interpretation:

- National Bureau of Statistics materials for GDP, population, labor and national-accounts definitions;
- International Monetary Fund material for potential output, output gaps and productivity estimation limits;
- OECD productivity methodology where labor productivity and TFP measurement require additional detail;
- World Bank demographic indicator definitions where dependency-ratio terminology needs cross-source context;
- ILOSTAT or the existing National Bureau of Statistics labor-force methodology for participation and labor-supply boundaries.

## Regression contracts

Add structural-growth content tests that assert:

- all five IDs, names, categories, topics, levels, orders and prerequisites are stable;
- required terms cover level versus growth, labor productivity versus TFP, residual/model dependence/revision, working-age population versus labor force/employment/participation, demographic structure versus participation, actual versus potential growth, and cyclical versus structural slowdown;
- potential output and TFP are described as estimated, model-dependent and revisable;
- official source links exist and related IDs resolve;
- `structural-growth` is registered with unique metadata and the homepage remains curated.

Add structural-growth relation tests that assert:

- all indicator and abstract nodes exist with the intended `kind` distinction;
- the six approved triples are present exactly once;
- every relation uses a canonical relation type and resolves both endpoints;
- no relation involving the new cluster uses `CAUSES`.

The existing full suite must continue to pass with `npm test`, `npm run check`, and `npm run build`.

## Non-goals

This change does not add pension-system design, a full endogenous-growth theory survey, country forecasts, investment recommendations, automatic dataset ingestion, chart data, or a homepage redesign.
