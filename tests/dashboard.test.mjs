import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dashboardIndicatorIds, deriveObservationSummary, getDashboardIndicators } from '../src/data/dashboard.ts';

const dashboardComponent = fileURLToPath(new URL('../src/components/MacroDashboard.astro', import.meta.url));
const dashboardStyles = fileURLToPath(new URL('../src/styles/dashboard.css', import.meta.url));
const homepage = fileURLToPath(new URL('../src/pages/index.astro', import.meta.url));

test('includes the three official price datasets on the dashboard', () => {
  assert.deepEqual(dashboardIndicatorIds, [
    'gdp', 'pmi', 'm0', 'm1', 'm2',
    'industrial-production', 'retail-sales', 'fixed-asset-investment',
    'cpi', 'core-cpi', 'ppi',
  ]);
  assert.deepEqual(getDashboardIndicators().map((item) => item.id), dashboardIndicatorIds);
  for (const id of ['cpi', 'core-cpi', 'ppi']) {
    const indicator = getDashboardIndicators().find((item) => item.id === id);
    assert.equal(indicator.dataset.metric, 'yoy');
    assert.equal(indicator.conceptHref, `/concepts/${id}`);
  }
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

test('dashboard markup includes changes, update timestamps, sources, and concept links', () => {
  const source = readFileSync(dashboardComponent, 'utf8');
  assert.match(source, /更新：/);
  assert.match(source, /核验来源/);
  assert.match(source, /conceptHref/);
  assert.match(source, /最近一期变化/);
  assert.match(source, /个百分点/);
  assert.match(source, /dataset\.metric/);
});

test('dashboard styles are responsive and homepage preserves current sections', () => {
  const styles = readFileSync(dashboardStyles, 'utf8');
  const page = readFileSync(homepage, 'utf8');
  assert.match(styles, /@media\s*\(max-width:\s*760px\)/);
  assert.match(styles, /dashboard-grid/);
  assert.match(styles, /\.indicator-change\.is-negative/);
  assert.match(page, /MacroDashboard/);
  assert.match(page, /TransmissionPaths/);
  assert.match(page, /先认识两种“钱”/);
});
