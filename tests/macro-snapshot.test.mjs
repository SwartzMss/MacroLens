import assert from 'node:assert/strict';
import test from 'node:test';
import { getDashboardIndicators } from '../src/data/dashboard.ts';
import { analyzeCreditLiquidity } from '../src/data/macroSnapshot/creditLiquidity.ts';
import { analyzeExternal } from '../src/data/macroSnapshot/external.ts';
import { analyzeGrowth } from '../src/data/macroSnapshot/growth.ts';
import { analyzeLabor } from '../src/data/macroSnapshot/labor.ts';
import { analyzePolicyFinancialConditions } from '../src/data/macroSnapshot/policyFinancialConditions.ts';
import { analyzePrices } from '../src/data/macroSnapshot/prices.ts';
import {
  getMacroSnapshotIndicators,
  macroIndicatorIds,
  makeEvidence,
} from '../src/data/macroSnapshot.ts';

const data = observations => ({ data: observations });
const makeMacroIndicators = (overrides = {}) => {
  const base = getMacroSnapshotIndicators();
  return Object.fromEntries(macroIndicatorIds.map(id => {
    const override = overrides[id] ?? {};
    return [id, {
      ...base[id],
      ...override,
      ...(override.data ? { data: override.data } : {}),
      ...(override.series ? { series: override.series } : {}),
    }];
  }));
};

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

test('growth keeps positive levels and weakening momentum separate', () => {
  const growth = analyzeGrowth(makeMacroIndicators({
    gdp: data([{ date: '2026-Q2', value: 4.3 }, { date: '2026-Q3', value: 3.8 }]),
    'industrial-production': data([{ date: '2026-08', value: 5 }, { date: '2026-09', value: 4 }]),
  }));

  assert.equal(growth.state, 'mixed');
  assert.match(growth.explanation, /正增长|走弱|放缓/);
  assert.ok(growth.evidence.some(item => item.id === 'gdp' && item.observationPeriod === '2026-Q3'));
});

test('growth reports PMI below 50 while other activity remains positive', () => {
  const growth = analyzeGrowth(makeMacroIndicators({
    pmi: data([{ date: '2026-08', value: 49.8 }, { date: '2026-09', value: 49.6 }]),
    gdp: data([{ date: '2026-Q2', value: 4 }, { date: '2026-Q3', value: 4 }]),
    'industrial-production': data([{ date: '2026-08', value: 5 }, { date: '2026-09', value: 5 }]),
    'retail-sales': data([{ date: '2026-08', value: 4 }, { date: '2026-09', value: 4 }]),
  }));

  assert.equal(growth.state, 'mixed');
  assert.ok(growth.risks.some(item => item.evidenceIds.includes('pmi')));
  assert.ok(growth.evidence.some(item => item.id === 'pmi'));
});

test('prices retain divergent CPI, core CPI, and PPI evidence', () => {
  const prices = analyzePrices(makeMacroIndicators({
    cpi: data([{ date: '2026-08', value: 0.8 }, { date: '2026-09', value: 1 }]),
    'core-cpi': data([{ date: '2026-08', value: 0.4 }, { date: '2026-09', value: 0.5 }]),
    ppi: data([{ date: '2026-08', value: -2 }, { date: '2026-09', value: -1.5 }]),
  }));

  assert.equal(prices.state, 'divergent');
  assert.match(prices.explanation, /CPI|核心|PPI/);
  assert.doesNotMatch(prices.explanation, /意味着|导致|必然/);
});

test('credit separates money growth from credit and social-financing growth', () => {
  const credit = analyzeCreditLiquidity(makeMacroIndicators({
    m2: data([{ date: '2026-07', value: 7 }, { date: '2026-08', value: 8 }]),
    credit: data([{ date: '2026-07', value: 9 }, { date: '2026-08', value: 8 }]),
    'social-financing': data([{ date: '2026-07', value: 9 }, { date: '2026-08', value: 8 }]),
  }));

  assert.equal(credit.state, 'mixed');
  assert.match(credit.explanation, /货币|信贷|社会融资/);
  assert.doesNotMatch(credit.explanation, /意味着|导致|必然/);
});

test('policy domain retains policy event and each LPR series', () => {
  const policy = analyzePolicyFinancialConditions(getMacroSnapshotIndicators());

  assert.ok(policy.evidence.some(item => item.id === 'policy-rate' && item.isEvent));
  assert.deepEqual(policy.evidence.filter(item => item.seriesId).map(item => item.id), ['lpr:1y', 'lpr:5y-plus']);
  assert.ok(policy.evidence.every(item => item.observationPeriod && item.updatedAt));
});

test('labor weakens independently from a positive growth domain', () => {
  const indicators = makeMacroIndicators({
    'unemployment-rate': data([{ date: '2026-07', value: 5 }, { date: '2026-08', value: 5.3 }]),
    gdp: data([{ date: '2026-Q2', value: 4 }, { date: '2026-Q3', value: 4 }]),
  });
  const labor = analyzeLabor(indicators);
  const growth = analyzeGrowth(indicators);

  assert.equal(labor.state, 'weakening');
  assert.notEqual(growth.state, 'weakening');
});

test('external reports exports and imports divergence', () => {
  const external = analyzeExternal(makeMacroIndicators({
    exports: data([{ date: '2026-07', value: 5 }, { date: '2026-08', value: 6 }]),
    imports: data([{ date: '2026-07', value: 4 }, { date: '2026-08', value: 2 }]),
  }));

  assert.equal(external.state, 'divergent');
  assert.match(external.explanation, /出口|进口/);
});
