# Official Price Data Pipelines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add official, validated, atomic monthly CPI, core CPI, and PPI datasets and expose them in the dashboard and descriptive macro snapshot.

**Architecture:** Add a price-specific NBS release-page adapter that reuses the existing shared fetch boundary and overlap conventions without refactoring working pipelines. Parse CPI/PPI published YoY values and the Core CPI YoY table column from official NBS monthly release pages, validate all three series in memory, then write them through one staged group transaction. Extend the registry, metric-aware dashboard formatter, and snapshot with a separate `price-yoy` family.

**Tech Stack:** TypeScript, Node test runner, `tsx`, Astro, official NBS release pages, JSON fixtures, GitHub Actions.

**Status:** Implemented in PR #75

---

## File map

Create:

- `scripts/ingest/fetch/nbs-prices.ts`: official release discovery, parser, and provenance.
- `scripts/ingest/validate/prices.ts`: exact contracts, monthly continuity, source and methodology checks.
- `scripts/ingest/normalize/prices.ts`: overlap merge and deterministic dataset construction.
- `scripts/ingest/write/group.ts`: staged multi-file write, no-change short circuit, and rollback.
- `scripts/ingest/price-cli.ts`: fixture/live orchestration for all three datasets.
- `tests/ingestion-nbs-prices.test.mjs`: adapter, validation, normalization, CLI, and transaction tests.
- `tests/fixtures/nbs/prices/`: official-shaped payloads and publication/methodology fixtures.
- `data/indicators/cpi.json`, `data/indicators/core-cpi.json`, `data/indicators/ppi.json`: generated datasets.

Modify:

- `scripts/ingest/types.ts`, `package.json`, `.github/workflows/update-macro-data.yml`.
- `src/data/indicatorRegistry.ts`, `src/data/dashboard.ts`, `src/components/MacroDashboard.astro`.
- `src/data/macroSnapshot.ts`, `src/components/MacroSnapshot.astro`.
- `tests/dashboard.test.mjs`, `tests/macro-snapshot.test.mjs`.

## Task 1: Define contracts and validation

**Files:** `scripts/ingest/types.ts`, `scripts/ingest/validate/prices.ts`, `tests/ingestion-nbs-prices.test.mjs`

- [ ] **Step 1: Add exact price types and contracts.**

Add:

    export type PriceDatasetId = 'cpi' | 'core-cpi' | 'ppi';
    export type PriceContract = {
      id: PriceDatasetId;
      sourceCode: string;
      sourceTitle: string;
      frequency: 'monthly';
      unit: '%';
      metric: 'yoy';
      calculation: 'published';
      methodologyFingerprint: string;
    };
    export type NbsPricePublication = {
      title: string;
      url: string;
      sourceDate: string;
      coverage: string;
    };
    export type RawNbsPriceSeries = {
      publication: NbsPricePublication;
      id: PriceDatasetId;
      seriesCode: string;
      seriesTitle: string;
      unit: string;
      frequency: string;
      metric: string;
      methodologyFingerprint: string;
      dataSources: IndicatorSource[];
      observations: Observation[];
    };

Define `PRICE_CONTRACTS` and `PRICE_METHODOLOGY_FINGERPRINTS` for the three
published series. The source codes are stable MacroLens contract identifiers;
the official NBS release URL, title, source date, coverage, and methodology
marker are validated by the release-page parser.

- [ ] **Step 2: Write failing validator tests.**

Cover exact ID/country/frequency/unit/metric/source/calculation, methodology
fingerprint mismatch, official NBS source URLs, source coverage, duplicate
months, malformed dates, non-finite values, and missing months:

    assert.doesNotThrow(() => validatePriceObservations([
      { date: '2026-01', value: 0.2 },
      { date: '2026-02', value: 0.3 },
      { date: '2026-03', value: 0.1 },
    ], 'cpi'));
    assert.throws(() => validatePriceObservations([
      { date: '2026-01', value: 0.2 },
      { date: '2026-03', value: 0.1 },
    ], 'cpi'), IngestionContractError);

- [ ] **Step 3: Implement monthly validation.**

Implement `validatePriceObservations` with exact `YYYY-MM` parsing and a
calendar-month successor. January and February remain separate; no combined
period exception is allowed. Implement `validatePriceDataset` by composing
`validateIndicatorDataset` with price identity, methodology, source, and
coverage checks. Use `MethodologyMismatchError` only for fingerprint changes.

- [ ] **Step 4: Verify and commit the contract layer.**

Run `npm test -- --test-name-pattern='price contracts|price observations'`,
confirm focused tests pass, then:

    git add scripts/ingest/types.ts scripts/ingest/validate/prices.ts tests/ingestion-nbs-prices.test.mjs
    git commit -m "feat: define official price dataset contracts"

## Task 2: Implement and fixture the official NBS adapter

**Files:** `scripts/ingest/fetch/nbs-prices.ts`, `tests/fixtures/nbs/prices/`, `tests/ingestion-nbs-prices.test.mjs`

- [ ] **Step 1: Verify the official release-page shapes.**

Verify the formal NBS CPI and PPI monthly release pages and their release-index
entries. Confirm that CPI/PPI publish the required YoY sentence, that the CPI
table contains the official `不包括食品和能源` row with `环比`, `同比`, and
`累计同比` columns, and that the pages expose the 2025-base methodology
marker. Core CPI must be read from that official table, never calculated
locally or taken from an interpretation page.

- [ ] **Step 2: Add release-page fixtures and parser tests.**

Create official-shaped HTML fixtures for CPI, Core CPI, and PPI, including the
release metadata and observable methodology marker. Assert exact identity,
unit, monthly frequency, `yoy` metric, ordered months, published CPI/PPI
values, and the Core CPI table's `同比` value. Reject missing methodology
markers, malformed values, unsupported IDs, non-official URLs, and a Core CPI
page that has no official table row.

- [ ] **Step 3: Implement the shared-boundary fetch and parser.**

Implement release-index discovery and page fetching through the shared
`fetchText` boundary. Parse CPI/PPI published YoY sentences and the Core CPI
official table row. Validate the release URL, source date, exact monthly
coverage, and observable 2025-base marker before assigning the expected
methodology fingerprint. The module must contain no direct global `fetch(`
call.

- [ ] **Step 4: Run and commit.**

Run `npm test -- --test-name-pattern='NBS price|Core CPI|methodology'`, then:

    git add scripts/ingest/fetch/nbs-prices.ts tests/fixtures/nbs/prices tests/ingestion-nbs-prices.test.mjs
    git commit -m "feat: parse official NBS price series"

## Task 3: Normalize price history

**Files:** `scripts/ingest/normalize/prices.ts`, `tests/ingestion-nbs-prices.test.mjs`

- [ ] **Step 1: Write overlap and metadata tests.**

Test exact overlap acceptance, changed historical value rejection, stale
publication rejection, source pruning, deterministic `updatedAt`, and
methodology mismatch:

    const normalized = normalizePriceDataset(
      rawPrice('cpi', [{ date: '2026-02', value: 0.3 }, { date: '2026-03', value: 0.1 }]),
      existingPrice('cpi', [{ date: '2026-01', value: 0.2 }, { date: '2026-02', value: 0.3 }]),
      'cpi',
    );
    assert.deepEqual(normalized.data.map(({ date }) => date), ['2026-01', '2026-02', '2026-03']);

- [ ] **Step 2: Implement `normalizePriceDataset`.**

Follow `normalizeRealEconomyDataset`: validate existing data, require raw ID
and fingerprint equality, validate raw monthly observations, reject an older
publication that adds a period, merge with `mergeObservations`, retain
methodology anchors, and validate the complete result. Build deterministic
labels, chart titles, official sources, `source: 'NBS'`,
`calculation: 'published'`, and a comparability note explaining published
YoY semantics. Set `updatedAt` to the newest retained source date.

- [ ] **Step 3: Run and commit.**

    npm test -- --test-name-pattern='price normalization|historical value|methodology'
    git add scripts/ingest/normalize/prices.ts tests/ingestion-nbs-prices.test.mjs
    git commit -m "feat: normalize and validate price history"

## Task 4: Add atomic group writing and the CLI

**Files:** `scripts/ingest/write/group.ts`, `scripts/ingest/price-cli.ts`, `package.json`, `tests/ingestion-nbs-prices.test.mjs`

- [ ] **Step 1: Write transaction tests first.**

Use a temporary directory containing all three existing datasets. Assert that
a malformed CPI/Core CPI/PPI candidate leaves all files byte-for-byte unchanged,
a valid run writes all three, and a second identical run reports no changes.

    test('price group validation failure leaves every target untouched', async () => {
      const before = await readTargets(targetDir);
      await assert.rejects(() => runPrices(failingFixtureArgs));
      assert.deepEqual(await readTargets(targetDir), before);
    });

- [ ] **Step 2: Implement `writeIndicatorDatasetGroup`.**

Use:

    export async function writeIndicatorDatasetGroup(
      outputs: Map<string, string>,
    ): Promise<{ changed: boolean }>;

Read every target before writing. Return `{ changed: false }` when all bytes
match. Otherwise write all outputs to a sibling staging directory, verify staged
bytes, commit with same-filesystem renames and backup rollback, restore every
existing target on any failure, and remove staging. The CLI calls this only
after every candidate passes normalization and validation.

- [ ] **Step 3: Implement `runPrices`.**

Mirror real-economy CLI options:

    npm run ingest:nbs-prices -- [--fixture-index FILE --fixture-dir DIR] [--target-dir DIR]

Load and validate all three existing files before fetching. Fixture mode reads
one index and three payloads; live mode discovers publication metadata once,
fetches/normalizes/validates all three, serializes all three, and calls the
group writer once. Print each latest period and changed status; exit nonzero on
any error.

- [ ] **Step 4: Register, test, and commit.**

Add `"ingest:nbs-prices": "node --import tsx scripts/ingest/price-cli.ts"`.
Run `npm test -- --test-name-pattern='price group|runPrices|idempotent'`,
then:

    git add scripts/ingest/write/group.ts scripts/ingest/price-cli.ts package.json tests/ingestion-nbs-prices.test.mjs
    git commit -m "feat: atomically ingest official price datasets"

## Task 5: Generate datasets and wire scheduled updates

**Files:** `data/indicators/cpi.json`, `data/indicators/core-cpi.json`, `data/indicators/ppi.json`, `.github/workflows/update-macro-data.yml`, `tests/ingestion-nbs-prices.test.mjs`

- [ ] **Step 1: Add generation assertions.**

Run the fixture-backed CLI into a temporary directory and compare bytes with
the checked-in datasets. Assert complete monthly sequences, truthful coverage,
deterministic release metadata, and Core CPI values equal the official Core CPI
row rather than a formula over CPI.

- [ ] **Step 2: Generate the committed JSON.**

Use the validated fixture-backed CLI to create the three files in
`data/indicators`. Confirm sorted observations, stable fingerprints, official
sources, and source-derived `updatedAt`.

- [ ] **Step 3: Wire the workflow.**

Add after real-economy ingestion:

    - name: Fetch and validate NBS price indicators
      run: npm run ingest:nbs-prices -- --target-dir data/indicators

Add these exact paths to `add-paths`:

    data/indicators/cpi.json
    data/indicators/core-cpi.json
    data/indicators/ppi.json

- [ ] **Step 4: Test and commit.**

Assert the workflow contains the command and all three paths, run the
ingestion tests, then:

    git add data/indicators/cpi.json data/indicators/core-cpi.json data/indicators/ppi.json .github/workflows/update-macro-data.yml tests/ingestion-nbs-prices.test.mjs
    git commit -m "feat: schedule official price data updates"

## Task 6: Extend dashboard registry and formatting

**Files:** `src/data/indicatorRegistry.ts`, `src/data/dashboard.ts`, `src/components/MacroDashboard.astro`, `tests/dashboard.test.mjs`

- [ ] **Step 1: Update failing expectations.**

Expect eleven IDs in this order:

    ['gdp', 'pmi', 'm0', 'm1', 'm2',
     'industrial-production', 'retail-sales', 'fixed-asset-investment',
     'cpi', 'core-cpi', 'ppi']

Assert names `CPI`, `核心 CPI`, `PPI`, concept links, and `metric ===
'yoy'` for all three.

- [ ] **Step 2: Register imports, IDs, and names.**

Import the JSON datasets, extend the registry map and ID union, and add the
three names. Keep the existing card and concept-link path.

- [ ] **Step 3: Make change formatting metric-aware.**

Use a `changeSuffix(metric)` helper: `yoy` and `cumulative_yoy` return
` 个百分点`, `index` returns ` 点`, and other metrics return an empty
suffix. Pass `item.dataset.metric` in both dashboard change locations. Keep
current level values formatted with their dataset unit.

- [ ] **Step 4: Run and commit.**

    npm test -- --test-name-pattern='dashboard|metric-aware'
    git add src/data/indicatorRegistry.ts src/data/dashboard.ts src/components/MacroDashboard.astro tests/dashboard.test.mjs
    git commit -m "feat: expose price indicators on dashboard"

## Task 7: Add the separate descriptive price snapshot family

**Files:** `src/data/macroSnapshot.ts`, `src/components/MacroSnapshot.astro`, `tests/macro-snapshot.test.mjs`

- [ ] **Step 1: Write failing snapshot tests.**

Set CPI/Core CPI/PPI to positive, zero, and negative YoY levels. Assert
`family === 'price-yoy'`, percentage-point changes, descriptive level text,
and no inflation/deflation conclusion from momentum alone. Assert price changes
do not change activity phase:

    const baseline = buildMacroSnapshot(makeIndicators());
    const prices = buildMacroSnapshot(makeIndicators({
      cpi: { latest: { date: '2026-07', value: -1 }, previous: { date: '2026-06', value: 2 } },
      'core-cpi': { latest: { date: '2026-07', value: 0 }, previous: { date: '2026-06', value: 0.2 } },
      ppi: { latest: { date: '2026-07', value: 3.5 }, previous: { date: '2026-06', value: 4.1 } },
    }));
    assert.equal(prices.phase.label, baseline.phase.label);
    assert.deepEqual(prices.signals.filter((s) => s.family === 'price-yoy').map((s) => s.id), ['cpi', 'core-cpi', 'ppi']);

- [ ] **Step 2: Implement the price classifier.**

Add `'price-yoy'` to `SignalFamily`, define `priceIds`, and dispatch price
IDs before growth/monetary fallback. Reuse `makeEvidence` and the metric-aware
change unit. Classify level as `同比上涨`, `同比持平`, or `同比下降`;
describe momentum with the explicit ±0.2 percentage-point boundary. Do not add
price IDs to activity, growth, monetary, phase, or risk counts.

- [ ] **Step 3: Render the family without recomputation.**

Keep existing signal objects and concept links. Add a family label or price
subsection by filtering `snapshot.signals`; do not fetch data or recompute
interpretation in Astro. Preserve fact/interpretation and “最近数据更新”.

- [ ] **Step 4: Increment rules version, test, and commit.**

Change `macroSnapshotRulesVersion` to `2026-09-05.2`. Run:

    npm test -- --test-name-pattern='macro snapshot|price signals|activity phase'
    git add src/data/macroSnapshot.ts src/components/MacroSnapshot.astro tests/macro-snapshot.test.mjs
    git commit -m "feat: add descriptive price snapshot signals"

## Task 8: Full verification and review handoff

- [ ] **Step 1: Run all tests.**

    npm test

Expected: all ingestion, dashboard, snapshot, concept, and information
architecture tests pass.

- [ ] **Step 2: Run checking and build.**

    npm run check
    npm run build

Expected: both exit 0 and no runtime data-fetch code is introduced.

- [ ] **Step 3: Inspect final diff and provenance.**

    git diff --check origin/main...HEAD
    git diff --stat origin/main...HEAD
    git status --short

Confirm every generated source is an official `stats.gov.cn` URL, Core CPI is
not derived, no graph/navigation files changed, and the workflow tracks exactly
the three price datasets.

- [ ] **Step 4: Request review without merging.**

Report final commit, verification output, and PR readiness. Do not merge
automatically.

## Plan self-review

- Spec coverage: contracts/provenance in Tasks 1–3; atomic update/workflow in
  Tasks 4–5; dashboard in Task 6; snapshot in Task 7; verification in Task 8.
- No unresolved implementation placeholders remain: official release-page
  shapes and methodology markers are locked by parser fixtures.
- Type consistency: the price types are introduced in Task 1 and consumed in
  Tasks 2–4; `price-yoy` is introduced and consumed within Task 7.
- Atomicity: validation precedes the group writer, unchanged output is a
  no-write path, and writer failure has rollback coverage.
- Semantics: all three datasets are published monthly YoY percentages, changes
  are percentage points, and price signals never enter activity phase rules.
