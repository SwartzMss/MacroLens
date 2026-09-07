# Canonical Indicator Dataset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the duplicated persisted `IndicatorDataset` interfaces with one shared structural contract and path-aware runtime validator while preserving ingestion semantics and site output.

**Architecture:** Add `src/domain/indicatorDataset.ts` as the only owner of persisted dataset types and structural validation. The ingestion validator composes that validator with its existing continuity, provenance, overlap, methodology, and source-specific rules. The runtime registry validates every imported JSON dataset before exposing it, while consumer view models remain separate.

**Tech Stack:** TypeScript, Astro strict type checking, Node test runner, `tsx`, checked-in JSON fixtures, no new runtime dependency.

---

### Task 1: Add failing contract tests for structural validation and separation

**Files:**
- Create: `tests/indicator-dataset-schema.test.mjs`
- Modify: `tests/ingestion-pmi.test.mjs:194-207` to assert the existing generic validator returns its validated dataset

- [ ] **Step 1: Write the failing tests**

Create `tests/indicator-dataset-schema.test.mjs` with a small structurally valid dataset factory and tests for the public behavior required by issue #116:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  IndicatorDatasetValidationError,
  validateIndicatorDataset,
} from '../src/domain/indicatorDataset.ts';
import { validateIndicatorDataset as validateIngestionDataset } from '../scripts/ingest/validate/dataset.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const indicatorsDir = path.join(here, '..', 'data', 'indicators');

function dataset(overrides = {}) {
  return {
    id: 'fixture',
    country: 'CN',
    frequency: 'monthly',
    unit: '%',
    metric: 'yoy',
    label: 'Fixture',
    chartTitle: 'Fixture chart',
    source: 'Fixture source',
    calculation: 'published',
    updatedAt: '2026-03-31',
    comparabilityNote: 'Fixture comparability',
    methodologyFingerprint: 'fixture|methodology',
    sources: [{
      title: 'Fixture publication',
      url: 'https://example.com/fixture',
      sourceDate: '2026-03-31',
      coverage: '2026-01 to 2026-03',
    }],
    data: [
      { date: '2026-01', value: 1 },
      { date: '2026-03', value: 2 },
    ],
    ...overrides,
  };
}

test('validates every checked-in dataset through one structural contract', () => {
  const files = fs.readdirSync(indicatorsDir).filter((file) => file.endsWith('.json')).sort();
  assert.ok(files.length > 0);
  for (const file of files) {
    const input = JSON.parse(fs.readFileSync(path.join(indicatorsDir, file), 'utf8'));
    assert.strictEqual(validateIndicatorDataset(input), input, file);
  }
});

test('accepts monthly, quarterly, event-step, and multi-series shapes without coupling them', () => {
  assert.doesNotThrow(() => validateIndicatorDataset(dataset()));
  assert.doesNotThrow(() => validateIndicatorDataset(dataset({ frequency: 'quarterly' })));
  assert.doesNotThrow(() => validateIndicatorDataset(dataset({ frequency: 'event', chartType: 'step' })));
  assert.doesNotThrow(() => validateIndicatorDataset(dataset({
    series: [{
      id: 'left',
      label: 'Left series',
      data: [{ date: '2026-01', value: 1 }],
    }],
  })));
});

test('does not apply ingestion continuity rules in the shared structural validator', () => {
  const input = dataset();
  assert.doesNotThrow(() => validateIndicatorDataset(input));
  assert.throws(() => validateIngestionDataset(input), /continuous|continuity/i);
});

test('reports nested paths and indicator context for invalid series values', () => {
  const input = dataset({
    id: 'lpr',
    series: [
      { id: '1y', label: '1Y', data: [{ date: '2026-01', value: 3 }] },
      {
        id: '5y-plus',
        label: '5Y+',
        data: [
          { date: '2026-01', value: 3.5 },
          { date: '2026-02', value: 3.5 },
          { date: '2026-03', value: Number.NaN },
        ],
      },
    ],
  });

  assert.throws(
    () => validateIndicatorDataset(input),
    (error) => error instanceof IndicatorDatasetValidationError
      && error.issues.some((issue) => issue.path.join('.') === 'series.1.data.2.value')
      && error.message.includes('indicator "lpr": series[1].data[2].value must be a finite number'),
  );
});

test('rejects invalid enum and source metadata with field paths', () => {
  assert.throws(
    () => validateIndicatorDataset(dataset({ frequency: 'weekly' })),
    /frequency must be one of monthly, quarterly, event/i,
  );
  assert.throws(
    () => validateIndicatorDataset(dataset({ comparisonType: 'previous_year' })),
    /comparisonType must be one of/i,
  );
  assert.throws(
    () => validateIndicatorDataset(dataset({ sources: [{ title: '', url: 'not-a-url', sourceDate: 1, coverage: '' }] })),
    /sources\[0\]\.(title|url|sourceDate|coverage)/i,
  );
});
```

Update the existing generic ingestion test so it proves the semantic wrapper returns the shared contract value:

```js
test('generic indicator validation accepts a monthly percentage dataset', () => {
  const validated = validateIndicatorDataset({
    ...existingDataset,
    source: 'PBOC',
    unit: '%',
    metric: 'yoy',
    calculation: 'published',
  });
  assert.strictEqual(validated, existingDataset);
});
```

- [ ] **Step 2: Run the focused tests and verify the expected red state**

Run:

```bash
node --import tsx --test tests/indicator-dataset-schema.test.mjs tests/ingestion-pmi.test.mjs
```

Expected: the new test file cannot yet import `src/domain/indicatorDataset.ts`, and the existing generic validator test fails because the current ingestion validator returns `undefined`. Record this red result before adding the initial shared-module scaffold in Task 2; after the scaffold exists, rerun until the failures are assertion failures rather than module-loading errors.

- [ ] **Step 3: Commit the failing-test change**

```bash
git add tests/indicator-dataset-schema.test.mjs tests/ingestion-pmi.test.mjs
git commit -m "test: define canonical indicator dataset contract"
```

### Task 2: Implement the shared domain types, issues, and structural validator

**Files:**
- Create: `src/domain/indicatorDataset.ts`
- Test: `tests/indicator-dataset-schema.test.mjs`

- [ ] **Step 1: Add the initial shared-module scaffold after the red test**

Create `src/domain/indicatorDataset.ts` with only the runtime names needed by the test import: `IndicatorDatasetValidationError` and a pass-through `validateIndicatorDataset(input: unknown): unknown` that returns the input. This scaffold exists only to make the test failures expectation-based; it must not be treated as the completed validator.

Rerun:

```bash
node --import tsx --test tests/indicator-dataset-schema.test.mjs tests/ingestion-pmi.test.mjs
```

Expected: valid-shape tests that only exercise the pass-through return may run, while invalid enum, invalid source, invalid nested value, and ingestion return assertions fail as normal assertions.

- [ ] **Step 2: Complete the canonical type definitions and enums**

Define the persisted contract in `src/domain/indicatorDataset.ts`:

```ts
export const INDICATOR_FREQUENCIES = ['monthly', 'quarterly', 'event'] as const;
export type IndicatorFrequency = typeof INDICATOR_FREQUENCIES[number];

export const INDICATOR_CHART_TYPES = ['step'] as const;
export type IndicatorChartType = typeof INDICATOR_CHART_TYPES[number];

export const INDICATOR_COMPARISON_TYPES = [
  'previous_event_level',
  'previous_month_same_metric',
  'previous_month_level',
  'previous_month_rate',
  'previous_quarter_same_metric',
  'previous_quarter_level',
  'previous_quarter_rate',
  'previous_cumulative_period',
] as const;
export type IndicatorComparisonType = typeof INDICATOR_COMPARISON_TYPES[number];

export type IndicatorSourceRole = 'data' | 'methodology';

export type IndicatorSource = {
  title: string;
  url: string;
  sourceDate: string;
  coverage: string;
  role?: IndicatorSourceRole;
  request?: {
    url: string;
    method: 'GET' | 'POST';
    body?: string;
  };
};

export type Observation = { date: string; value: number };

export type IndicatorSeries = {
  id: string;
  label: string;
  data: Observation[];
};

export type IndicatorDataset = {
  id: string;
  country: string;
  frequency: IndicatorFrequency;
  chartType?: IndicatorChartType;
  verifiedThrough?: string;
  unit: string;
  metric: string;
  comparisonType?: IndicatorComparisonType;
  label: string;
  chartTitle: string;
  definitionEffectiveFrom?: string;
  definitionAsOf?: string;
  source: string;
  calculation: string;
  calculationEffectiveFrom?: string;
  updatedAt: string;
  comparabilityNote: string;
  methodologyFingerprint: string;
  methodologyEffectiveFrom?: string;
  sources: IndicatorSource[];
  referenceValue?: number;
  referenceLabel?: string;
  data: Observation[];
  series?: IndicatorSeries[];
};
```

- [ ] **Step 3: Add the path-aware validation error and structural checks**

Implement `IndicatorDatasetValidationIssue`, `IndicatorDatasetValidationError`, and `validateIndicatorDataset(input: unknown): IndicatorDataset` in the same module. The implementation must:

- reject non-record input;
- check all required top-level fields for non-empty strings;
- check `frequency`, `chartType`, and `comparisonType` against their exported literal arrays;
- check optional scalar fields only when present;
- require `sources` and `data` to be arrays;
- validate each observation's `date` as a non-empty string and `value` as finite;
- validate each series' `id`, `label`, and nested observations;
- validate source title, `https://` URL, source date, coverage, role, and optional request shape;
- validate methodology fingerprint as a non-empty string;
- collect issues with paths such as `['series', 1, 'data', 2, 'value']`;
- return the original input object after validation without sorting, filling, pruning, or changing it.

Use these error primitives so the message is deterministic:

```ts
export class IndicatorDatasetValidationError extends Error {
  readonly issues: IndicatorDatasetValidationIssue[];

  constructor(indicatorId: string | undefined, issues: IndicatorDatasetValidationIssue[]) {
    const prefix = indicatorId ? `indicator "${indicatorId}": ` : 'indicator: ';
    super(issues.map(({ path, message }) => `${prefix}${formatPath(path)} ${message}`).join('\n'));
    this.name = 'IndicatorDatasetValidationError';
    this.issues = issues;
  }
}

function formatPath(path: Array<string | number>): string {
  return path.reduce((result, segment) => (
    typeof segment === 'number' ? `${result}[${segment}]` : result ? `${result}.${segment}` : segment
  ), '');
}
```

Do not add chronological, continuity, coverage, overlap, or methodology-fingerprint comparison rules to this module.

- [ ] **Step 4: Run the focused tests and verify green**

Run:

```bash
node --import tsx --test tests/indicator-dataset-schema.test.mjs tests/ingestion-pmi.test.mjs
```

Expected: the direct shared shape and error tests pass; the existing ingestion-return assertion remains red until Task 3 composes the shared validator in the ingestion layer.

- [ ] **Step 5: Commit the shared domain implementation**

```bash
git add src/domain/indicatorDataset.ts
git commit -m "feat: add canonical indicator dataset validator"
```

### Task 3: Rewire ingestion types and preserve the semantic validation boundary

**Files:**
- Modify: `scripts/ingest/types.ts:1-47`
- Modify: `scripts/ingest/validate/dataset.ts:1-75`
- Modify: `scripts/ingest/write/indicator.ts:1-7`
- Test: `tests/indicator-dataset-schema.test.mjs`
- Test: existing ingestion validator suites under `tests/ingestion-*.test.mjs`

- [ ] **Step 1: Replace the duplicated ingestion-domain declarations with re-exports**

At the top of `scripts/ingest/types.ts`, re-export the shared types:

```ts
export type {
  IndicatorChartType,
  IndicatorComparisonType,
  IndicatorDataset,
  IndicatorFrequency,
  IndicatorSeries,
  IndicatorSource,
  IndicatorSourceRole,
  Observation,
} from '../../src/domain/indicatorDataset.ts';
```

Delete the local `IndicatorSource`, `Observation`, `IndicatorSeries`, and `IndicatorDataset` declarations. Leave all ingestion-only types and constants in this file unchanged.

- [ ] **Step 2: Compose structural and semantic validation**

In `scripts/ingest/validate/dataset.ts`, import the shared validator under an alias. Keep the existing `nextMonth`, `validateMonthlyObservations`, `monthsBetween`, `coverageCoversDates`, and `pruneSources` implementations unchanged. Replace only the current top-level field/source checks and the function signature with this composition:

```ts
import { validateIndicatorDataset as validateStructuralIndicatorDataset } from '../../../src/domain/indicatorDataset.ts';
import type { IndicatorDataset, IndicatorSource, Observation } from '../types.ts';

export function validateIndicatorDataset(
  input: unknown,
  options: DatasetValidationOptions = {},
): IndicatorDataset {
  const dataset = validateStructuralIndicatorDataset(input);
  const coveragePattern = options.coveragePattern ?? COVERAGE_PATTERN;
  const validateObservations = options.validateObservations ?? ((observations: Observation[]) => (
    validateMonthlyObservations(observations, 'Indicator')
  ));
  const coverageCovers = options.coverageCoversDates ?? coverageCoversDates;
  for (const source of dataset.sources) {
    const coverage = source.coverage.match(coveragePattern);
    if (!coverage || (coverage[2] !== undefined && coverage[1] > coverage[2])) {
      fail(`Invalid indicator source: ${source.url}`);
    }
    if (!ISO_DATE_PATTERN.test(source.sourceDate)) {
      fail(`Invalid indicator source date: ${source.sourceDate}`);
    }
  }
  validateObservations(dataset.data);
  if (!coverageCovers(dataset.sources, dataset.data.map(({ date }) => date))) {
    throw new IngestionContractError('Indicator source coverage union does not fully cover the dataset');
  }
  if (!ISO_DATE_PATTERN.test(dataset.updatedAt)) {
    throw new IngestionContractError(`Invalid indicator updatedAt: ${dataset.updatedAt}`);
  }
  const latestSource = dataset.sources.at(-1);
  if (latestSource?.sourceDate !== dataset.updatedAt) {
    throw new IngestionContractError(
      `Indicator updatedAt must match the latest source date: ${dataset.updatedAt} != ${latestSource?.sourceDate}`,
    );
  }
  return dataset;
}
```

Before replacing the function, retain the existing source validation behavior by moving its coverage-pattern loop into the shown composition and preserving the existing `ISO_DATE_PATTERN` and `IngestionContractError` declarations. The existing `coveragePattern`, `validateObservations`, and `coverageCoversDates` options must continue to control source-specific behavior. The default observation validator remains `validateMonthlyObservations`; the policy-rate and price validators continue to provide their own date/coverage rules.

- [ ] **Step 3: Validate at the single-file writer boundary**

Update `scripts/ingest/write/indicator.ts` to import `IndicatorDataset` and `validateIndicatorDataset` from the shared domain module and validate before serializing:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { validateIndicatorDataset } from '../../../src/domain/indicatorDataset.ts';
import type { IndicatorDataset } from '../../../src/domain/indicatorDataset.ts';

export function writeIndicatorDataset(filePath: string, dataset: IndicatorDataset): { changed: boolean; output: string } {
  validateIndicatorDataset(dataset);
  const output = `${JSON.stringify(dataset, null, 2)}\n`;
  let current = '';
  try {
    current = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (current === output) return { changed: false, output };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, output, 'utf8');
  return { changed: true, output };
}
```

Do not add ingestion semantic checks to the writer; callers remain responsible for source-specific validation before writing.

- [ ] **Step 4: Run focused and existing ingestion tests**

Run:

```bash
node --import tsx --test tests/indicator-dataset-schema.test.mjs tests/ingestion-pmi.test.mjs tests/ingestion-lpr.test.mjs tests/ingestion-policy-rate.test.mjs tests/ingestion-nbs-prices.test.mjs tests/ingestion-nbs-real-economy.test.mjs
```

Expected: all selected tests pass, including the return-value assertion and the existing continuity, provenance, overlap, and methodology failures.

- [ ] **Step 5: Commit the ingestion integration**

```bash
git add scripts/ingest/types.ts scripts/ingest/validate/dataset.ts scripts/ingest/write/indicator.ts tests/indicator-dataset-schema.test.mjs
git commit -m "refactor: share indicator contract with ingestion"
```

### Task 4: Make runtime registry and site consumers use the canonical contract

**Files:**
- Modify: `src/data/indicatorRegistry.ts:1-70`
- Modify: `src/data/indicatorPresentationAdapter.ts:1`
- Modify: `src/data/indicatorChartOption.ts:1-3`
- Modify: `src/data/dashboard.ts:1`
- Test: `tests/indicator-dataset-schema.test.mjs`
- Test: `tests/indicator-data-integrity.test.mjs`

- [ ] **Step 1: Remove registry-local interfaces and validate imports at module initialization**

In `src/data/indicatorRegistry.ts`, preserve the existing 18 JSON imports, delete the local `IndicatorSeries`, `IndicatorDataset`, and `IndicatorComparisonType` declarations, and replace the `satisfies`-only check with runtime validation:

```ts
import { validateIndicatorDataset } from '../domain/indicatorDataset';
import type { IndicatorDataset } from '../domain/indicatorDataset';

const rawIndicatorData = {
  m0, m1, m2, pmi, gdp,
  'industrial-production': industrialProduction,
  'retail-sales': retailSales,
  'fixed-asset-investment': fixedAssetInvestment,
  cpi,
  'core-cpi': coreCpi,
  ppi,
  credit,
  'social-financing': socialFinancing,
  lpr,
  'unemployment-rate': unemploymentRate,
  exports,
  imports,
  'policy-rate': policyRate,
} as const;

const indicatorData: Record<string, IndicatorDataset> = Object.fromEntries(
  Object.entries(rawIndicatorData).map(([id, input]) => {
    const dataset = validateIndicatorDataset(input);
    if (dataset.id !== id) throw new Error(`Registered indicator id mismatch: ${id} != ${dataset.id}`);
    return [id, dataset];
  }),
);
```

Keep `getIndicatorData`'s unknown-id error and lookup semantics unchanged.

- [ ] **Step 2: Update consumer type imports**

Use the canonical domain module directly:

```ts
// src/data/indicatorPresentationAdapter.ts
import type { IndicatorComparisonType, IndicatorDataset } from '../domain/indicatorDataset';

// src/data/indicatorChartOption.ts
import type { IndicatorSeries } from '../domain/indicatorDataset';

// src/data/dashboard.ts
import { getIndicatorData } from './indicatorRegistry';
import type { IndicatorDataset } from '../domain/indicatorDataset';
```

Leave all presentation, chart, dashboard, and snapshot behavior unchanged.

- [ ] **Step 3: Add registry-level assertions to the contract test**

Extend `tests/indicator-dataset-schema.test.mjs` with:

```js
import { getIndicatorData } from '../src/data/indicatorRegistry.ts';

test('registry exposes structurally validated datasets without changing ids', () => {
  const files = fs.readdirSync(indicatorsDir).filter((file) => file.endsWith('.json'));
  for (const file of files) {
    const id = file.slice(0, -5);
    assert.equal(getIndicatorData(id).id, id);
  }
});
```

- [ ] **Step 4: Run registry and consumer tests**

Run:

```bash
node --import tsx --test tests/indicator-dataset-schema.test.mjs tests/indicator-data-integrity.test.mjs tests/indicator-presentation-adapter.test.mjs tests/indicator-step-series.test.mjs tests/dashboard.test.mjs tests/macro-snapshot.test.mjs
```

Expected: all selected tests pass and no output or semantic assertions change.

- [ ] **Step 5: Commit the runtime integration**

```bash
git add src/data/indicatorRegistry.ts src/data/indicatorPresentationAdapter.ts src/data/indicatorChartOption.ts src/data/dashboard.ts tests/indicator-dataset-schema.test.mjs tests/indicator-data-integrity.test.mjs
git commit -m "refactor: validate registered indicator datasets"
```

### Task 5: Review the diff and run the complete acceptance suite

**Files:**
- Modify only files already listed in Tasks 1-4 if verification exposes a concrete issue.

- [ ] **Step 1: Confirm the duplicated contract is gone**

Run:

```bash
rg -n "interface IndicatorDataset|type IndicatorDataset|interface IndicatorSeries|type IndicatorSeries|type IndicatorComparisonType" scripts/ingest/types.ts src/data/indicatorRegistry.ts
git diff --check
git status --short
```

Expected: no competing `IndicatorDataset`, `IndicatorSeries`, or `IndicatorComparisonType` declarations remain in the two old locations; only intentional re-exports or imports remain, and `git diff --check` is clean.

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm test
```

Expected: 0 failures and no cancelled or skipped tests.

- [ ] **Step 3: Run type checking, build, and output verification**

Run each command from the worktree:

```bash
npm run check
npm run build
npm run test:output
```

Expected: each command exits with status 0. The build must complete without changing the checked-in data or generated source files.

- [ ] **Step 4: Inspect the final diff for scope and output stability**

Run:

```bash
git diff --stat main...HEAD
git diff --name-only main...HEAD
git status --short
```

Confirm the final change is limited to the shared domain contract, validator tests, ingestion/runtime wiring, and the committed design/plan documents; no indicator JSON or unrelated product behavior changed.

- [ ] **Step 5: Commit any final test-only correction and capture the final SHA**

If the previous steps require a correction, run the relevant focused test, then commit it with a scoped message. Finally run:

```bash
git log --oneline --decorate -6
git rev-parse HEAD
```

Use the resulting base and head SHAs for the code review checkpoint and PR body.
