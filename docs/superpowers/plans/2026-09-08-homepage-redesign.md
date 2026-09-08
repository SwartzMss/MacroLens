# MacroLens Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Redesign the MacroLens homepage as a concise macro-understanding entry point and expose the existing full Macro Snapshot at `/snapshot` without changing any macro or graph semantics.

**Architecture:** Keep `buildMacroSnapshot()`, `MacroSnapshot`, `getIndicatorData()`, and the graph registry as canonical domain sources. Add a small `src/data/home.ts` presentation view-model layer plus focused Astro components under `src/components/home/`; `src/pages/index.astro` composes those components, while `src/pages/snapshot.astro` renders the existing full Snapshot unchanged.

**Tech Stack:** Astro 7 static pages, TypeScript, Astro components/CSS, Node test runner with `tsx`.

---

## File map

- Create `src/data/home.ts`: fixed homepage signal IDs, learning-path configuration, canonical relationship-preview resolver, and Snapshot evidence selection.
- Create `src/components/home/HomeHero.astro`: product-positioning hero, CTA links, and lightweight chain visual.
- Create `src/components/home/MacroStateSummary.astro`: Snapshot synthesis and six domain state summaries.
- Create `src/components/home/NotableSignals.astro`: compact signal cards with canonical values, changes, and concept links.
- Create `src/components/home/RelationshipPreview.astro`: readable canonical relation chain and `/graph` CTA.
- Create `src/components/home/LearningPaths.astro`: four guided learning paths with concept links.
- Create `src/styles/home.css`: homepage-specific layout, semantic accents, focus states, and responsive rules.
- Create `src/pages/snapshot.astro`: public full Snapshot route using the existing component.
- Modify `src/pages/index.astro`: replace the sequential dashboard/report/catalogue composition with the new homepage composition and view models.
- Modify `src/styles/global.css`: only shared responsive/accessibility token adjustments required by the new home components.
- Modify `tests/homepage.test.mjs`: data and composition regressions for the redesigned homepage and `/snapshot` route.
- Modify `tests/macro-snapshot.test.mjs`: move the existing full Snapshot page assertions from the homepage to `/snapshot` while retaining component/model assertions.
- Modify `tests/dashboard.test.mjs`: update dashboard coverage to assert the generic component remains valid while the homepage uses the compact signal view.

## Task 1: Add failing homepage view-model tests

**Files:**
- Create: `tests/homepage.test.mjs`
- Create: `src/data/home.ts` (after the red test is observed)

- [ ] **Step 1: Write tests for configured signals, canonical relations, and learning paths.** Add tests that import `getHomepageRelationshipPreview`, `getNotableSignals`, and `learningPaths`; assert the configured signal IDs are exactly `['pmi', 'gdp', 'fixed-asset-investment', 'unemployment-rate', 'm2']`, each selected signal has a `/concepts/<id>` href, each learning-path concept ID matches a checked-in concept markdown file, and each preview edge exists in `getRelationData('macro')`.

At the top of `tests/homepage.test.mjs`, define the paths and imports used by the examples:

```js
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildMacroSnapshot } from '../src/data/macroSnapshot.ts';
import { getRelationData } from '../src/data/graphRegistry.ts';
import { getHomepageRelationshipPreview, getNotableSignals, learningPaths } from '../src/data/home.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const conceptsDirectory = `${root}src/content/concepts`;
const homeDirectory = `${root}src/components/home`;
const componentNames = ['HomeHero', 'MacroStateSummary', 'NotableSignals', 'RelationshipPreview', 'LearningPaths'];
const homepagePath = `${root}src/pages/index.astro`;
const snapshotPagePath = `${root}src/pages/snapshot.astro`;
```

```js
test('homepage view models use stable signals and valid concept routes', () => {
  const snapshot = buildMacroSnapshot();
  const signals = getNotableSignals(snapshot);

  assert.deepEqual(signals.map((signal) => signal.id), [
    'pmi', 'gdp', 'fixed-asset-investment', 'unemployment-rate', 'm2',
  ]);
  assert.ok(signals.every((signal) => signal.conceptHref === `/concepts/${signal.id}`));
});

test('homepage relationship preview resolves canonical graph edges', () => {
  const { relations } = getRelationData('macro');
  const relationKeys = new Set(relations.map((item) => `${item.source}|${item.target}|${item.type}`));

  for (const relation of getHomepageRelationshipPreview()) {
    assert.ok(relationKeys.has(`${relation.source}|${relation.target}|${relation.type}`));
  }
});

test('homepage learning paths link only to existing concepts', () => {
  const conceptIds = new Set(readdirSync(conceptsDirectory).map((name) => name.replace(/\.md$/, '')));
  for (const path of learningPaths) {
    assert.ok(path.title.trim());
    assert.ok(path.steps.length >= 2);
    for (const step of path.steps) assert.ok(conceptIds.has(step.id), `${path.title}/${step.id}`);
  }
});
```

- [ ] **Step 2: Run the focused test and verify it fails for the missing module.**

Run: `node --import tsx --test tests/homepage.test.mjs`

Expected: FAIL with a module-not-found error for `src/data/home.ts`.

- [ ] **Step 3: Implement the minimal canonical home view model.** In `src/data/home.ts`, export these exact types and values:

```ts
import type { Relation } from './graphRegistry';
import { getRelationData, requireRelation } from './graphRegistry';
import type { MacroSnapshot, SnapshotEvidence } from './macroSnapshot';

export const homepageNotableSignalIds = [
  'pmi', 'gdp', 'fixed-asset-investment', 'unemployment-rate', 'm2',
] as const;

export type HomepageNotableSignalId = typeof homepageNotableSignalIds[number];

export type HomepageNotableSignal = SnapshotEvidence & { id: HomepageNotableSignalId };
export type LearningPath = {
  number: string;
  title: string;
  description: string;
  steps: { id: string; label: string }[];
};

const previewRelations = [
  ['central-bank', 'monetary-policy', 'IMPLEMENTS'],
  ['monetary-policy', 'policy-rate', 'USES'],
  ['policy-rate', 'financing-conditions', 'AFFECTS'],
  ['financing-conditions', 'credit', 'AFFECTS'],
  ['credit', 'm2', 'AFFECTS'],
  ['m2', 'activity', 'CORRELATES'],
] as const;

export function getHomepageRelationshipPreview(): Relation[] {
  return previewRelations.map(([source, target, type]) => requireRelation('macro', source, target, type));
}

export const learningPaths: LearningPath[] = [
  { number: '01', title: '钱是什么？', description: '从最窄的现金到更广义的货币总量，先建立口径感。', steps: [{ id: 'm0', label: 'M0' }, { id: 'm1', label: 'M1' }, { id: 'm2', label: 'M2' }] },
  { number: '02', title: '钱是怎么创造出来的？', description: '沿着信贷、存款和社融理解货币如何进入实体经济。', steps: [{ id: 'credit', label: '信贷' }, { id: 'm2', label: '存款 / M2' }, { id: 'social-financing', label: '社融' }] },
  { number: '03', title: '央行怎么影响经济？', description: '从政策工具走到利率、融资条件和信用需求。', steps: [{ id: 'monetary-policy', label: '货币政策' }, { id: 'policy-rate', label: '政策利率' }, { id: 'lpr', label: 'LPR' }, { id: 'credit', label: '信贷' }] },
  { number: '04', title: '价格为什么变化？', description: '区分生产端、居民端和核心价格信号的观察角度。', steps: [{ id: 'ppi', label: 'PPI' }, { id: 'cpi', label: 'CPI' }, { id: 'core-cpi', label: '核心 CPI' }] },
];

export function getNotableSignals(snapshot: MacroSnapshot): HomepageNotableSignal[] {
  const evidence = new Map(snapshot.domains.flatMap((domain) => domain.evidence).map((item) => [item.id, item]));
  return homepageNotableSignalIds.map((id) => {
    const item = evidence.get(id);
    if (!item) throw new Error(`Homepage notable signal missing from Macro Snapshot: ${id}`);
    return { ...item, id };
  });
}

export function getHomepageRelationNodes() {
  const ids = new Set(getHomepageRelationshipPreview().flatMap((relation) => [relation.source, relation.target]));
  return getRelationData('macro').nodes.filter((node) => ids.has(node.id));
}
```

- [ ] **Step 4: Run the focused tests and verify they pass.**

Run: `node --import tsx --test tests/homepage.test.mjs`

Expected: PASS for all new view-model tests.

- [ ] **Step 5: Commit the view-model and tests.**

```bash
git add src/data/home.ts tests/homepage.test.mjs
git commit -m "feat: add homepage macro view models"
```

## Task 2: Build homepage presentation components with failing composition tests first

**Files:**
- Modify: `tests/homepage.test.mjs`
- Create: `src/components/home/HomeHero.astro`
- Create: `src/components/home/MacroStateSummary.astro`
- Create: `src/components/home/NotableSignals.astro`
- Create: `src/components/home/RelationshipPreview.astro`
- Create: `src/components/home/LearningPaths.astro`
- Create: `src/styles/home.css`

- [ ] **Step 1: Add source-level component contract tests before creating components.** Extend `tests/homepage.test.mjs` to read the five component files and assert the required section IDs/headings, `href` props, canonical `domain.state`/`domain.explanation` access, signal `conceptHref`, relation source/target labels, and `:focus-visible`/mobile CSS hooks.

```js
test('homepage components expose the required semantic sections and links', () => {
  const source = componentNames.map((name) => readFileSync(`${homeDirectory}/${name}.astro`, 'utf8')).join('\n');
  const styles = readFileSync(`${root}src/styles/home.css`, 'utf8');

  for (const id of ['home-hero', 'macro-state', 'notable-signals', 'relationship-preview', 'learning-paths']) {
    assert.match(source, new RegExp(`id=["']${id}["']`));
  }
  assert.match(source, /domain\.state/);
  assert.match(source, /domain\.explanation/);
  assert.match(source, /signal\.conceptHref/);
  assert.match(source, /relation\.source/);
  assert.match(source, /relation\.target/);
  assert.match(source, /\/graph/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media\s*\(max-width:\s*760px\)/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails because components/styles do not exist.**

Run: `node --import tsx --test tests/homepage.test.mjs`

Expected: FAIL while reading the missing component/style files.

- [ ] **Step 3: Implement the five Astro components.** Use props-only components with these contracts:

```ts
// HomeHero: { relationshipHref: string }
// MacroStateSummary: { snapshot: MacroSnapshot }
// NotableSignals: { signals: HomepageNotableSignal[] }
// RelationshipPreview: { relations: Relation[]; nodes: RelationNode[]; concepts: CollectionEntry<'concepts'>[] }
// LearningPaths: { paths: LearningPath[]; concepts: CollectionEntry<'concepts'>[] }
```

`MacroStateSummary` renders `{snapshot.synthesis.label}`, `{snapshot.synthesis.explanation}`, and exactly six `snapshot.domains` entries with `data-state={domain.state}`. `NotableSignals` renders each signal name/value/change and links to `signal.conceptHref`. `RelationshipPreview` resolves labels from the supplied canonical `nodes` map, uses the supplied concept collection to link concept nodes to `/concepts/<id>`, and uses text arrows; it includes a link to `/graph`. `LearningPaths` maps each configured step to `/concepts/${step.id}` only when its `concepts` prop confirms that ID exists.

- [ ] **Step 4: Add focused homepage styles.** Create `src/styles/home.css` with editorial section rhythm, a two-column hero, synthesis panel, six-domain matrix, five-signal grid, vertical/desktop relationship chain, path cards, `:hover`, `:focus-visible`, and `@media (max-width: 760px)` rules. Keep colors on existing CSS variables and do not add gradients or heavy shadows.

- [ ] **Step 5: Run the focused tests and verify they pass.**

Run: `node --import tsx --test tests/homepage.test.mjs`

Expected: PASS for view-model and component contract tests.

- [ ] **Step 6: Commit the homepage presentation components.**

```bash
git add src/components/home src/styles/home.css tests/homepage.test.mjs
git commit -m "feat: add macro homepage presentation sections"
```

## Task 3: Recompose the homepage and add `/snapshot`

**Files:**
- Modify: `src/pages/index.astro`
- Create: `src/pages/snapshot.astro`
- Modify: `tests/homepage.test.mjs`
- Modify: `tests/macro-snapshot.test.mjs`
- Modify: `tests/dashboard.test.mjs`

- [ ] **Step 1: Add failing route/composition assertions.** Assert `index.astro` imports all five home components and `buildMacroSnapshot`, does not import/render `MacroDashboard`, `MacroSnapshot`, or `TransmissionPaths`, contains the section order `HomeHero` → `MacroStateSummary` → `NotableSignals` → `RelationshipPreview` → `LearningPaths`, and links to `/snapshot`. Assert `snapshot.astro` imports `MacroSnapshot` and `buildMacroSnapshot`, and renders all six-domain full Snapshot component.

```js
test('homepage is a narrative entry point and full snapshot has its own route', () => {
  const home = readFileSync(homepagePath, 'utf8');
  const snapshot = readFileSync(snapshotPagePath, 'utf8');
  for (const name of ['HomeHero', 'MacroStateSummary', 'NotableSignals', 'RelationshipPreview', 'LearningPaths']) assert.match(home, new RegExp(name));
  assert.doesNotMatch(home, /MacroDashboard|<MacroSnapshot|TransmissionPaths/);
  assert.match(home, /href=["']\/snapshot["']/);
  assert.match(snapshot, /MacroSnapshot/);
  assert.match(snapshot, /buildMacroSnapshot/);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail against the current composition.**

Run: `node --import tsx --test tests/homepage.test.mjs tests/macro-snapshot.test.mjs tests/dashboard.test.mjs`

Expected: FAIL because the old homepage still renders the dashboard/full Snapshot and `/snapshot` does not exist.

- [ ] **Step 3: Rewrite `src/pages/index.astro` as the new composition.** Keep `getCollection('concepts')`, build one canonical Snapshot, obtain home signals/relations/nodes, and render components in the planned order. Add a page title/description through `BaseLayout` if needed; do not change the data models.

- [ ] **Step 4: Create `src/pages/snapshot.astro`.** Use `BaseLayout` with title `Macro Snapshot｜MacroLens` and a description explaining that the page contains the complete rule-based macro state, evidence, risks, and watch-next report. Build the Snapshot once and render `<MacroSnapshot snapshot={snapshot} />`.

- [ ] **Step 5: Update focused tests to assert the new public boundary.** Move page-level assertions that the full Snapshot is present from `index.astro` to `snapshot.astro`. Keep assertions that `MacroSnapshot.astro` renders evidence without implementation metadata. Update dashboard tests to verify the generic component and its data helpers remain covered without requiring the old homepage wall.

- [ ] **Step 6: Run focused tests and verify the new composition passes.**

Run: `node --import tsx --test tests/homepage.test.mjs tests/macro-snapshot.test.mjs tests/dashboard.test.mjs tests/relationship-graph.test.mjs tests/information-architecture.test.mjs`

Expected: PASS with the homepage no longer rendering the full evidence report and `/snapshot` owning that report.

- [ ] **Step 7: Commit the routes and composition.**

```bash
git add src/pages/index.astro src/pages/snapshot.astro tests/homepage.test.mjs tests/macro-snapshot.test.mjs tests/dashboard.test.mjs
git commit -m "feat: redesign homepage around macro state"
```

## Task 4: Run full verification and polish only from evidence

**Files:**
- Modify: any homepage component/style/test files that fail verification

- [ ] **Step 1: Run the full JavaScript test suite.**

Run: `npm test`

Expected: exit code 0 with zero failures.

- [ ] **Step 2: Run Astro type and template validation.**

Run: `npm run check`

Expected: exit code 0 with no errors.

- [ ] **Step 3: Build the static site and verify output metadata.**

Run: `npm run build`

Expected: exit code 0, with both `/index.html` and `/snapshot/index.html` emitted.

- [ ] **Step 4: Run output visibility checks.**

Run: `npm run test:output`

Expected: exit code 0.

- [ ] **Step 5: Inspect the final diff for scope and accessibility.**

Run:

```bash
git diff --check
git diff --stat
git status --short
```

Expected: only Issue #130 design/plan, home view-model/components/styles, homepage/snapshot routes, and focused test updates are present; no generated `dist` output is tracked.

- [ ] **Step 6: Commit any evidence-based fixes.**

```bash
git add src tests
git commit -m "fix: polish homepage validation issues"
```

Only create this commit if the verification commands identify a concrete issue.
