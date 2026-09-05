import assert from 'node:assert/strict';
import test from 'node:test';
import { coversPeriod, isDataSource, parseCoverage } from './helpers/coverage.mjs';

test('parses exact, ranged, quarterly, cumulative, and annual coverage', () => {
  assert.deepEqual(parseCoverage('2026-01 to 2026-07'), [
    { start: '2026-01', end: '2026-07', annual: false },
  ]);
  assert.equal(coversPeriod('2026-01 to 2026-07', '2026-04'), true);
  assert.equal(coversPeriod('2026-01 to 2026-07', '2025-12'), false);
  assert.equal(coversPeriod('2021-Q1 to 2026-Q2', '2026-Q1'), true);
  assert.equal(coversPeriod('2021-Q1 to 2026-Q2', '2026-Q3'), false);
  assert.equal(coversPeriod('2011-01–02 to 2026-01–07', '2026-01–03'), true);
  assert.equal(coversPeriod('2011-01–02 to 2026-01–07', '2026-01–08'), false);
  assert.equal(coversPeriod('2011-01–02 to 2026-01–02 (annual)', '2025-01–02'), true);
  assert.equal(coversPeriod('2011-01–02 to 2026-01–02 (annual)', '2025-03'), false);
  assert.equal(coversPeriod('2024-01 to 2024-12; 2025-01 to 2025-07', '2025-05'), true);
  assert.equal(coversPeriod('not a coverage', '2026-01'), false);
});

test('treats omitted source roles as data but never methodology', () => {
  assert.equal(isDataSource({ coverage: '2026-01 to 2026-01' }), true);
  assert.equal(isDataSource({ role: 'data', coverage: '2026-01 to 2026-01' }), true);
  assert.equal(isDataSource({ role: 'methodology', coverage: '2026-01 to 2026-01' }), false);
});
