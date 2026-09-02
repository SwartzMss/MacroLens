# NBS PMI Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fixture-tested NBS manufacturing PMI ingestion pipeline that safely appends official observations to `data/indicators/pmi.json` and opens a PR only when data changes.

**Architecture:** Use a small TypeScript CLI with explicit `fetch`, `normalize`, `validate`, `overlap`, and `write` modules. The NBS adapter discovers a data publication from the official aggregation page, parses only the main PMI column, validates it against the existing dataset, and writes deterministic JSON; GitHub Actions supplies live fetch and reviewable PR orchestration.

**Tech Stack:** Node.js 20, TypeScript executed by `tsx`, Node built-in `fetch`, Node `assert`/`node:test`, checked-in HTML fixtures, GitHub Actions, `peter-evans/create-pull-request`.

---

### Task 1: Define the ingestion contracts with failing tests

**Files:**
- Create: `tests/ingestion-pmi.test.mjs`
- Create: `tests/fixtures/nbs/publication-index.html`
- Create: `tests/fixtures/nbs/pmi-2026-08.html`
- Modify: `package.json`
- Test: `tests/ingestion-pmi.test.mjs`

- [ ] **Step 1: Add the CLI command contract**

Add an `ingest:pmi` script to `package.json`:

```json
"ingest:pmi": "tsx scripts/ingest/cli.ts"
```

Do not add a network-dependent command to `npm test`.

- [ ] **Step 2: Add checked-in NBS fixtures**

Save a minimal but structurally faithful copy of the official aggregation HTML at `tests/fixtures/nbs/publication-index.html`. It must contain both links on the same publication date:

```html
<a href="/sj/zxfbhjd/202608/t20260831_1965154.html">2026年8月中国采购经理指数运行情况</a>
<span>2026-08-31</span>
<a href="/sj/zxfbhjd/202608/t20260831_1965155.html">国家统计局服务业调查中心首席统计师解读2026年8月中国采购经理指数</a>
<span>2026-08-31</span>
```

Save a minimal official publication page at `tests/fixtures/nbs/pmi-2026-08.html` containing the heading `表1 中国制造业PMI及构成指数`, a table header with `PMI`, the rows `2025年8月` through `2026年8月`, and the official main-index values `49.4, 49.8, 49.0, 49.2, 50.1, 49.3, 49.0, 50.4, 50.3, 50.0, 50.3, 49.2, 49.8`. Include different component-index values in other columns so the test can prove the parser selects only the PMI column.

- [ ] **Step 3: Write failing discovery and parser tests**

Import the not-yet-created functions from `scripts/ingest/fetch/nbs-pmi.ts` and assert:

```js
const publication = discoverLatestPmiPublication(indexFixture);
assert.deepEqual(publication, {
  title: '2026年8月中国采购经理指数运行情况',
  url: 'https://www.stats.gov.cn/sj/zxfbhjd/202608/t20260831_1965154.html',
  sourceDate: '2026-08-31',
});

const raw = parsePmiPublication(publication, publicationFixture);
assert.deepEqual(raw.observations.slice(-2), [
  { date: '2026-07', value: 49.2 },
  { date: '2026-08', value: 49.8 },
]);
assert.equal(raw.observations.length, 13);
assert.equal(raw.observations.some(({ value }) => value === 51.4), false);
```

Add failure cases for a fixture containing only the interpretation link, a missing publication date, a missing table heading, a missing PMI column, a non-numeric PMI cell, and a non-contiguous month sequence. Every case must throw an error naming the missing or invalid contract.

- [ ] **Step 4: Run the tests to verify RED**

Run:

```bash
node --import tsx tests/ingestion-pmi.test.mjs
```

Expected: module-not-found or missing-export failures for the unimplemented fetch/parser module, with no fixture or test syntax errors.

### Task 2: Implement NBS discovery and PMI-only parsing

**Files:**
- Create: `scripts/ingest/fetch/nbs-pmi.ts`
- Create: `scripts/ingest/types.ts`
- Test: `tests/ingestion-pmi.test.mjs`

- [ ] **Step 1: Define the shared source types and errors**

In `scripts/ingest/types.ts`, define:

```ts
export type IndicatorSource = { title: string; url: string; sourceDate: string; coverage: string };
export type IndicatorDataset = {
  id: string; country: string; frequency: string; unit: string; metric: string;
  label: string; chartTitle: string; definitionEffectiveFrom?: string;
  definitionAsOf?: string; source: string; calculation: string; updatedAt: string;
  comparabilityNote: string; sources: IndicatorSource[]; referenceValue?: number;
  referenceLabel?: string; data: Observation[];
};
export type PmiPublication = { title: string; url: string; sourceDate: string };
export type Observation = { date: string; value: number };
export type RawPmiPublication = { publication: PmiPublication; observations: Observation[] };
export class HistoricalMismatchError extends Error {}
```

Use named errors for discovery/parser failures so the CLI can print a useful failure without treating malformed data as an empty update.

- [ ] **Step 2: Implement strict publication discovery**

Export `discoverLatestPmiPublication(indexHtml: string): PmiPublication`. Parse anchor/date pairs with a narrow title pattern containing exactly `中国采购经理指数运行情况`; reject titles containing `解读`; require a valid ISO publication date; choose the newest matching date; resolve relative links against `https://www.stats.gov.cn/`; throw if no valid candidate exists.

- [ ] **Step 3: Implement strict publication parsing**

Export `parsePmiPublication(publication: PmiPublication, html: string): RawPmiPublication`. Require the exact table heading `表1 中国制造业PMI及构成指数`, locate the table whose header contains `PMI`, parse only its first/main `PMI` column, normalize `YYYY年M月` to `YYYY-MM`, reject blanks and non-finite values, require values in `[0, 100]`, reject duplicate dates, sort by date, and require consecutive monthly dates. Ignore all component columns even when they are present.

- [ ] **Step 4: Run the parser tests to verify GREEN**

Run:

```bash
node --import tsx tests/ingestion-pmi.test.mjs
```

Expected: discovery, PMI-only extraction, date normalization, strict-selection, and all malformed-fixture tests pass.

### Task 3: Normalize, validate, and reject unsafe overlaps

**Files:**
- Create: `scripts/ingest/normalize/pmi.ts`
- Create: `scripts/ingest/validate/dataset.ts`
- Create: `scripts/ingest/validate/overlap.ts`
- Modify: `tests/ingestion-pmi.test.mjs`
- Test: `tests/ingestion-pmi.test.mjs`

- [ ] **Step 1: Write normalization and validation failure tests**

Add tests that call `normalizePmiDataset(rawPublication, existingDataset)` and `validateIndicatorDataset(dataset)`. Assert that normalization preserves the existing `id`, `country`, `frequency`, `unit`, `metric`, `label`, `chartTitle`, `calculation`, `definitionAsOf`, and `comparabilityNote`, updates `updatedAt` and the latest source, merges observations in chronological order, and keeps the output metric as `index` with unit `index`.

Add failures for a changed `metric`, `unit`, `frequency`, `calculation`, or `definitionAsOf`; missing `sources[]` provenance; an empty observation list; duplicate dates; out-of-order observations; and values outside `[0, 100]`.

- [ ] **Step 2: Write the historical overlap contract**

Add tests using the current `pmi.json` as the existing dataset:

```js
const merged = mergePmiObservations(existing.data, raw.observations);
assert.deepEqual(merged.data.slice(-3), [
  { date: '2026-06', value: 50.3 },
  { date: '2026-07', value: 49.2 },
  { date: '2026-08', value: 49.8 },
]);

assert.throws(
  () => mergePmiObservations(existing.data, [{ date: '2025-09', value: 49.7 }]),
  HistoricalMismatchError,
);
```

The overlap check must compare every same-date value before returning any merged output, so a mismatch cannot partially write new observations.

- [ ] **Step 3: Implement deterministic normalization and dataset validation**

In `normalize/pmi.ts`, export `normalizePmiDataset(raw: RawPmiPublication, existing: IndicatorDataset): IndicatorDataset` using the shared type from `scripts/ingest/types.ts`. Copy immutable series semantics from `existing`, merge observations through the overlap validator, keep only a bounded source list consisting of the existing historical baseline source(s) and one rolling latest authoritative source, and update the latest source’s `sourceDate`/`coverage` from the publication. Do not parse or emit component indices.

In `validate/dataset.ts`, export `validateIndicatorDataset(dataset: IndicatorDataset): void`. Assert required strings, `frequency === 'monthly'`, `unit === 'index'`, `metric === 'index'`, `calculation === 'published'`, non-empty sources with official `stats.gov.cn` URLs, sorted unique dates, finite values in `[0, 100]`, and `updatedAt` matching the latest authoritative publication date.

In `validate/overlap.ts`, export `mergePmiObservations(existing: Observation[], incoming: Observation[]): Observation[]`; throw `HistoricalMismatchError` on any same-date value mismatch, then return a sorted, deduplicated merge when all overlaps agree.

- [ ] **Step 4: Run normalization and validation tests to verify GREEN**

Run:

```bash
node --import tsx tests/ingestion-pmi.test.mjs
```

Expected: all normalization, schema, provenance, source-bounding, overlap-equality, and mismatch-hard-failure tests pass.

### Task 4: Add deterministic writing and the end-to-end CLI

**Files:**
- Create: `scripts/ingest/write/indicator.ts`
- Create: `scripts/ingest/cli.ts`
- Modify: `tests/ingestion-pmi.test.mjs`
- Modify: `data/indicators/pmi.json`
- Test: `tests/ingestion-pmi.test.mjs`

- [ ] **Step 1: Write file-writer and unchanged-output tests**

Export `writeIndicatorDataset(path: string, dataset: IndicatorDataset): { changed: boolean; output: string }`. Test that it uses two-space JSON indentation plus a final newline, does not rewrite an identical file, returns `changed: false` for identical normalized content, and returns `changed: true` with the expected output when 2025-11 through 2026-08 are appended.

- [ ] **Step 2: Implement stable writing**

Read the existing target file, serialize the validated dataset with `JSON.stringify(dataset, null, 2) + '\n'`, compare strings, and write only when different. Never write before discovery, parse, normalization, validation, and overlap checks have completed.

- [ ] **Step 3: Implement the CLI with fixture and live modes**

Make `scripts/ingest/cli.ts` support:

```text
npm run ingest:pmi -- --fixture-index tests/fixtures/nbs/publication-index.html --fixture-publication tests/fixtures/nbs/pmi-2026-08.html --target data/indicators/pmi.json
npm run ingest:pmi -- --target data/indicators/pmi.json
```

Fixture mode reads both local fixtures and uses no network. Live mode fetches the fixed NBS aggregation URL, discovers the latest publication, fetches that publication, then runs the same normalize/validate/write path. Print the selected URL, source date, observation range, and `changed` status. Exit nonzero on any error, including `HistoricalMismatchError`; do not catch and convert errors into an unchanged result.

- [ ] **Step 4: Run the end-to-end fixture command**

Run the fixture command above against a temporary copy of `data/indicators/pmi.json` and assert that it appends 2025-11 through 2026-08, preserves the existing history, and keeps the bounded source policy. Run it a second time and assert no diff is produced.

- [ ] **Step 5: Update the checked-in PMI dataset from the official fixture**

Run the same fixture command with the repository target. The committed `data/indicators/pmi.json` must contain the 13-month official overlap/new range through `2026-08`, preserve `IndicatorDataset` fields, and use the rolling latest source instead of adding one source per month.

### Task 5: Add the scheduled/manual reviewable PR workflow

**Files:**
- Create: `.github/workflows/update-macro-data.yml`
- Test: `tests/ingestion-pmi.test.mjs` or a new static workflow assertion in that file

- [ ] **Step 1: Write workflow contract assertions**

Read the YAML as text and assert it contains `workflow_dispatch`, a monthly `schedule`, `npm ci`, `npm run ingest:pmi`, `contents: write`, `pull-requests: write`, and `peter-evans/create-pull-request`. Assert it does not invoke browser-side fetching or an unofficial data host.

- [ ] **Step 2: Add the workflow**

Create a Node 20 workflow that runs on `workflow_dispatch` and at `30 2 1 * *`, checks out the repository, installs with `npm ci`, runs the live PMI CLI, and invokes `peter-evans/create-pull-request@v7` with `data/indicators/pmi.json` as the only path. Configure the action with a stable update branch, title, body, and `delete-branch: true`; the action must see no diff and therefore create no commit/PR when the writer reports unchanged.

- [ ] **Step 3: Run workflow assertions**

Run:

```bash
node --import tsx tests/ingestion-pmi.test.mjs
```

Expected: workflow contract tests pass without executing GitHub Actions or contacting the NBS site.

### Task 6: Full verification, commit, push, and PR

**Files:**
- Modify only the ingestion modules, PMI dataset, fixture/test files, package script, and workflow listed above.

- [ ] **Step 1: Run the complete local verification**

Run:

```bash
npm test
npm run check
npm run build
git diff --check
git status --short
```

Expected: all tests pass; Astro reports 0 errors, warnings, and hints; the static build and Pagefind complete; diff check is clean; no homepage or runtime-fetch files changed.

- [ ] **Step 2: Inspect the generated dataset contract**

Run a JSON assertion that `data/indicators/pmi.json` has exactly the expected top-level fields, 2025-08 through 2026-08 recent observations, no duplicate dates, sorted data, only the main PMI series, and bounded official source metadata.

- [ ] **Step 3: Commit the implementation**

```bash
git add scripts/ingest tests/fixtures/nbs tests/ingestion-pmi.test.mjs data/indicators/pmi.json package.json .github/workflows/update-macro-data.yml
git commit -m "feat: automate NBS PMI updates"
```

- [ ] **Step 4: Push and create the PR**

```bash
git push -u origin codex/issue-45-pmi-ingestion
gh pr create --base main --head codex/issue-45-pmi-ingestion --title "feat: automate NBS PMI updates" --body-file /tmp/issue-45-pr-body.md
```

The PR body must close Issue #45, explain the four-layer boundary, call out PMI-only scope, hard overlap failure, bounded provenance, fixture-only ordinary tests, and scheduled/manual PR updates. After creation, run `gh pr view` and `gh pr checks`; report the exact head and remote status without merging.
