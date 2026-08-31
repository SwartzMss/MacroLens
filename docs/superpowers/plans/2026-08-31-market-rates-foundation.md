# Market-Rates Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `markets` category, five source-grounded market-rate concept pages, and seven cautious graph relationships without adding charts.

**Architecture:** Register the category in the existing TypeScript category map, author five Markdown collection entries, and extend the existing macro JSON graph. Add market-specific Node contracts that validate exact frontmatter, essential financial definitions, related IDs, graph structure, and prohibited deterministic relations before Astro performs full content and route validation.

**Tech Stack:** Astro 5, TypeScript, Markdown content collections, JSON relationship data, Node 20 test runner, `tsx`, Pagefind.

---

## File Map

- Modify `src/data/categories.ts`: register `markets` after `labor`.
- Create `tests/market-rates-content.test.mjs`: category, frontmatter, source, related-link, no-chart, and semantic contracts.
- Create `src/content/concepts/interbank-rate.md`: policy rate versus DR007/R007 market funding rates.
- Create `src/content/concepts/government-bond-yield.md`: coupon, issuance, price, maturity, and yield distinctions.
- Create `src/content/concepts/yield-curve.md`: term structure and non-deterministic curve interpretation.
- Create `src/content/concepts/real-interest-rate.md`: ex-ante/ex-post conventions and CPI approximation warning.
- Create `src/content/concepts/credit-spread.md`: benchmark, maturity, curve, and risk-component distinctions.
- Create `tests/market-rates-relations.test.mjs`: exact graph-node and graph-edge contracts.
- Modify `data/relations/macro.json`: add five concept nodes, two abstract nodes, and seven canonical edges.

### Task 1: Register the Markets Category

**Files:**
- Create: `tests/market-rates-content.test.mjs`
- Modify: `src/data/categories.ts`

- [ ] **Step 1: Write the failing category contract**

Create `tests/market-rates-content.test.mjs` with imports, shared readers, and this test:

```js
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { categories, categoryIds } from '../src/data/categories.ts';

const conceptDirectory = fileURLToPath(new URL('../src/content/concepts/', import.meta.url));

function readConcept(id) {
  const path = `${conceptDirectory}/${id}.md`;
  assert.ok(existsSync(path), `${id} concept page is missing`);
  return readFileSync(path, 'utf8');
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function parseFrontmatter(document) {
  const match = document.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, 'document must have leading YAML frontmatter');
  return Object.fromEntries(match[1].split('\n').map((line) => {
    const colon = line.indexOf(':');
    assert.notEqual(colon, -1, `invalid frontmatter line: ${line}`);
    const key = line.slice(0, colon).trim();
    const rawValue = line.slice(colon + 1).trim();
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      const contents = rawValue.slice(1, -1).trim();
      return [key, contents ? contents.split(',').map(parseScalar) : []];
    }
    if (rawValue.startsWith('{') && rawValue.endsWith('}')) {
      const contents = rawValue.slice(1, -1).trim();
      return [key, Object.fromEntries(contents ? contents.split(',').map((entry) => {
        const entryColon = entry.indexOf(':');
        assert.notEqual(entryColon, -1, `invalid inline map entry: ${entry}`);
        return [entry.slice(0, entryColon).trim(), parseScalar(entry.slice(entryColon + 1))];
      }) : [])];
    }
    return [key, parseScalar(rawValue)];
  }));
}

test('registers markets after labor', () => {
  assert.equal(categoryIds.at(-1), 'markets');
  assert.deepEqual(categories.markets, {
    label: '金融市场',
    description: '理解政策锚如何传导到资金利率、债券收益率、实际利率与信用利差。',
    order: 90,
  });
  assert.equal(categoryIds.indexOf('markets'), categoryIds.indexOf('labor') + 1);
});
```

- [ ] **Step 2: Run the contract and verify RED**

Run:

```bash
node --import tsx tests/market-rates-content.test.mjs
```

Expected: FAIL because the final category is `labor` and `categories.markets` is absent.

- [ ] **Step 3: Add the minimal category implementation**

Append `markets` to `categoryIds` and add this map entry:

```ts
markets: { label: '金融市场', description: '理解政策锚如何传导到资金利率、债券收益率、实际利率与信用利差。', order: 90 },
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run `node --import tsx tests/market-rates-content.test.mjs`.

Expected: PASS, 1 test.

- [ ] **Step 5: Commit the category slice**

```bash
git add tests/market-rates-content.test.mjs src/data/categories.ts
git commit -m "feat: register financial markets category"
```

### Task 2: Add Interbank-Rate and Government-Bond-Yield Pages

**Files:**
- Modify: `tests/market-rates-content.test.mjs`
- Create: `src/content/concepts/interbank-rate.md`
- Create: `src/content/concepts/government-bond-yield.md`

- [ ] **Step 1: Add exact metadata and semantic helpers**

Add an `approvedMetadata` object with these exact entries:

```js
const approvedMetadata = {
  'interbank-rate': { id: 'interbank-rate', name: '银行间资金利率（DR007 / R007）', subtitle: '市场成交形成的短期资金价格，不等于央行政策操作利率', country: 'CN', category: 'markets', source: '中国人民银行与全国银行间同业拆借中心', definition: { source: 'CFETS 质押式回购指标口径', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['policy-rate', 'omo', 'lpr', 'credit'], graph: 'macro', order: 1 },
  'government-bond-yield': { id: 'government-bond-yield', name: '国债收益率', subtitle: '由债券价格和现金流共同决定的市场贴现率，不是票面利率或债券价格', country: 'CN', category: 'markets', source: '财政部与中央国债登记结算有限责任公司', definition: { source: '财政部-中国国债收益率曲线编制说明', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['yield-curve', 'real-interest-rate', 'credit-spread', 'government-debt'], graph: 'macro', order: 2 },
};

function assertConcept(id, terms, sourceUrls) {
  const document = readConcept(id);
  assert.deepEqual(parseFrontmatter(document), approvedMetadata[id]);
  assert.doesNotMatch(document, /^chart:/m);
  for (const term of terms) assert.ok(document.includes(term), `${id} must explain ${term}`);
  for (const url of sourceUrls) assert.ok(document.includes(url), `${id} must cite ${url}`);
}
```

Add tests requiring these terms and sources:

```js
test('interbank rates distinguish policy operations, DR007, and R007', () => {
  assertConcept('interbank-rate', [
    '7天期逆回购操作利率', '市场成交利率', 'DR007', 'R007', '存款类机构',
    '利率债', '质押', '交易主体', '抵押品', '不会机械地一比一同步',
  ], [
    'https://www.chinamoney.com.cn/chinese/bkfrr/',
    'https://www.pbc.gov.cn/zhengcehuobisi/125207/125227/125957/5347949/2025100917195573922/2025081217013923839.pdf',
  ]);
});

test('government bond yield separates coupon, price, issuance, and maturity', () => {
  assertConcept('government-bond-yield', [
    '票面利率', '发行收益率', '二级市场', '债券价格', '到期收益率', '反向',
    '剩余期限', '基点', '估值', '拟合', '最后一笔成交',
  ], [
    'https://indices.chinabond.com.cn/cbweb-czb-web/czb/bzcxsmDown?locale=',
    'https://yield.chinabond.com.cn/cbweb-pbc-web/pbc/more?locale=cn_ZH',
  ]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Expected: category passes; both page tests fail with “concept page is missing”.

- [ ] **Step 3: Author `interbank-rate.md`**

Use the exact approved frontmatter. Include sections for policy-versus-market rates, DR007 scope, R007 scope, why the spread varies, reading units/tenor/weighted averages, common misconceptions, and official sources. State explicitly that DR007 uses depository-institution transactions collateralized by rate bonds, R007 has broader transaction scope, and neither must move one-for-one with the policy rate.

- [ ] **Step 4: Author `government-bond-yield.md`**

Use the exact approved frontmatter. Include coupon versus yield, primary issuance versus secondary pricing, the inverse price-yield relationship, remaining maturity, basis points, evaluated/fitted curve points, common misconceptions, and the two authoritative ChinaBond/MOF sources.

- [ ] **Step 5: Run the focused tests and commit**

```bash
node --import tsx tests/market-rates-content.test.mjs
git add tests/market-rates-content.test.mjs src/content/concepts/interbank-rate.md src/content/concepts/government-bond-yield.md
git commit -m "feat: explain money market and government bond rates"
```

Expected: all current market content tests pass.

### Task 3: Add Yield-Curve and Real-Interest-Rate Pages

**Files:**
- Modify: `tests/market-rates-content.test.mjs`
- Create: `src/content/concepts/yield-curve.md`
- Create: `src/content/concepts/real-interest-rate.md`

- [ ] **Step 1: Extend approved metadata**

```js
'yield-curve': { id: 'yield-curve', name: '收益率曲线', subtitle: '把可比债券的期限与收益率连接起来，曲线形态不是单一经济预测', country: 'CN', category: 'markets', source: '中央国债登记结算有限责任公司', definition: { source: '中债收益率曲线编制说明', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['government-bond-yield', 'real-interest-rate', 'credit-spread', 'policy-rate'], graph: 'macro', order: 3 },
'real-interest-rate': { id: 'real-interest-rate', name: '实际利率', subtitle: '剔除通胀后的利率概念，必须说明预期或实现通胀及匹配期限', country: 'CN', category: 'markets', source: '中国人民银行与国际货币基金组织', definition: { source: 'Fisher relation and official monetary-policy usage', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['government-bond-yield', 'yield-curve', 'policy-rate', 'cpi'], graph: 'macro', order: 4 },
```

Add tests:

```js
test('yield curve interpretation remains conditional and methodology-aware', () => {
  assertConcept('yield-curve', [
    '期限结构', '到期收益率曲线', '即期收益率曲线', '远期收益率曲线',
    '陡峭化', '平坦化', '倒挂', '未来短期利率预期', '期限溢价', '流动性',
    '供求', '不能保证经济衰退', '曲线编制方法',
  ], ['https://indices.chinabond.com.cn/cbweb-mn/int/int_yield_syl_doc']);
});

test('real rates distinguish ex-ante, ex-post, inflation measure, and horizon', () => {
  assertConcept('real-interest-rate', [
    '事前实际利率', '预期通胀', '事后实际利率', '实现通胀', '费雪关系',
    '当前CPI', '近似', '期限匹配', '通胀指标', '年化',
  ], ['https://wzdt.pbc.gov.cn/rmyh/2025-07/20/article_2025072015162368621.html']);
});
```

- [ ] **Step 2: Verify RED**

Run the focused content test. Expected: the two new page contracts fail because files are absent.

- [ ] **Step 3: Author both pages**

For `yield-curve.md`, use exact metadata and cover comparable instruments, curve families, shapes, multiple drivers, provider/model provenance, and non-deterministic interpretation. For `real-interest-rate.md`, use exact metadata and cover approximate versus exact Fisher relations, ex-ante/ex-post calculations, matching horizons, inflation measures, and the limitations of subtracting current CPI.

- [ ] **Step 4: Verify GREEN and commit**

```bash
node --import tsx tests/market-rates-content.test.mjs
git add tests/market-rates-content.test.mjs src/content/concepts/yield-curve.md src/content/concepts/real-interest-rate.md
git commit -m "feat: explain yield curves and real rates"
```

### Task 4: Add the Credit-Spread Page and Related-Link Contract

**Files:**
- Modify: `tests/market-rates-content.test.mjs`
- Create: `src/content/concepts/credit-spread.md`

- [ ] **Step 1: Add credit-spread metadata and contracts**

```js
'credit-spread': { id: 'credit-spread', name: '信用利差', subtitle: '信用债收益率相对可比基准的差额，不只反映违约风险', country: 'CN', category: 'markets', source: '中央国债登记结算有限责任公司', definition: { source: '中债收益率曲线与估值方法', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['government-bond-yield', 'yield-curve', 'real-interest-rate', 'credit'], graph: 'macro', order: 5 },
```

```js
test('all market related IDs resolve to stable concept pages', () => {
  const conceptIds = new Set(readdirSync(conceptDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => parseFrontmatter(readFileSync(`${conceptDirectory}/${entry.name}`, 'utf8')).id));
  for (const metadata of Object.values(approvedMetadata)) {
    for (const relatedId of metadata.related) assert.ok(conceptIds.has(relatedId), `${metadata.id} related ID ${relatedId} must resolve`);
  }
});

test('credit spread names a comparable benchmark and multiple drivers', () => {
  assertConcept('credit-spread', [
    '基准收益率', '相近剩余期限', '久期', '国债曲线', '政策性金融债',
    '金融债', '企业债', '信用风险', '流动性', '风险偏好', '技术因素',
    '不等于违约概率', '基点',
  ], [
    'https://yield.chinabond.com.cn/cbweb-pbc-web/pbc/more?locale=cn_ZH',
    'https://indices.chinabond.com.cn/cbweb-mn/int/int_yield_syl_doc',
  ]);
});
```

- [ ] **Step 2: Verify RED**

Expected: credit-spread file is missing and related-link contract reports the missing ID.

- [ ] **Step 3: Author `credit-spread.md`**

Use exact metadata. Define a spread as credit-instrument yield minus an explicit comparable benchmark; cover maturity/duration matching, government/policy-bank/financial/corporate curve differences, basis points, credit loss, liquidity, risk appetite, options, regulation, supply and technical factors, and the warning that a spread is not a direct default probability.

- [ ] **Step 4: Verify GREEN and commit**

```bash
node --import tsx tests/market-rates-content.test.mjs
git add tests/market-rates-content.test.mjs src/content/concepts/credit-spread.md
git commit -m "feat: explain credit spreads"
```

### Task 5: Add Canonical Graph Relationships

**Files:**
- Create: `tests/market-rates-relations.test.mjs`
- Modify: `data/relations/macro.json`

- [ ] **Step 1: Write the failing graph contract**

Create a test following the external/labor graph-test pattern with:

```js
const expectedNodes = new Map([
  ['interbank-rate', '银行间资金利率（DR007 / R007）'],
  ['government-bond-yield', '国债收益率'],
  ['yield-curve', '收益率曲线'],
  ['real-interest-rate', '实际利率'],
  ['credit-spread', '信用利差'],
  ['rate-expectations-and-term-premium', '利率预期与期限溢价'],
  ['credit-risk-and-risk-appetite', '信用风险与风险偏好'],
]);

const expectedRelations = [
  ['policy-rate', 'interbank-rate', 'AFFECTS'],
  ['interbank-rate', 'financing-conditions', 'AFFECTS'],
  ['government-bond-yield', 'financing-conditions', 'REFLECTS'],
  ['yield-curve', 'rate-expectations-and-term-premium', 'REFLECTS'],
  ['real-interest-rate', 'economic-activity', 'AFFECTS'],
  ['credit-spread', 'credit-risk-and-risk-appetite', 'REFLECTS'],
  ['credit-spread', 'financing-conditions', 'AFFECTS'],
];
```

Assert node-ID uniqueness, exact labels, no `kind` and no concept pages for the two abstract nodes, relation-triple uniqueness, valid endpoints, canonical relation types, exact market-related edges, and no `CAUSES` involving any expected node.

- [ ] **Step 2: Verify RED**

Run `node --import tsx tests/market-rates-relations.test.mjs`.

Expected: missing-node assertions fail.

- [ ] **Step 3: Add graph nodes and edges**

Append the seven nodes before the first edge in `data/relations/macro.json`, then append the seven exact relations from `expectedRelations`. Do not add reverse duplicates or any `CAUSES` edge.

- [ ] **Step 4: Verify graph and all unit contracts**

```bash
node --import tsx tests/market-rates-relations.test.mjs
npm test
```

Expected: market graph tests pass and the complete suite has zero failures.

- [ ] **Step 5: Commit**

```bash
git add tests/market-rates-relations.test.mjs data/relations/macro.json
git commit -m "feat: connect market rates to financial conditions"
```

### Task 6: Full Verification and Delivery

**Files:** all files changed since `origin/main`.

- [ ] **Step 1: Run explicit Node 20 contracts**

```bash
npx --yes --package node@20 node --version
npx --yes --package node@20 node --import tsx --test tests/*.test.mjs
```

Expected: Node `v20.x`; all tests pass with zero failures.

- [ ] **Step 2: Run Astro validation**

```bash
npm run check
```

Expected: zero errors, warnings, and hints.

- [ ] **Step 3: Build routes and search index**

```bash
npm run build
```

Expected: build succeeds; routes for all five IDs appear; Pagefind indexes the resulting concept pages.

- [ ] **Step 4: Review scope and hygiene**

```bash
git diff --check origin/main..HEAD
git status --short
git diff --stat origin/main..HEAD
```

Expected: no whitespace errors, clean worktree, and changes limited to the spec, plan, category, five pages, graph, and two test files.

- [ ] **Step 5: Request independent review**

Provide the reviewer with issue #25, the design spec, base SHA, head SHA, and ask specifically about DR007/R007 scope, bond price/yield mathematics, curve non-determinism, real-rate horizons, spread comparability, graph direction, and contract completeness. Resolve every Critical or Important finding and rerun Steps 1–4.

- [ ] **Step 6: Push and create the PR**

```bash
git push -u origin codex/issue-25-market-rates
gh pr create --base main --head codex/issue-25-market-rates --title "Build market-rates foundation" --body $'## Summary\n\n- add the markets category and five foundational market-rate concept pages\n- distinguish policy anchors, transaction rates, bond yields, curve signals, real rates, and credit spreads using authoritative methodology\n- add cautious graph relationships and Node 20 content/relation contracts without introducing charts\n\n## Verification\n\n- explicit Node 20 test suite\n- npm run check\n- npm run build\n- git diff --check origin/main..HEAD\n\nCloses #25'
```

Expected: an open, mergeable PR linked to issue #25. Preserve the worktree for review feedback.
