import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  IndicatorDatasetValidationError,
  validateIndicatorDataset,
} from '../src/domain/indicatorDataset.ts';
import {
  getIndicatorData,
  validateRegisteredIndicatorDataset,
} from '../src/data/indicatorRegistry.ts';
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

test('rejects sparse source and series arrays instead of skipping holes', () => {
  assert.throws(
    () => validateIndicatorDataset(dataset({ sources: new Array(1) })),
    /sources\[0\] must be an object/i,
  );
  assert.throws(
    () => validateIndicatorDataset(dataset({ series: new Array(1) })),
    /series\[0\] must be an object/i,
  );
});

test('registry validation includes the registered key in structural errors', () => {
  assert.throws(
    () => validateRegisteredIndicatorDataset('broken-indicator', { data: [], sources: [] }),
    (error) => error instanceof IndicatorDatasetValidationError
      && error.message.startsWith('indicator "broken-indicator":'),
  );
});

test('registry exposes structurally validated datasets without changing ids', () => {
  const files = fs.readdirSync(indicatorsDir).filter((file) => file.endsWith('.json'));
  for (const file of files) {
    const id = file.slice(0, -5);
    assert.equal(getIndicatorData(id).id, id);
  }
});
