import assert from 'node:assert/strict';
import test from 'node:test';
import { getDashboardIndicators } from '../src/data/dashboard.ts';
import {
  getMacroSnapshotIndicators,
  macroIndicatorIds,
  makeEvidence,
} from '../src/data/macroSnapshot.ts';

test('exposes all registered macro datasets without changing the Dashboard set', () => {
  const macro = getMacroSnapshotIndicators();

  assert.deepEqual(Object.keys(macro), macroIndicatorIds);
  assert.equal(getDashboardIndicators().length, 11);
  assert.equal(macro.lpr.series.length, 2);
  assert.equal(macro['policy-rate'].frequency, 'event');
});

test('normalizes single-series, LPR, and policy-rate evidence with timing context', () => {
  const indicators = getMacroSnapshotIndicators();
  const gdp = makeEvidence(indicators.gdp, 'gdp');
  const lpr = makeEvidence(indicators.lpr, 'lpr');
  const policy = makeEvidence(indicators['policy-rate'], 'policy-rate');

  assert.equal(gdp[0].frequency, 'quarterly');
  assert.equal(gdp[0].observationPeriod, indicators.gdp.data.at(-1).date);
  assert.equal(gdp[0].updatedAt, indicators.gdp.updatedAt);
  assert.equal(gdp[0].verifiedThrough, null);
  assert.deepEqual(lpr.map(item => item.id), ['lpr:1y', 'lpr:5y-plus']);
  assert.ok(lpr.every(item => item.seriesId));
  assert.equal(policy[0].isEvent, true);
  assert.equal(policy[0].observationPeriod, '2025-05-08');
  assert.equal(policy[0].verifiedThrough, '2026-09-07');
});
