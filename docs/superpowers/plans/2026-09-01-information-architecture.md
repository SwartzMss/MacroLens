# Information Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Add validated topics, learning prerequisites, and static/progressive browsing controls to the existing Astro concept atlas without changing relation semantics or the curated homepage.

**Architecture:** Keep Markdown frontmatter as the source of concept metadata. Add a typed topic registry and a pure \`conceptCatalog\` module that validates collection-shaped entries and exposes stable ID lookup, topic grouping, and deterministic ordering. Astro pages consume the catalog; client-side code only progressively filters already-rendered static cards.

**Tech Stack:** Astro 5 content collections, Zod, TypeScript, Markdown frontmatter, Node test runner with \`tsx\`, CSS, vanilla browser JavaScript.

---

### Task 1: Define catalog validation contracts with failing tests

**Files:**
- Create: \`tests/concept-catalog.test.mjs\`
- Create: \`src/data/conceptCatalog.ts\` (the import is intentionally unresolved until Task 2)
- Reference: \`src/data/categories.ts\`

- [ ] **Step 1: Write the failing test**

Create a fixture helper with the fields required by the catalog and tests for valid data, missing references, self-prerequisites, duplicate arrays, and cycles. The public API under test is \`buildConceptCatalog(entries, topics)\`, returning \`{ concepts, byId, topics }\`.

~~~js
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildConceptCatalog } from '../src/data/conceptCatalog.ts';

const topics = [
  { id: 'money-supply', label: '货币供应与流动性', description: '理解货币层次。', category: 'money', order: 10 },
  { id: 'credit-financing', label: '信用与融资', description: '理解融资链条。', category: 'credit', order: 20 },
];
function entry(id, overrides = {}) {
  return { data: { id, name: id.toUpperCase(), subtitle: id, category: 'money', order: 1, level: 'basic', topics: ['money-supply'], prerequisites: [], featured: false, ...overrides } };
}

test('builds stable lookup and topic membership for valid concepts', () => {
  const catalog = buildConceptCatalog([entry('m1'), entry('m2', { topics: ['money-supply', 'credit-financing'], order: 2 })], topics);
  assert.equal(catalog.byId.get('m1').data.name, 'M1');
  assert.deepEqual(catalog.topics.get('money-supply').map((item) => item.data.id), ['m1', 'm2']);
  assert.deepEqual(catalog.topics.get('credit-financing').map((item) => item.data.id), ['m2']);
});

test('rejects duplicate concept IDs and unknown topic IDs', () => {
  assert.throws(() => buildConceptCatalog([entry('m1'), entry('m1')], topics), /Duplicate stable concept ID: m1/);
  assert.throws(() => buildConceptCatalog([entry('m1', { topics: ['unknown'] })], topics), /m1.*unknown topic/);
});

test('rejects unknown, self, duplicate, and cyclic prerequisites', () => {
  assert.throws(() => buildConceptCatalog([entry('m1', { prerequisites: ['missing'] })], topics), /m1.*missing prerequisite/);
  assert.throws(() => buildConceptCatalog([entry('m1', { prerequisites: ['m1'] })], topics), /m1.*itself/);
  assert.throws(() => buildConceptCatalog([entry('m1', { topics: ['money-supply', 'money-supply'] })], topics), /m1.*duplicate topic/);
  assert.throws(() => buildConceptCatalog([entry('m1', { prerequisites: ['m2'] }), entry('m2', { prerequisites: ['m1'] })], topics), /prerequisite cycle/);
  assert.throws(() => buildConceptCatalog([entry('m1', { prerequisites: ['m2', 'm2'] }), entry('m2')], topics), /m1.*duplicate prerequisite/);
});
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: \`npm test -- tests/concept-catalog.test.mjs\`

Expected: FAIL because \`src/data/conceptCatalog.ts\` does not export \`buildConceptCatalog\` yet. Do not implement production behavior before observing this failure.

- [ ] **Step 3: Commit the failing contract**

~~~bash
git add tests/concept-catalog.test.mjs
git commit -m "test: define concept catalog validation contract"
~~~

### Task 2: Implement topic registry, catalog validation, and collection schema

**Files:**
- Create: \`src/data/topics.ts\`
- Create: \`src/data/conceptCatalog.ts\`
- Modify: \`src/content.config.ts\`
- Test: \`tests/concept-catalog.test.mjs\`

- [ ] **Step 1: Add the centralized registry**

Export \`TopicId\`, \`Topic\`, \`topicIds\`, \`topics\`, and \`getTopic\`. Define exactly these 12 registry entries with stable IDs, Chinese labels/descriptions, existing category IDs, and unique orders: \`money-supply\`, \`credit-financing\`, \`monetary-transmission\`, \`prices-inflation\`, \`economic-activity\`, \`fiscal-policy\`, \`labor-market\`, \`housing-market\`, \`market-rates\`, \`exchange-rates\`, \`balance-of-payments\`, and \`external-balance-sheets\`.

~~~ts
export const topicIds = [
  'money-supply', 'credit-financing', 'monetary-transmission', 'prices-inflation',
  'economic-activity', 'fiscal-policy', 'labor-market', 'housing-market',
  'market-rates', 'exchange-rates', 'balance-of-payments', 'external-balance-sheets',
] as const;
export type TopicId = typeof topicIds[number];
export type Topic = { id: TopicId; label: string; description: string; category: CategoryId; order: number };
export const topics: Record<TopicId, Omit<Topic, 'id'>> = {
  'money-supply': { label: '货币供应与流动性', description: '理解 M0、M1、M2 与货币层次。', category: 'money', order: 10 },
  'credit-financing': { label: '信用与融资', description: '理解贷款、社会融资与融资成本。', category: 'credit', order: 20 },
  'monetary-transmission': { label: '货币政策传导', description: '理解政策工具如何影响金融条件和实体经济。', category: 'policy', order: 30 },
  'prices-inflation': { label: '通胀与价格', description: '理解价格水平、成本与购买力。', category: 'inflation', order: 40 },
  'economic-activity': { label: '经济活动与周期', description: '从产出、需求、生产和周期指标观察经济活动。', category: 'growth', order: 50 },
  'fiscal-policy': { label: '财政政策', description: '理解政府收支、债务与宏观调节。', category: 'fiscal', order: 60 },
  'labor-market': { label: '劳动力市场', description: '理解就业、失业、参与率和工资。', category: 'labor', order: 70 },
  'housing-market': { label: '房地产与住房', description: '理解住房价格、交易、融资、建设与土地。', category: 'housing', order: 80 },
  'market-rates': { label: '市场利率', description: '理解资金利率、债券收益率、实际利率与信用利差。', category: 'markets', order: 90 },
  'exchange-rates': { label: '汇率与跨货币定价', description: '理解汇率形成、在岸离岸市场和跨货币定价。', category: 'exchange', order: 100 },
  'balance-of-payments': { label: '国际收支与外部流量', description: '理解经常账户、金融账户和跨境资金流动。', category: 'external', order: 110 },
  'external-balance-sheets': { label: '外部资产负债表', description: '理解外债、储备和国际投资头寸。', category: 'external', order: 120 },
};
export function getTopic(id: TopicId): Topic { return { id, ...topics[id] }; }
~~~

- [ ] **Step 2: Add the pure catalog implementation**

Define \`ConceptEntry\` as a collection-shaped generic with \`data.id\`, \`name\`, \`subtitle\`, \`category\`, \`order\`, \`level\`, \`topics\`, \`prerequisites\`, and \`featured\`. Export \`sortConcepts\` and \`buildConceptCatalog<T extends ConceptEntry>(entries, registry)\`.

Implement the function in this order: reject duplicate stable IDs; reject duplicate topic/prerequisite IDs and topic IDs absent from the registry; build \`byId\`; reject missing/self prerequisites; DFS every prerequisite edge with visiting/visited sets and throw \`prerequisite cycle: a -> b -> a\`; sort concepts and each topic membership by \`data.order\` then \`data.id\`; return \`{ concepts, byId, topics }\`. Error messages must include the offending concept ID and field/value so build failures are actionable.

- [ ] **Step 3: Extend the Astro schema**

In \`src/content.config.ts\`, import \`topicIds\` and add these fields while keeping the existing fields unchanged:

~~~ts
level: z.enum(['basic', 'advanced']).default('basic'),
topics: z.array(z.enum(topicIds)).default([]),
prerequisites: z.array(z.string()).default([]),
featured: z.boolean().default(false),
~~~

The schema enum catches unknown topic values during Astro content loading; catalog validation owns duplicate, missing, self, and cycle checks.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: \`npm test -- tests/concept-catalog.test.mjs\`

Expected: PASS for all catalog validation tests.

- [ ] **Step 5: Commit the registry and validator**

~~~bash
git add src/data/topics.ts src/data/conceptCatalog.ts src/content.config.ts tests/concept-catalog.test.mjs
git commit -m "feat: add validated topic and prerequisite catalog"
~~~

### Task 3: Annotate all existing concepts and verify metadata coverage

**Files:**
- Modify: all 63 files under \`src/content/concepts/*.md\`
- Modify: \`tests/concept-catalog.test.mjs\`

- [ ] **Step 1: Add metadata coverage assertions before changing content**

Add a fixture-free test helper that parses the leading frontmatter of all Markdown concepts using the repository's existing test conventions. Assert every concept has \`level\`, at least one topic, and boolean \`featured\`, then pass parsed entries to \`buildConceptCatalog\` with the complete registry. This test must fail against current content because the fields are absent.

- [ ] **Step 2: Run the coverage test to verify the intended failure**

Run: \`npm test -- tests/concept-catalog.test.mjs\`

Expected: FAIL identifying missing metadata on an existing concept before editing the 63 Markdown files.

- [ ] **Step 3: Annotate the 63 frontmatter blocks**

Add \`level\`, \`topics\`, \`prerequisites\`, and \`featured\` to every concept, preserving all existing fields and values. Use this complete assignment:

| Topic | Concept IDs |
| --- | --- |
| \`money-supply\` | \`m0\`, \`m1\`, \`m2\` |
| \`credit-financing\` | \`credit\`, \`social-financing\`, \`lpr\`, \`mortgage\`, \`credit-spread\` |
| \`monetary-transmission\` | \`monetary-policy\`, \`policy-rate\`, \`rrr\`, \`omo\`, \`interbank-rate\`, \`lpr\`, \`credit\`, \`m1\`, \`m2\`, \`real-interest-rate\` |
| \`prices-inflation\` | \`cpi\`, \`core-cpi\`, \`ppi\`, \`real-interest-rate\`, \`wages\` |
| \`economic-activity\` | \`pmi\`, \`gdp\`, \`industrial-production\`, \`industrial-profits\`, \`capacity-utilization\`, \`retail-sales\`, \`fixed-asset-investment\`, \`output-gap\`, \`inventory-cycle\`, \`leading-indicators\`, \`employment\`, \`unemployment-rate\`, \`youth-unemployment\`, \`wages\` |
| \`fiscal-policy\` | \`fiscal-policy\`, \`fiscal-revenue\`, \`fiscal-expenditure\`, \`fiscal-deficit\`, \`government-debt\`, \`land-market\` |
| \`labor-market\` | \`employment\`, \`unemployment-rate\`, \`youth-unemployment\`, \`labor-force-participation\`, \`wages\` |
| \`housing-market\` | \`real-estate-investment\`, \`property-sales\`, \`house-price-index\`, \`mortgage\`, \`land-market\` |
| \`market-rates\` | \`policy-rate\`, \`interbank-rate\`, \`government-bond-yield\`, \`yield-curve\`, \`real-interest-rate\`, \`credit-spread\`, \`lpr\` |
| \`exchange-rates\` | \`exchange-rate\`, \`rmb-exchange-rate-regime\`, \`usd-cny\`, \`usd-cnh\`, \`cfets-rmb-index\`, \`effective-exchange-rate\`, \`foreign-exchange-reserves\`, \`impossible-trinity\`, \`interest-rate-parity\`, \`carry-trade\`, \`capital-controls\` |
| \`balance-of-payments\` | \`balance-of-payments\`, \`current-account\`, \`financial-account\`, \`capital-account\`, \`cross-border-capital-flows\`, \`capital-controls\`, \`exchange-rate\`, \`interest-rate-parity\`, \`carry-trade\`, \`reserve-assets\` |
| \`external-balance-sheets\` | \`international-investment-position\`, \`net-foreign-assets\`, \`external-debt\`, \`reserve-assets\`, \`foreign-exchange-reserves\` |

Use \`basic\` for foundational definitions and \`advanced\` for specialized measures, parity/trading concepts, and balance-sheet interpretation. Set \`featured: true\` only for the existing curated starting concepts \`m1\`, \`m2\`, \`credit\`, \`social-financing\`, and \`gdp\`; set it to \`false\` elsewhere. Configure only these clear prerequisite edges: \`m1 -> m0\`, \`m2 -> m1\`, \`credit -> m2\`, \`social-financing -> credit\`, \`policy-rate -> monetary-policy\`, \`omo -> monetary-policy\`, \`rrr -> monetary-policy\`, \`lpr -> policy-rate\`, \`interbank-rate -> policy-rate\`, \`cpi -> m2\`, \`core-cpi -> cpi\`, \`current-account -> balance-of-payments\`, \`financial-account -> balance-of-payments\`, \`capital-account -> balance-of-payments\`, \`international-investment-position -> balance-of-payments\`, \`net-foreign-assets -> international-investment-position\`, \`external-debt -> international-investment-position\`, \`usd-cny -> exchange-rate\`, \`usd-cnh -> exchange-rate\`, \`carry-trade -> interest-rate-parity\`, and \`real-interest-rate -> cpi\`. All other concepts use \`prerequisites: []\`.

- [ ] **Step 4: Run metadata and existing tests**

Run: \`npm test -- tests/concept-catalog.test.mjs\`, then \`npm test\`.

Expected: the metadata test and all existing content/relation suites pass, with every prerequisite resolving to a real concept page.

- [ ] **Step 5: Commit content metadata**

~~~bash
git add src/content/concepts tests/concept-catalog.test.mjs
git commit -m "content: classify concepts by topic and learning level"
~~~

### Task 4: Add topic routes and prerequisite presentation

**Files:**
- Create: \`src/pages/topics/index.astro\`
- Create: \`src/pages/topics/[id].astro\`
- Create: \`src/components/PrerequisiteConcepts.astro\`
- Modify: \`src/pages/concepts/[id].astro\`
- Modify: \`src/layouts/BaseLayout.astro\`
- Modify: \`src/styles/related.css\`
- Create/Modify: \`tests/information-architecture.test.mjs\`

- [ ] **Step 1: Write the failing route/data contract tests**

Test that the topic registry has unique IDs, every topic member comes from metadata, every topic concept link is \`/concepts/<stable-id>\`, and prerequisite links use stable IDs. Assert the homepage source still contains only curated cards and does not render the topic registry.

- [ ] **Step 2: Run the tests to verify the route contract is initially absent**

Run: \`npm test -- tests/information-architecture.test.mjs\`

Expected: FAIL because the topic routes and prerequisite component do not exist.

- [ ] **Step 3: Implement static topic routes**

\`src/pages/topics/index.astro\` loads concepts, calls \`buildConceptCatalog\`, sorts the registry by \`order\`, and renders each topic's label, description, concept count, and \`/topics/<id>\` link.

\`src/pages/topics/[id].astro\` implements \`getStaticPaths()\` from the registry, passes the selected topic as a prop, and renders its catalog-derived concepts in deterministic order with level chips and prerequisite-aware copy. It must not contain a page-local concept ID array.

- [ ] **Step 4: Implement prerequisite cards and navigation**

\`PrerequisiteConcepts.astro\` accepts \`{ concepts }\`, renders nothing for an empty list, and otherwise renders a \`建议先理解\` section with text/card links to \`/concepts/<id>\` and visible \`→\` separators. Insert it before \`<Content />\` in the concept detail page. Add its styles to \`related.css\`, including a one-column mobile layout and readable wrapping. Add \`主题\` to the site navigation in \`BaseLayout.astro\` without changing homepage sections.

- [ ] **Step 5: Run focused tests and Astro type checking**

Run: \`npm test -- tests/information-architecture.test.mjs && npm run check\`

Expected: PASS with valid static route sources and zero Astro diagnostics.

- [ ] **Step 6: Commit topic routes and prerequisites**

~~~bash
git add src/pages/topics src/components/PrerequisiteConcepts.astro src/pages/concepts/'[id].astro' src/layouts/BaseLayout.astro src/styles/related.css tests/information-architecture.test.mjs
git commit -m "feat: add topic hubs and prerequisite navigation"
~~~

### Task 5: Make the concepts index progressively filterable

**Files:**
- Modify: \`src/pages/concepts/index.astro\`
- Modify: \`src/styles/concept-index.css\`
- Create: \`src/scripts/concept-filters.ts\`
- Modify: \`tests/information-architecture.test.mjs\`

- [ ] **Step 1: Write the failing filter contract test**

Assert the index source emits native controls named \`category\`, \`topic\`, and \`level\`, embeds each card's stable \`data-category\`, \`data-topics\`, and \`data-level\` values, and references one filter script. Assert no server-side hardcoded topic card arrays are present.

- [ ] **Step 2: Run the test to verify it fails**

Run: \`npm test -- tests/information-architecture.test.mjs\`

Expected: FAIL because the existing index has no topic/level controls, card data attributes, or filter script.

- [ ] **Step 3: Implement static-first controls and client filtering**

Build option lists from \`categories\`, \`topicIds\`, and the catalog. Keep every card in the initial HTML. Each card includes \`data-category\`, a space-separated \`data-topics\`, and \`data-level\`; add an \`aria-live\` result count. Use an Astro \`<script>\` import to load \`src/scripts/concept-filters.ts\`.

Implement native \`change\` listeners, matching all selected dimensions, toggling \`hidden\`, and updating the count. Use no fetch, backend, URL router, or replacement search index. The initial count and all links remain usable when JavaScript is unavailable.

~~~ts
const form = document.querySelector<HTMLFormElement>('[data-concept-filters]');
const cards = [...document.querySelectorAll<HTMLElement>('[data-concept-card]')];
const count = document.querySelector<HTMLElement>('[data-filter-count]');
function selected(name: string) { return form?.elements.namedItem(name) as HTMLSelectElement | null; }
function apply() {
  const category = selected('category')?.value ?? 'all';
  const topic = selected('topic')?.value ?? 'all';
  const level = selected('level')?.value ?? 'all';
  let visible = 0;
  for (const card of cards) {
    const matches = (category === 'all' || card.dataset.category === category)
      && (topic === 'all' || card.dataset.topics?.split(' ').includes(topic))
      && (level === 'all' || card.dataset.level === level);
    card.hidden = !matches;
    if (matches) visible += 1;
  }
  if (count) count.textContent = \`\${visible} 个概念\`;
}
form?.addEventListener('change', apply);
apply();
~~~

- [ ] **Step 4: Add responsive styles and verify behavior contracts**

Style controls as a wrapping grid, preserve the existing card grid, add visible focus states, and ensure controls/cards remain readable below 560px. Run the information-architecture tests and \`npm run check\`.

- [ ] **Step 5: Commit the filterable index**

~~~bash
git add src/pages/concepts/index.astro src/styles/concept-index.css src/scripts/concept-filters.ts tests/information-architecture.test.mjs
git commit -m "feat: add progressive concept browsing filters"
~~~

### Task 6: Full verification, review, and pull request

**Files:**
- Modify only files needed to address verification findings.
- Reference: \`docs/superpowers/specs/2026-09-01-information-architecture-design.md\`

- [ ] **Step 1: Run the complete verification suite**

Run: \`npm test && npm run check && npm run build\`

Expected: all Node tests pass, Astro reports zero diagnostics, and Astro plus Pagefind finish successfully with \`dist\` generated.

- [ ] **Step 2: Review the diff against the acceptance criteria**

Run: \`git diff --check origin/main...HEAD\`, \`git status --short\`, and inspect generated \`dist/topics/index.html\`, one \`dist/topics/<id>/index.html\`, \`dist/concepts/index.html\`, and a concept detail page. Verify topic/prerequisite links, mobile-safe CSS, preserved relationship cards, Pagefind assets, and the curated homepage.

- [ ] **Step 3: Request code review before PR creation**

Dispatch a reviewer with base SHA \`git rev-parse origin/main\` and current HEAD SHA \`git rev-parse HEAD\`, asking it to check issue #38 acceptance criteria, schema/catalog validation, static accessibility, and unchanged relation semantics. Fix all Critical/Important findings and rerun the full verification suite.

- [ ] **Step 4: Push the branch and create the PR**

~~~bash
git push -u origin codex/issue-38-information-architecture
gh pr create --repo SwartzMss/MacroLens \
  --base main \
  --head codex/issue-38-information-architecture \
  --title "feat: build scalable concept information architecture" \
  --body "## Summary

Implements #38 with validated concept metadata, centralized topic hubs, static topic routes, prerequisite navigation, and progressive concept browsing filters.

## Verification

- npm test
- npm run check
- npm run build

Closes #38"
~~~

- [ ] **Step 5: Report the PR URL and verification evidence**

Include the created PR URL, branch name, commit summary, and exact successful commands/output counts. If any external check is still running, report that state instead of claiming the PR is fully green.
