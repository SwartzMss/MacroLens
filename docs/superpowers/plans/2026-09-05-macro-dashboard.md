# Macro Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add a static, responsive macro dashboard to the homepage using existing indicator datasets, showing latest values, recent changes, provenance, update dates, and concept-page links.

**Architecture:** src/data/dashboard.ts owns stable display order and derives latest/previous observations without copying raw JSON. src/components/MacroDashboard.astro renders semantic cards and a recent-changes list. src/styles/dashboard.css contains responsive presentation. src/pages/index.astro composes the dashboard before the existing learning and relationship sections.

**Tech Stack:** Astro 5 static generation, TypeScript, JSON datasets, Node test runner with tsx, existing CSS custom properties.

---

### Task 1: Establish the clean implementation baseline

**Files:** No source changes.

- [ ] Step 1: Install locked dependencies

Run from /home/swartz/WorkSpace/MacroLens/.worktrees/issue-68-dashboard:

~~~bash
npm ci
~~~

Expected: exit code 0 and dependencies installed from package-lock.json.

- [ ] Step 2: Run the baseline suite

~~~bash
npm test
~~~

Expected: all existing tests pass with 0 failures before dashboard code is added.

- [ ] Step 3: Leave the worktree unchanged

node_modules is ignored. Do not commit anything for this task.

### Task 2: Add the tested dashboard data adapter

**Files:**
- Create: src/data/dashboard.ts
- Create: tests/dashboard.test.mjs

- [ ] Step 1: Write failing tests first

Create tests/dashboard.test.mjs with tests for:

~~~js
import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardIndicatorIds, deriveObservationSummary, getDashboardIndicators } from '../src/data/dashboard.ts';

test('keeps the dashboard focused on the eight available datasets', () => {
  assert.deepEqual(dashboardIndicatorIds, [
    'gdp', 'pmi', 'm0', 'm1', 'm2',
    'industrial-production', 'retail-sales', 'fixed-asset-investment',
  ]);
  assert.deepEqual(getDashboardIndicators().map((item) => item.id), dashboardIndicatorIds);
});

test('derives latest, previous, change, and provenance', () => {
  const m1 = getDashboardIndicators().find((item) => item.id === 'm1');
  assert.equal(m1.latest.date, '2025-10');
  assert.equal(m1.latest.value, 6.2);
  assert.deepEqual(m1.previous, { date: '2025-09', value: 7.2 });
  assert.equal(m1.change, -1);
  assert.equal(m1.dataset.source, 'PBOC');
  assert.equal(m1.dataset.updatedAt, '2025-11-19');
  assert.equal(m1.dataset.sources[0].url.startsWith('https://'), true);
  assert.equal(m1.conceptHref, '/concepts/m1');
});

test('does not invent a change for a single observation', () => {
  assert.deepEqual(deriveObservationSummary([{ date: '2026-01', value: 1.2 }]), {
    latest: { date: '2026-01', value: 1.2 }, previous: null, change: null,
  });
});

test('rejects an empty observation series', () => {
  assert.throws(() => deriveObservationSummary([]), /at least one observation/);
});
~~~

- [ ] Step 2: Verify the RED state

~~~bash
npm test -- tests/dashboard.test.mjs
~~~

Expected: FAIL because src/data/dashboard.ts does not exist. Fix test setup errors if necessary, but do not write production implementation before seeing the expected missing-module failure.

- [ ] Step 3: Implement the minimal adapter

Create src/data/dashboard.ts with this API:

~~~ts
import { getIndicatorData, type IndicatorDataset } from './indicatorRegistry';

export const dashboardIndicatorIds = [
  'gdp', 'pmi', 'm0', 'm1', 'm2',
  'industrial-production', 'retail-sales', 'fixed-asset-investment',
] as const;
export type DashboardIndicatorId = typeof dashboardIndicatorIds[number];
export type Observation = { date: string; value: number };
export type ObservationSummary = {
  latest: Observation;
  previous: Observation | null;
  change: number | null;
};
export type DashboardIndicator = ObservationSummary & {
  id: DashboardIndicatorId;
  name: string;
  conceptHref: string;
  dataset: IndicatorDataset;
};

const names: Record<DashboardIndicatorId, string> = {
  gdp: 'GDP', pmi: '制造业 PMI', m0: 'M0', m1: 'M1', m2: 'M2',
  'industrial-production': '工业增加值', 'retail-sales': '社会消费品零售',
  'fixed-asset-investment': '固定资产投资',
};

export function deriveObservationSummary(observations: Observation[]): ObservationSummary {
  const latest = observations.at(-1);
  if (!latest) throw new Error('Dashboard indicator must contain at least one observation');
  const previous = observations.at(-2) ?? null;
  return { latest, previous, change: previous ? latest.value - previous.value : null };
}

export function getDashboardIndicators(): DashboardIndicator[] {
  return dashboardIndicatorIds.map((id) => {
    const dataset = getIndicatorData(id);
    return {
      id, name: names[id], conceptHref: '/concepts/' + id, dataset,
      ...deriveObservationSummary(dataset.data),
    };
  });
}
~~~

- [ ] Step 4: Verify GREEN

~~~bash
npm test -- tests/dashboard.test.mjs
~~~

Expected: all dashboard adapter tests pass with 0 failures.

- [ ] Step 5: Commit the adapter

~~~bash
git add src/data/dashboard.ts tests/dashboard.test.mjs
git commit -m "feat: add dashboard indicator adapter"
~~~

### Task 3: Build the dashboard component and responsive styles

**Files:**
- Create: src/components/MacroDashboard.astro
- Create: src/styles/dashboard.css
- Modify: tests/dashboard.test.mjs
- Modify: src/pages/index.astro

- [ ] Step 1: Add failing source-contract tests

Append tests that read the three source files and assert:

~~~js
assert.match(componentSource, /更新：/);
assert.match(componentSource, /核验来源/);
assert.match(componentSource, /conceptHref/);
assert.match(componentSource, /近期变化/);
assert.match(styleSource, /@media\s*\(max-width:\s*760px\)/);
assert.match(styleSource, /dashboard-grid/);
assert.match(homepageSource, /MacroDashboard/);
assert.match(homepageSource, /TransmissionPaths/);
assert.match(homepageSource, /先认识两种“钱”/);
~~~

Use node:fs readFileSync and node:url fileURLToPath, as in the existing repository tests.

- [ ] Step 2: Verify the RED state

~~~bash
npm test -- tests/dashboard.test.mjs
~~~

Expected: FAIL because the component, stylesheet, and homepage integration do not exist yet.

- [ ] Step 3: Implement MacroDashboard.astro

The component accepts indicators: DashboardIndicator[] and imports ../styles/dashboard.css. It renders a section.dashboard headed “现在，宏观数据说什么？” with a static/no-runtime-request note.

For every indicator render one .indicator-card containing the display name, dataset label, latest value, latest data period, update date, official source, and change versus the previous observation. Render a concept link using item.conceptHref and a details disclosure listing every dataset source URL, title, coverage, and source date.

Render a .dashboard-changes section titled “最近一期变化” with each indicator period and formatted change linked to its concept page. Use one decimal place; append percent signs only when the dataset unit is %. The frontmatter formatting functions must be equivalent to:

~~~ts
const formatValue = (value: number, unit: string) =>
  value.toFixed(1) + (unit === '%' ? '%' : '');
const formatChange = (change: number | null, unit: string) => {
  if (change === null) return '—';
  return (change > 0 ? '+' : '') + change.toFixed(1) + (unit === '%' ? '%' : '');
};
~~~

Use — for null changes, + for positive changes, and is-negative for negative changes.

- [ ] Step 4: Add responsive dashboard styles

Create src/styles/dashboard.css using existing CSS variables. Provide a four-column desktop grid, two columns below 1000px, one column below 760px, readable long labels, source disclosure styles, and a distinct negative-change color. Include rules equivalent to:

~~~css
.dashboard-grid { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:14px; }
.indicator-card { min-width:0; padding:20px; background:var(--card); border:1px solid var(--line); border-radius:16px; }
.indicator-value { font:800 36px/1.1 var(--serif); color:var(--green); }
.dashboard-changes { margin-top:34px; padding:22px; background:#e8eee9; border:1px solid var(--line); border-radius:16px; }
@media (max-width: 1000px) {
  .dashboard-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
  .dashboard-head { align-items:start; flex-direction:column; }
  .dashboard-grid, .dashboard-changes ul { grid-template-columns:1fr; }
}
~~~

- [ ] Step 5: Integrate the component

In src/pages/index.astro import MacroDashboard and getDashboardIndicators, initialize dashboardIndicators, and render the component immediately after the hero. Keep TransmissionPaths, its paths, and all existing learning cards unchanged.

- [ ] Step 6: Verify GREEN and commit

~~~bash
npm test -- tests/dashboard.test.mjs
git add src/components/MacroDashboard.astro src/styles/dashboard.css src/pages/index.astro tests/dashboard.test.mjs
git commit -m "feat: add macro dashboard to homepage"
~~~

Expected: dashboard tests pass before the commit is created.

### Task 4: Run complete verification and inspect the final diff

**Files:** No planned additional files.

- [ ] Step 1: Run the complete test suite

~~~bash
npm test
~~~

Expected: all tests pass with 0 failures.

- [ ] Step 2: Run Astro checks

~~~bash
npm run check
~~~

Expected: exit code 0 with no type or content-schema errors.

- [ ] Step 3: Run the production build

~~~bash
npm run build
~~~

Expected: exit code 0; static pages and Pagefind are generated without runtime network requests.

- [ ] Step 4: Inspect the final diff

~~~bash
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git status --short --branch
~~~

Expected: no whitespace errors and no uncommitted source changes.

- [ ] Step 5: If verification exposes a defect, add a regression test first

Run the regression test red, make the minimal fix, rerun npm test, npm run check, and npm run build, then commit the focused correction.

### Task 5: Review and publish the pull request

**Files:** No source changes.

- [ ] Step 1: Request code review against origin/main

Use the code-reviewer prompt with this range, checking issue #68 alignment, static data-only behavior, provenance visibility, homepage preservation, responsive layout, and test coverage:

~~~bash
BASE_SHA=$(git rev-parse origin/main)
HEAD_SHA=$(git rev-parse HEAD)
git diff --stat "$BASE_SHA..$HEAD_SHA"
git diff "$BASE_SHA..$HEAD_SHA"
~~~

Fix all Critical and Important findings before publishing.

- [ ] Step 2: Push the branch

~~~bash
git push -u origin codex/issue-68-dashboard
~~~

- [ ] Step 3: Create the linked PR

Create a body with Closes #68, a concise feature summary, the eight covered datasets, verification results, and the note that CPI/Core CPI/PPI remain absent because no corresponding registered datasets exist:

~~~bash
gh pr create --repo SwartzMss/MacroLens --base main --head codex/issue-68-dashboard --title "feat: build macro dashboard and economic overview" --body-file /tmp/issue-68-pr-body.md
~~~
