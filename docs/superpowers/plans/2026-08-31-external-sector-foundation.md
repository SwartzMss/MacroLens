# External-Sector Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `external` category, five source-grounded external-sector concept pages, and their canonical relationship context without adding charts.

**Architecture:** Keep the existing Astro content architecture: category validation lives in `src/data/categories.ts`, concepts are Markdown collection entries, and typed relationships live in `data/relations/macro.json`. Add focused Node contract tests that exercise the category module and repository content before running Astro's full content, route, and Pagefind integration checks.

**Tech Stack:** Astro 5, TypeScript, Markdown content collections, JSON relationship data, Node 22 built-in test runner, Pagefind.

---

## File Map

- Modify `src/data/categories.ts`: register the `external` category and type.
- Create `src/content/concepts/balance-of-payments.md`: BPM6 statement structure, residence, flow/position, transaction/valuation, and sign conventions.
- Create `src/content/concepts/current-account.md`: current-account components and SAFE-versus-Customs scope.
- Create `src/content/concepts/financial-account.md`: financial-account functional categories, assets/liabilities, gross/net, and signs.
- Create `src/content/concepts/cross-border-capital-flows.md`: analytical umbrella and dataset-specific interpretation.
- Create `src/content/concepts/effective-exchange-rate.md`: bilateral, CFETS, NEER, and REER distinctions.
- Modify `data/relations/macro.json`: add five concept nodes, two abstract nodes, and ten canonical edges.
- Create `tests/external-sector-content.test.mjs`: category and page-content contracts.
- Create `tests/external-sector-relations.test.mjs`: graph node and edge contracts.

### Task 1: Register the External Category

**Files:**
- Create: `tests/external-sector-content.test.mjs`
- Modify: `src/data/categories.ts`

- [ ] **Step 1: Write the failing category contract**

Create `tests/external-sector-content.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { categories, categoryIds } from '../src/data/categories.ts';

test('registers external as the category after exchange', () => {
  assert.equal(categoryIds.at(-1), 'external');
  assert.deepEqual(categories.external, {
    label: '外部部门',
    description: '理解国际收支、跨境资金流动与一国对外经济联系。',
    order: 70,
  });
  assert.ok(categories.external.order > categories.exchange.order);
});
```

- [ ] **Step 2: Run the contract and verify RED**

Run:

```bash
node --test --experimental-strip-types tests/external-sector-content.test.mjs
```

Expected: FAIL because `categoryIds.at(-1)` is still `exchange` and `categories.external` is absent.

- [ ] **Step 3: Add the minimal category implementation**

Change `src/data/categories.ts` to:

```ts
export const categoryIds = ['money', 'policy', 'credit', 'inflation', 'growth', 'fiscal', 'exchange', 'external'] as const;
export type CategoryId = typeof categoryIds[number];

export const categories: Record<CategoryId, { label: string; description: string; order: number }> = {
  money: { label: '货币', description: '从流通中货币到广义货币，理解不同层次的“钱”。', order: 10 },
  policy: { label: '货币政策', description: '理解政策目标、工具操作与金融条件之间的传导。', order: 15 },
  credit: { label: '信用与融资', description: '理解贷款、社会融资与利率如何连接金融体系和实体经济。', order: 20 },
  inflation: { label: '通胀', description: '观察价格水平、成本与购买力的变化。', order: 30 },
  growth: { label: '经济增长', description: '理解产出、需求与经济周期。', order: 40 },
  fiscal: { label: '财政', description: '理解政府收支、债务与宏观调节。', order: 50 },
  exchange: { label: '汇率', description: '理解货币之间的相对价格与跨境传导。', order: 60 },
  external: { label: '外部部门', description: '理解国际收支、跨境资金流动与一国对外经济联系。', order: 70 },
};

export function getCategory(id: CategoryId) {
  return categories[id];
}
```

- [ ] **Step 4: Run the category contract and verify GREEN**

Run:

```bash
node --test --experimental-strip-types tests/external-sector-content.test.mjs
```

Expected: PASS, 1 test.

- [ ] **Step 5: Commit the category slice**

```bash
git add tests/external-sector-content.test.mjs src/data/categories.ts
git commit -m "feat: register external sector category"
```

### Task 2: Add Balance-of-Payments and Current-Account Pages

**Files:**
- Modify: `tests/external-sector-content.test.mjs`
- Create: `src/content/concepts/balance-of-payments.md`
- Create: `src/content/concepts/current-account.md`

- [ ] **Step 1: Add failing semantic contracts for both account pages**

Add these imports and helpers after the existing imports in `tests/external-sector-content.test.mjs`:

```js
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const conceptDirectory = fileURLToPath(new URL('../src/content/concepts/', import.meta.url));

function readConcept(id) {
  const path = `${conceptDirectory}/${id}.md`;
  assert.ok(existsSync(path), `${id} concept page is missing`);
  return readFileSync(path, 'utf8');
}

function assertConcept(id, order, terms, sourceUrls) {
  const document = readConcept(id);
  assert.match(document, new RegExp(`^id: ${id}$`, 'm'));
  assert.match(document, /^category: external$/m);
  assert.match(document, /^graph: macro$/m);
  assert.match(document, new RegExp(`^order: ${order}$`, 'm'));
  assert.doesNotMatch(document, /^chart:/m);
  for (const term of terms) assert.ok(document.includes(term), `${id} must explain ${term}`);
  for (const url of sourceUrls) assert.ok(document.includes(url), `${id} must cite ${url}`);
}
```

Append these tests:

```js
test('balance-of-payments teaches the complete BPM6 accounting structure', () => {
  assertConcept('balance-of-payments', 1, [
    '居民与非居民', '国籍', '某一期间', '国际投资头寸', '估值变化',
    '经常账户', '资本账户', '金融账户', '净误差与遗漏',
    '净获得金融资产', '净发生负债', '会计恒等',
  ], [
    'https://www.safe.gov.cn/safe/2015/1230/6080.html',
    'https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm',
  ]);
});

test('current-account separates BOP flows from customs trade data', () => {
  assertConcept('current-account', 2, [
    '货物和服务', '初次收入', '二次收入', '海关', '经济所有权',
    '离岸价格', '季度或年度流量', '并不保证人民币升值',
  ], [
    'https://www.safe.gov.cn/safe/2015/1230/6080.html',
    'https://www.safe.gov.cn/safe/zggjszphb/index.html',
  ]);
});
```

- [ ] **Step 2: Run the contracts and verify RED**

Run:

```bash
node --test --experimental-strip-types tests/external-sector-content.test.mjs
```

Expected: the category contract passes; the two new tests FAIL with the explicit “concept page is missing” assertion.

- [ ] **Step 3: Create the balance-of-payments page**

Create `src/content/concepts/balance-of-payments.md`:

```markdown
---
id: balance-of-payments
name: 国际收支
subtitle: 记录居民与非居民在某一期间经济交易的统计报表，不是外部资产负债存量表
country: CN
category: external
source: 国家外汇管理局与国际货币基金组织
definition: { source: SAFE 与 IMF BPM6, asOf: 2026-08 }
updatedAt: 2026-08-31
related: [current-account, financial-account, cross-border-capital-flows, foreign-exchange-reserves]
graph: macro
order: 1
---

> 国际收支平衡表记录一个经济体的居民与非居民在某一期间发生的经济交易。这里的居民按经济利益中心判断，不等于公民身份或国籍。

## BPM6 的账户结构

按照 IMF《国际收支和国际投资头寸手册》第六版（BPM6），国际收支包括经常账户、资本账户、金融账户以及净误差与遗漏。经常账户记录货物和服务、初次收入与二次收入；资本账户记录资本转移和非生产非金融资产的取得或处置，规模通常远小于经常账户和金融账户；金融账户记录金融资产和负债交易。资本账户与金融账户是两个账户，不能把旧式口语“资本和金融账户”误读成一个 BPM6 账户。

## 居民不是国籍

国际收支按居民与非居民划分交易双方，核心是机构或个人的经济利益中心，而非护照。外国企业在境内的常设经营实体可能是本经济体居民；本国企业在境外的长期经营实体可能是非居民。

## 流量不是头寸

国际收支记录某一期间的交易流量，季度数和年度数回答“这段期间发生了多少交易”。国际投资头寸（IIP）记录某一时点的对外金融资产和负债存量。期末头寸变化除交易外，还可能来自汇率、资产价格等估值变化以及其他数量调整，因此不能用国际收支流量直接还原全部存量变化。

## 金融账户符号要跟随来源

BPM6 用“净获得金融资产”和“净发生负债”描述金融账户两侧，分析式通常以净获得金融资产减净发生负债得到金融账户差额。SAFE 的发布表可能按便于国内使用的符号展示资产增加和负债增加，其他数据库也可能移动项目或反转符号。读数前必须查看表头、指标说明与等式约定，不能脱离来源把正数简单称为“资金流入”。

## 为什么账面平衡不等于没有失衡

复式记账要求每笔交易有对应记录，净误差与遗漏吸收不同数据来源、时间和估计造成的统计差异。会计恒等说明账目如何闭合，不表示贸易、融资或资产负债结构没有宏观风险，也不能在忽略资本账户、净误差与遗漏和符号约定时写成“经常账户 + 金融账户 = 0”。

## 如何阅读

先确认期间、币种、单位和是否为初步值，再分别看账户组成与符号说明。比较季度和年度数据时不要把流量与期末存量混在同一尺度；分析储备时还要区分金融账户中的储备资产交易与月末外汇储备余额及其估值变化。

## 常见误区

- 把居民等同于本国公民。
- 把资本账户和金融账户合并成一个 BPM6 账户。
- 把国际收支流量当作国际投资头寸存量。
- 把统计上的账面平衡理解为经济上不存在外部失衡。
- 不检查来源符号就把金融账户正负值翻译成流入或流出。

## 来源

- [国家外汇管理局：国际收支平衡表编制原则与指标说明](https://www.safe.gov.cn/safe/2015/1230/6080.html)
- [国家外汇管理局：中国国际收支平衡表](https://www.safe.gov.cn/safe/zggjszphb/index.html)
- [IMF：Balance of Payments and International Investment Position Manual, Sixth Edition](https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm)
```

- [ ] **Step 4: Create the current-account page**

Create `src/content/concepts/current-account.md`:

```markdown
---
id: current-account
name: 经常账户
subtitle: 汇总货物和服务、初次收入与二次收入的跨境交易流量
country: CN
category: external
source: 国家外汇管理局与国际货币基金组织
definition: { source: SAFE 与 IMF BPM6, asOf: 2026-08 }
updatedAt: 2026-08-31
related: [balance-of-payments, financial-account, cross-border-capital-flows, exchange-rate]
graph: macro
order: 2
---

> 经常账户是国际收支的一部分，由货物和服务、初次收入、二次收入组成。它不是“出口减进口”的完整同义词。

## 三个组成部分

货物和服务记录居民与非居民之间的相关交易；初次收入包括劳动报酬、投资收益等因提供劳动或资本获得的收入；二次收入记录不伴随对应经济价值交换的经常转移。经常账户差额是这些项目共同作用的结果。

## 经常账户不等于货物贸易差额

即使货物顺差较大，服务逆差、对外支付的投资收益或二次收入也会改变经常账户余额。反过来，货物差额较小也不代表经常账户其他项目没有重要贡献。因此“经常账户顺差 = 出口减进口”遗漏了服务与收入项目。

## SAFE 与海关数据回答不同问题

海关统计关注跨境进出口报关货物；国际收支货物统计关注居民与非居民之间经济所有权转移。两者还可能在计价和调整上不同：国际收支原则上按离岸价格记录货物，并对国际运保费、转手买卖等作统计处理。分析中国数据时应明确使用 SAFE 国际收支口径还是海关口径，不能静默拼接。

## 如何阅读余额

经常账户是季度或年度流量。先核对期间、币种、单位、初步或修订状态，再看总差额背后的货物、服务、初次收入和二次收入贡献。顺差表示该口径下贷方记录合计高于借方记录合计，但不等于同期获得了同额外汇储备。

## 与汇率的联系

经常账户会影响跨境外汇供求，汇率和国内外需求也会反过来影响贸易与收入，但合同币种、价格调整、全球周期、金融流量和政策反应都会改变结果。经常账户顺差并不保证人民币升值，也不能单独解释某一阶段的汇率变化。

## 常见误区

- 把经常账户余额直接写成商品出口减商品进口。
- 把海关进出口差额当作 SAFE 经常账户差额。
- 把季度或年度流量与某一时点的外部资产存量比较。
- 认为货物顺差必然形成同等规模的经常账户顺差。
- 认为经常账户顺差必然导致货币升值。

## 来源

- [国家外汇管理局：国际收支平衡表编制原则与指标说明](https://www.safe.gov.cn/safe/2015/1230/6080.html)
- [国家外汇管理局：中国国际收支平衡表](https://www.safe.gov.cn/safe/zggjszphb/index.html)
- [IMF BPM6：Goods and Services、Primary Income、Secondary Income](https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm)
```

- [ ] **Step 5: Run the contracts and verify GREEN**

Run:

```bash
node --test --experimental-strip-types tests/external-sector-content.test.mjs
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Commit the account-foundation slice**

```bash
git add tests/external-sector-content.test.mjs src/content/concepts/balance-of-payments.md src/content/concepts/current-account.md
git commit -m "feat: add balance of payments concepts"
```

### Task 3: Add Financial-Account and Capital-Flow Pages

**Files:**
- Modify: `tests/external-sector-content.test.mjs`
- Create: `src/content/concepts/financial-account.md`
- Create: `src/content/concepts/cross-border-capital-flows.md`

- [ ] **Step 1: Add failing semantic contracts**

Append to `tests/external-sector-content.test.mjs`:

```js
test('financial-account explains functional categories, balance sides, and signs', () => {
  assertConcept('financial-account', 3, [
    '直接投资', '证券投资', '金融衍生工具', '其他投资', '储备资产',
    '资本账户', '净获得金融资产', '净发生负债', '总流量', '估值变化',
  ], [
    'https://www.safe.gov.cn/safe/2015/1230/6080.html',
    'https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm',
  ]);
});

test('cross-border-capital-flows names the dataset before interpreting a flow', () => {
  assertConcept('cross-border-capital-flows', 4, [
    '分析性总称', '国际收支金融账户', '直接投资', '证券投资',
    '银行结售汇', '银行代客涉外收付款', '总流入', '总流出',
    '净流量', '居民增加境外资产', '非居民增加境内负债',
  ], [
    'https://www.safe.gov.cn/safe/2018/0419/8806.html',
    'https://www.safe.gov.cn/safe/zggjszphb/index.html',
  ]);
});
```

- [ ] **Step 2: Run the contracts and verify RED**

Run:

```bash
node --test --experimental-strip-types tests/external-sector-content.test.mjs
```

Expected: the first 3 tests pass; the two new tests FAIL because their pages are missing.

- [ ] **Step 3: Create the financial-account page**

Create `src/content/concepts/financial-account.md`:

```markdown
---
id: financial-account
name: 金融账户
subtitle: 记录居民与非居民金融资产和负债交易，读正负号前必须确认列示方法
country: CN
category: external
source: 国家外汇管理局与国际货币基金组织
definition: { source: SAFE 与 IMF BPM6, asOf: 2026-08 }
updatedAt: 2026-08-31
related: [balance-of-payments, current-account, cross-border-capital-flows, foreign-exchange-reserves]
graph: macro
order: 3
---

> 金融账户记录居民与非居民之间涉及金融资产和负债的交易。它与 BPM6 中规模通常较小的资本账户不同，不能把二者混为一项。

## 五类功能分类

金融账户按经济关系和工具用途分为直接投资、证券投资、金融衍生工具、其他投资和储备资产。直接投资强调投资者对企业的控制或重要影响；证券投资主要覆盖不构成直接投资的可交易股债等工具；其他投资包括贷款、存款、贸易信贷等；储备资产由货币当局控制并满足相应可用性条件。

## 资产侧与负债侧

BPM6 分别记录居民净获得金融资产和居民对非居民净发生负债。居民购买境外证券属于资产侧交易，非居民购买境内证券属于负债侧交易。两者可能同时扩大，因此一个净差额不能代替总流量，也不能回答所有“钱进来还是出去”的问题。

## 总流量与净差额

总流入、总流出分别保留两侧规模，净流量则将方向相反的交易轧差。相同的净额可能来自很小的双向交易，也可能来自巨大的流入与流出相抵，风险和市场含义并不相同。

## 符号约定不是直觉语言

IMF 框架以净获得金融资产和净发生负债组织金融账户，BPM6 分析式通常用前者减后者表示金融账户差额：差额为正一般对应对外净借出，为负一般对应对外净借入。SAFE 的指标说明对发布表采用资产净增加记负、负债净增加记正的列示；其他来源也可能重新排列项目。必须先写明所用表格的符号，才能把余额解释为净借出、净借入或某类资金方向。

## 交易不等于头寸变化

金融账户记录期间交易。对外金融资产负债的期末存量还会受汇率和市场价格等估值变化、核销与分类调整影响。外汇储备余额变化也不能与金融账户中的储备资产交易一对一对应。

## 直接投资不等于证券投资

直接投资反映控制或重要影响关系，并包括股权、再投资收益和关联企业债务等；证券投资强调可交易工具且不满足直接投资关系。二者的期限、决策机制和统计分类不同，不能只按“长期、短期资金”粗略替代。

## 常见误区

- 把金融账户称作 BPM6 的资本账户。
- 看到正数就直接称为资本流入。
- 只看净差额而忽略资产、负债和总流量。
- 把交易流量当作外部资产头寸的全部变化。
- 把直接投资与证券市场资金流混为同一类。

## 来源

- [国家外汇管理局：国际收支平衡表编制原则与指标说明](https://www.safe.gov.cn/safe/2015/1230/6080.html)
- [国家外汇管理局：中国国际收支平衡表](https://www.safe.gov.cn/safe/zggjszphb/index.html)
- [IMF BPM6：Chapter 8, Financial Account](https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm)
```

- [ ] **Step 4: Create the cross-border-capital-flows page**

Create `src/content/concepts/cross-border-capital-flows.md`:

```markdown
---
id: cross-border-capital-flows
name: 跨境资本流动
subtitle: 对多类跨境金融交易的分析性总称，不是一条统一口径的官方指标
country: CN
category: external
source: 国家外汇管理局与国际货币基金组织
definition: { source: SAFE 与 IMF BPM6, asOf: 2026-08 }
updatedAt: 2026-08-31
related: [financial-account, balance-of-payments, current-account, exchange-rate, foreign-exchange-reserves]
graph: macro
order: 4
---

> “跨境资本流动”是分析性总称。新闻或研究必须先说明采用国际收支金融账户、直接投资、证券投资、银行收付还是结售汇等哪一套数据。

## 可能指哪些统计

常见口径包括国际收支金融账户交易、直接投资流量、证券投资流量、银行贷款和存款等其他投资、证券市场互联互通代理指标、银行结售汇，以及银行代客涉外收付款。它们覆盖主体、交易、币种、确认时点和计量原则不同，不能静默合成一条“资本流动”序列。

## 中国常见数据口径

SAFE 的国际收支金融账户按居民与非居民及权责发生制框架记录交易；银行代客涉外收付款侧重境内非银行部门通过银行与非居民发生的收付，按资金实际收付时点统计；银行结售汇记录人民币与外汇兑换行为。涉外收付不等于结售汇，二者也都不等于完整国际收支金融账户。

## 总流入、总流出与净流量

总流入可指非居民增加对本经济体的金融资产或居民发生对外负债，总流出可指居民增加境外资产或对外负债减少；具体命名仍要跟随数据集。净流量把两个方向轧差，会隐藏双向交易规模。解释时应同时说明资产侧、负债侧、总额和净额。

## 流量不是存量

跨境交易是期间流量；境外资产、对外负债和外汇储备是时点存量。存量变化还包含估值变化和其他调整。资本流出不必导致外汇储备按同额下降，因为交易主体、融资方式、汇率折算、资产价格和官方操作都可能不同。

## 与汇率和融资条件

跨境金融交易会影响外汇供求、资产价格和融资条件，汇率预期、利差、风险偏好与政策变化也会影响交易方向。这是双向、状态依赖的传导，不意味着资本流入必然推高股市，或资本流出必然压低人民币。

## 如何阅读一条标题

看到“资金净流入”时，依次确认数据发布者、统计名称、覆盖主体、资产或负债侧、总额或净额、币种、期间和是否经估值调整。若标题没有给出底层统计，就不能与另一篇报道中的“资本流动”直接比较。

## 为什么本页不放图

目前没有一条可无歧义代表全部中国跨境资本流动的序列。本页不制作自定义综合指标；未来添加图表时必须把具体数据集名称、覆盖范围、频率、单位和符号写入图表定义。

## 常见误区

- 把银行结售汇差额当作完整资本流动。
- 把银行代客涉外收付款当作国际收支金融账户总额。
- 只报净流量而不说明相抵的总流入和总流出。
- 把居民增加境外资产与非居民减少境内负债视为同一种行为。
- 从资本流向直接推出股市、汇率或储备的确定结果。

## 来源

- [国家外汇管理局：中国国际收支平衡表](https://www.safe.gov.cn/safe/zggjszphb/index.html)
- [国家外汇管理局：银行代客涉外收付款数据](https://www.safe.gov.cn/safe/2018/0419/8806.html)
- [国家外汇管理局：国际收支平衡表编制原则与指标说明](https://www.safe.gov.cn/safe/2015/1230/6080.html)
- [IMF BPM6：Financial Account](https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm)
```

- [ ] **Step 5: Run the contracts and verify GREEN**

Run:

```bash
node --test --experimental-strip-types tests/external-sector-content.test.mjs
```

Expected: PASS, 5 tests.

- [ ] **Step 6: Commit the financial-flow slice**

```bash
git add tests/external-sector-content.test.mjs src/content/concepts/financial-account.md src/content/concepts/cross-border-capital-flows.md
git commit -m "feat: explain external financial flows"
```

### Task 4: Add the Effective-Exchange-Rate Page

**Files:**
- Modify: `tests/external-sector-content.test.mjs`
- Create: `src/content/concepts/effective-exchange-rate.md`

- [ ] **Step 1: Add the failing effective-rate contract**

Append to `tests/external-sector-content.test.mjs`:

```js
test('effective-exchange-rate distinguishes bilateral and multilateral indexes', () => {
  assertConcept('effective-exchange-rate', 5, [
    'USD/CNY', 'CFETS', 'NEER', 'REER', '多边指数', '贸易权重',
    '相对价格', '基期', '指数点位', 'BIS', '有效升值',
    '不等于竞争力按同一百分比恶化',
  ], [
    'https://data.bis.org/topics/EER',
    'https://www.bis.org/statistics/dataportal/exr.htm',
  ]);
});
```

- [ ] **Step 2: Run the contract and verify RED**

Run:

```bash
node --test --experimental-strip-types tests/external-sector-content.test.mjs
```

Expected: the first 5 tests pass; the effective-rate test FAILS because the page is missing.

- [ ] **Step 3: Create the effective-exchange-rate page**

Create `src/content/concepts/effective-exchange-rate.md`:

```markdown
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

REER 在名义有效汇率基础上纳入本经济体与贸易伙伴之间的相对价格或成本变化。可以概念性理解为“NEER 经相对价格调整”，但不是一条通用算术公式：提供者可能采用不同价格指标、权重、覆盖经济体和归一化方法。

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
```

- [ ] **Step 4: Run the contracts and verify GREEN**

Run:

```bash
node --test --experimental-strip-types tests/external-sector-content.test.mjs
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit the effective-rate slice**

```bash
git add tests/external-sector-content.test.mjs src/content/concepts/effective-exchange-rate.md
git commit -m "feat: explain effective exchange rates"
```

### Task 5: Connect the External Cluster to the Relationship Model

**Files:**
- Create: `tests/external-sector-relations.test.mjs`
- Modify: `data/relations/macro.json`

- [ ] **Step 1: Write the failing graph contract**

Create `tests/external-sector-relations.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const graphPath = fileURLToPath(new URL('../data/relations/macro.json', import.meta.url));
const elements = JSON.parse(readFileSync(graphPath, 'utf8'));
const nodes = new Map(elements.filter(item => 'id' in item.data).map(item => [item.data.id, item.data]));
const relations = elements.filter(item => 'source' in item.data).map(item => item.data);

const expectedNodes = new Map([
  ['balance-of-payments', '国际收支'],
  ['current-account', '经常账户'],
  ['financial-account', '金融账户'],
  ['cross-border-capital-flows', '跨境资本流动'],
  ['effective-exchange-rate', '有效汇率（NEER / REER）'],
  ['cross-border-financial-transactions', '跨境金融交易'],
  ['multilateral-currency-value', '货币多边价值'],
]);

const expectedRelations = [
  ['current-account', 'balance-of-payments', 'COMPONENT_OF'],
  ['financial-account', 'balance-of-payments', 'COMPONENT_OF'],
  ['financial-account', 'cross-border-financial-transactions', 'MEASURES'],
  ['cross-border-capital-flows', 'cross-border-financial-transactions', 'REFLECTS'],
  ['cross-border-capital-flows', 'exchange-rate', 'AFFECTS'],
  ['cross-border-capital-flows', 'financing-conditions', 'AFFECTS'],
  ['current-account', 'exchange-rate', 'CORRELATES'],
  ['effective-exchange-rate', 'multilateral-currency-value', 'MEASURES'],
  ['effective-exchange-rate', 'cfets-rmb-index', 'CORRELATES'],
  ['effective-exchange-rate', 'economic-activity', 'AFFECTS'],
];

test('registers external concept and abstract graph nodes', () => {
  for (const [id, label] of expectedNodes) assert.equal(nodes.get(id)?.label, label, `missing graph node ${id}`);
});

test('uses the canonical non-deterministic external-sector relationships', () => {
  for (const [source, target, type] of expectedRelations) {
    assert.ok(
      relations.some(relation => relation.source === source && relation.target === target && relation.type === type),
      `missing ${source} --${type}--> ${target}`,
    );
  }
  assert.equal(relations.some(relation => relation.type === 'CAUSES' && expectedNodes.has(relation.source)), false);
  assert.equal(relations.some(relation => relation.source === 'balance-of-payments' && relation.type === 'AFFECTS'), false);
});

test('stores symmetric external correlations only once', () => {
  for (const [source, target, type] of expectedRelations.filter(([, , type]) => type === 'CORRELATES')) {
    assert.equal(
      relations.filter(relation => relation.type === type && (
        (relation.source === source && relation.target === target)
        || (relation.source === target && relation.target === source)
      )).length,
      1,
    );
  }
});
```

- [ ] **Step 2: Run the graph contract and verify RED**

Run:

```bash
node --test tests/external-sector-relations.test.mjs
```

Expected: all 3 tests FAIL because the external graph nodes and relations are absent.

- [ ] **Step 3: Add the graph nodes**

In `data/relations/macro.json`, add these node entries immediately after `official-external-liquidity-buffer`:

```json
  {"data":{"id":"balance-of-payments","label":"国际收支"}},
  {"data":{"id":"current-account","label":"经常账户"}},
  {"data":{"id":"financial-account","label":"金融账户"}},
  {"data":{"id":"cross-border-capital-flows","label":"跨境资本流动"}},
  {"data":{"id":"effective-exchange-rate","label":"有效汇率（NEER / REER）"}},
  {"data":{"id":"cross-border-financial-transactions","label":"跨境金融交易"}},
  {"data":{"id":"multilateral-currency-value","label":"货币多边价值"}},
```

- [ ] **Step 4: Add the canonical graph edges**

Append these entries after the existing foreign-exchange-reserves relation, adding a comma to the prior entry:

```json
  {"data":{"source":"current-account","target":"balance-of-payments","type":"COMPONENT_OF"}},
  {"data":{"source":"financial-account","target":"balance-of-payments","type":"COMPONENT_OF"}},
  {"data":{"source":"financial-account","target":"cross-border-financial-transactions","type":"MEASURES"}},
  {"data":{"source":"cross-border-capital-flows","target":"cross-border-financial-transactions","type":"REFLECTS"}},
  {"data":{"source":"cross-border-capital-flows","target":"exchange-rate","type":"AFFECTS"}},
  {"data":{"source":"cross-border-capital-flows","target":"financing-conditions","type":"AFFECTS"}},
  {"data":{"source":"current-account","target":"exchange-rate","type":"CORRELATES"}},
  {"data":{"source":"effective-exchange-rate","target":"multilateral-currency-value","type":"MEASURES"}},
  {"data":{"source":"effective-exchange-rate","target":"cfets-rmb-index","type":"CORRELATES"}},
  {"data":{"source":"effective-exchange-rate","target":"economic-activity","type":"AFFECTS"}}
```

- [ ] **Step 5: Run the graph contract and verify GREEN**

Run:

```bash
node --test tests/external-sector-relations.test.mjs
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Run all focused contracts**

Run:

```bash
node --test --experimental-strip-types tests/external-sector-content.test.mjs tests/external-sector-relations.test.mjs
```

Expected: PASS, 9 tests.

- [ ] **Step 7: Commit the relationship slice**

```bash
git add tests/external-sector-relations.test.mjs data/relations/macro.json
git commit -m "feat: connect external sector relationships"
```

### Task 6: Verify the Integrated Static Site

**Files:**
- Verify: `src/content/concepts/*.md`
- Verify: `src/pages/concepts/index.astro`
- Verify: `src/pages/concepts/[id].astro`
- Verify: `dist/`

- [ ] **Step 1: Run all focused contracts from a clean command**

Run:

```bash
node --test --experimental-strip-types tests/external-sector-content.test.mjs tests/external-sector-relations.test.mjs
```

Expected: PASS, 9 tests, 0 failures.

- [ ] **Step 2: Run Astro validation**

Run:

```bash
npm run check
```

Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 3: Build routes and Pagefind**

Run:

```bash
npm run build
```

Expected: build succeeds; 36 static pages are generated; Pagefind indexes 33 concept-content pages. The existing Vite chunk-size advisory may remain.

- [ ] **Step 4: Verify all stable routes and index placement**

Run:

```bash
for id in balance-of-payments current-account financial-account cross-border-capital-flows effective-exchange-rate; do test -f "dist/concepts/$id/index.html"; done
node -e "const fs=require('node:fs');const html=fs.readFileSync('dist/concepts/index.html','utf8');const exchange=html.indexOf('id=\"exchange\"');const external=html.indexOf('id=\"external\"');if(exchange<0||external<0||external<exchange)process.exit(1)"
```

Expected: exit code 0.

- [ ] **Step 5: Check repository hygiene**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only intentional committed files are present.

- [ ] **Step 6: Commit any verification-only corrections**

If verification required an intentional content correction, stage only the affected source and test files, then run:

```bash
git commit -m "fix: align external sector content contracts"
```

If no correction was needed, do not create an empty commit.
