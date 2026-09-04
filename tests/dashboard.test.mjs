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
  const expectedLatest = m1.dataset.data.at(-1);
  const expectedPrevious = m1.dataset.data.at(-2);
  assert.deepEqual(m1.latest, expectedLatest);
  assert.deepEqual(m1.previous, expectedPrevious);
  assert.equal(m1.change, expectedLatest.value - expectedPrevious.value);
  assert.equal(m1.dataset.source, 'PBOC');
  assert.match(m1.dataset.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
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
