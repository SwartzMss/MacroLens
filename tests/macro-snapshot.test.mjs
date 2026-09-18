import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { getDashboardIndicators } from '../src/data/dashboard.ts';
import { analyzeCreditLiquidity } from '../src/data/macroSnapshot/creditLiquidity.ts';
import { analyzeExternal } from '../src/data/macroSnapshot/external.ts';
import { analyzeGrowth } from '../src/data/macroSnapshot/growth.ts';
import { analyzeLabor } from '../src/data/macroSnapshot/labor.ts';
import { analyzePolicyFinancialConditions } from '../src/data/macroSnapshot/policyFinancialConditions.ts';
import { analyzePrices } from '../src/data/macroSnapshot/prices.ts';
import { deriveSynthesis } from '../src/data/macroSnapshot/synthesis.ts';
import {
  buildMacroSnapshot,
  getMacroSnapshotIndicators,
  macroIndicatorIds,
  makeEvidence,
} from '../src/data/macroSnapshot.ts';

const data = observations => ({ data: observations });
const snapshotComponent = fileURLToPath(new URL('../src/components/MacroSnapshot.astro', import.meta.url));
const snapshotStyles = fileURLToPath(new URL('../src/styles/snapshot.css', import.meta.url));
const snapshotPage = fileURLToPath(new URL('../src/pages/snapshot.astro', import.meta.url));
const macroNowPage = fileURLToPath(new URL('../src/pages/now.astro', import.meta.url));
const growthPage = fileURLToPath(new URL('../src/pages/now/growth.astro', import.meta.url));
const macroNowMap = fileURLToPath(new URL('../src/components/MacroNowRelationshipMap.astro', import.meta.url));
const pricesPage = fileURLToPath(new URL('../src/pages/now/prices.astro', import.meta.url));
const priceMap = fileURLToPath(new URL('../src/components/MacroNowPriceMap.astro', import.meta.url));
const creditPage = fileURLToPath(new URL('../src/pages/now/credit.astro', import.meta.url));
const creditMap = fileURLToPath(new URL('../src/components/MacroNowCreditMap.astro', import.meta.url));
const policyPage = fileURLToPath(new URL('../src/pages/now/policy.astro', import.meta.url));
const policyMap = fileURLToPath(new URL('../src/components/MacroNowPolicyMap.astro', import.meta.url));
const externalPage = fileURLToPath(new URL('../src/pages/now/external.astro', import.meta.url));
const externalMap = fileURLToPath(new URL('../src/components/MacroNowExternalMap.astro', import.meta.url));
const laborPage = fileURLToPath(new URL('../src/pages/now/labor.astro', import.meta.url));
const laborMap = fileURLToPath(new URL('../src/components/MacroNowLaborMap.astro', import.meta.url));
const makeMacroIndicators = (overrides = {}) => {
  const base = getMacroSnapshotIndicators();
  return Object.fromEntries(macroIndicatorIds.map(id => {
    const override = overrides[id] ?? {};
    return [id, {
      ...base[id],
      // Synthetic policy events must not inherit a moving live verification date.
      ...(id === 'policy-rate' && override.data
        ? { verifiedThrough: override.data.at(-1)?.date }
        : {}),
      ...override,
      ...(override.data ? { data: override.data } : {}),
      ...(override.series ? { series: override.series } : {}),
    }];
  }));
};
const domainState = (id, state) => ({
  id,
  label: id,
  state,
  explanation: '',
  evidence: [],
  risks: [],
  watchNext: [],
});

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
  assert.equal(policy[0].observationPeriod, indicators['policy-rate'].data.at(-1).date);
  assert.equal(policy[0].verifiedThrough, indicators['policy-rate'].verifiedThrough);
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

test('growth keeps PMI below, at, and above the expansion threshold distinct', () => {
  const states = [49.9, 50, 50.1].map(value => analyzeGrowth(makeMacroIndicators({
    pmi: data([{ date: '2026-08', value }, { date: '2026-09', value }]),
    gdp: data([{ date: '2026-Q2', value: 4 }, { date: '2026-Q3', value: 4 }]),
    'industrial-production': data([{ date: '2026-08', value: 5 }, { date: '2026-09', value: 5 }]),
    'retail-sales': data([{ date: '2026-08', value: 5 }, { date: '2026-09', value: 5 }]),
    'fixed-asset-investment': data([{ date: '2026-01–08', value: 0 }, { date: '2026-01–09', value: 0 }]),
  })).state);

  assert.deepEqual(states, ['mixed', 'stable', 'strengthening']);
});

test('growth treats exact momentum boundaries as neutral', () => {
  const indicatorIds = ['pmi', 'gdp', 'industrial-production', 'retail-sales', 'fixed-asset-investment'];
  const cases = [
    { name: 'exact weakening boundary', previous: 0.2, expectedState: 'stable', expectedRisk: false },
    { name: 'just below weakening boundary', previous: 0.21, expectedState: 'weakening', expectedRisk: true },
    { name: 'exact improving boundary', previous: -0.2, expectedState: 'stable', expectedRisk: false },
    { name: 'just above improving boundary', previous: -0.21, expectedState: 'strengthening', expectedRisk: false },
  ];

  for (const item of cases) {
    const indicators = makeMacroIndicators(Object.fromEntries(indicatorIds.map(id => [
      id,
      data([{ date: id === 'gdp' ? '2026-Q2' : '2026-08', value: item.previous }, {
        date: id === 'gdp' ? '2026-Q3' : '2026-09',
        value: 0,
      }]),
    ])));
    const growth = analyzeGrowth(indicators);

    assert.equal(growth.state, item.expectedState, item.name);
    assert.equal(growth.risks.some(risk => risk.id === 'growth-synchronised-weakening'), item.expectedRisk, item.name);
  }
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

test('prices keep negative, zero, and elevated positive readings separate', () => {
  const readings = [
    { value: -1, change: -0.2, expectedState: 'weakening' },
    { value: 0, change: 0, expectedState: 'stable' },
    { value: 6, change: 1, expectedState: 'strengthening' },
  ];

  for (const item of readings) {
    const prices = analyzePrices(makeMacroIndicators({
      cpi: data([{ date: '2026-08', value: item.value - item.change }, { date: '2026-09', value: item.value }]),
      'core-cpi': data([{ date: '2026-08', value: item.value - item.change }, { date: '2026-09', value: item.value }]),
      ppi: data([{ date: '2026-08', value: item.value - item.change }, { date: '2026-09', value: item.value }]),
    }));

    assert.equal(prices.state, item.expectedState, `price value ${item.value}`);
  }
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

test('credit keeps improving liquidity separate from weakening transmission', () => {
  const credit = analyzeCreditLiquidity(makeMacroIndicators({
    m0: data([{ date: '2026-07', value: 7 }, { date: '2026-08', value: 8 }]),
    m1: data([{ date: '2026-07', value: 7 }, { date: '2026-08', value: 8 }]),
    m2: data([{ date: '2026-07', value: 7 }, { date: '2026-08', value: 8 }]),
    credit: data([{ date: '2026-07', value: 8.3 }, { date: '2026-08', value: 8 }]),
    'social-financing': data([{ date: '2026-07', value: 8.3 }, { date: '2026-08', value: 8 }]),
  }));

  assert.equal(credit.state, 'mixed');
  assert.equal(credit.risks[0].id, 'credit-liquidity-divergence');
  assert.deepEqual(credit.risks[0].evidenceIds, [
    'm0', 'm1', 'm2', 'credit', 'social-financing',
  ]);
});

test('policy easing does not erase weak growth in synthesis', () => {
  const snapshot = buildMacroSnapshot(makeMacroIndicators({
    pmi: data([{ date: '2026-08', value: 49 }, { date: '2026-09', value: 49 }]),
    gdp: data([{ date: '2026-Q2', value: -1 }, { date: '2026-Q3', value: -1 }]),
    'industrial-production': data([{ date: '2026-08', value: -1 }, { date: '2026-09', value: -1 }]),
    'retail-sales': data([{ date: '2026-08', value: -1 }, { date: '2026-09', value: -1 }]),
    'fixed-asset-investment': data([{ date: '2026-01–08', value: -1 }, { date: '2026-01–09', value: -1 }]),
    'policy-rate': data([{ date: '2026-08-01', value: 1.8 }, { date: '2026-09-07', value: 1.7 }]),
    'unemployment-rate': data([{ date: '2026-08', value: 5 }, { date: '2026-09', value: 5 }]),
    lpr: {
      series: [
        { id: '1y', label: '1年期 LPR', data: [{ date: '2026-08', value: 3 }, { date: '2026-09', value: 3 }] },
        { id: '5y-plus', label: '5年期以上 LPR', data: [{ date: '2026-08', value: 3.5 }, { date: '2026-09', value: 3.5 }] },
      ],
    },
  }));

  assert.equal(snapshot.domains.find(domain => domain.id === 'growth').state, 'weakening');
  assert.equal(snapshot.domains.find(domain => domain.id === 'policy-financial-conditions').state, 'easing');
  assert.deepEqual(snapshot.synthesis.supportingDomainIds, []);
  assert.deepEqual(snapshot.synthesis.conflictingDomainIds, ['growth']);
  assert.ok(snapshot.synthesis.contextualDomainIds.includes('policy-financial-conditions'));
});

test('rising price pressure stays contextual when activity slows', () => {
  const snapshot = buildMacroSnapshot(makeMacroIndicators({
    pmi: data([{ date: '2026-08', value: 50 }, { date: '2026-09', value: 50 }]),
    gdp: data([{ date: '2026-Q2', value: 1 }, { date: '2026-Q3', value: 0 }]),
    'industrial-production': data([{ date: '2026-08', value: 1 }, { date: '2026-09', value: 0 }]),
    'retail-sales': data([{ date: '2026-08', value: 1 }, { date: '2026-09', value: 0 }]),
    'fixed-asset-investment': data([{ date: '2026-01–08', value: 1 }, { date: '2026-01–09', value: 0 }]),
    cpi: data([{ date: '2026-08', value: 4 }, { date: '2026-09', value: 5 }]),
    'core-cpi': data([{ date: '2026-08', value: 3 }, { date: '2026-09', value: 4 }]),
    ppi: data([{ date: '2026-08', value: 2 }, { date: '2026-09', value: 3 }]),
    'unemployment-rate': data([{ date: '2026-08', value: 5 }, { date: '2026-09', value: 5 }]),
  }));

  assert.equal(snapshot.domains.find(domain => domain.id === 'growth').state, 'weakening');
  assert.equal(snapshot.domains.find(domain => domain.id === 'prices').state, 'strengthening');
  assert.deepEqual(snapshot.synthesis.conflictingDomainIds, ['growth']);
  assert.ok(snapshot.synthesis.contextualDomainIds.includes('prices'));
});

test('policy domain retains policy event and each LPR series', () => {
  const policy = analyzePolicyFinancialConditions(getMacroSnapshotIndicators());

  assert.ok(policy.evidence.some(item => item.id === 'policy-rate' && item.isEvent));
  assert.deepEqual(policy.evidence.filter(item => item.seriesId).map(item => item.id), ['lpr:1y', 'lpr:5y-plus']);
  assert.ok(policy.evidence.every(item => item.observationPeriod && item.updatedAt));
});

test('policy and LPR cuts both map to easing financial conditions', () => {
  const easingIndicators = makeMacroIndicators({
    'policy-rate': data([{ date: '2026-08-01', value: 1.8 }, { date: '2026-09-01', value: 1.7 }]),
    lpr: {
      series: [
        { id: '1y', label: '1年期 LPR', data: [{ date: '2026-08', value: 3 }, { date: '2026-09', value: 2.9 }] },
        { id: '5y-plus', label: '5年期以上 LPR', data: [{ date: '2026-08', value: 3.5 }, { date: '2026-09', value: 3.4 }] },
      ],
    },
  });
  const easing = analyzePolicyFinancialConditions(easingIndicators);

  assert.equal(easing.state, 'easing');

  const stablePolicy = analyzePolicyFinancialConditions(makeMacroIndicators({
    'policy-rate': data([{ date: '2026-08-01', value: 1.8 }, { date: '2026-09-01', value: 1.8 }]),
    lpr: easingIndicators.lpr,
  }));
  assert.equal(stablePolicy.state, 'easing');
});

test('current policy-rate increases map to tightening conditions', () => {
  const tightening = analyzePolicyFinancialConditions(makeMacroIndicators({
    'policy-rate': data([{ date: '2026-08-01', value: 1.8 }, { date: '2026-09-07', value: 1.9 }]),
    lpr: {
      series: [
        { id: '1y', label: '1年期 LPR', data: [{ date: '2026-08', value: 3 }, { date: '2026-09', value: 3 }] },
        { id: '5y-plus', label: '5年期以上 LPR', data: [{ date: '2026-08', value: 3.5 }, { date: '2026-09', value: 3.5 }] },
      ],
    },
  }));

  assert.equal(tightening.state, 'tightening');
  assert.deepEqual(tightening.risks, []);
});

test('policy event direction expires into stable after verified-through', () => {
  const policy = analyzePolicyFinancialConditions(makeMacroIndicators({
    'policy-rate': {
      data: [
        { date: '2024-09-27', value: 1.5 },
        { date: '2025-05-08', value: 1.4 },
      ],
      verifiedThrough: '2026-09-07',
    },
    lpr: {
      series: [
        { id: '1y', label: '1年期 LPR', data: [{ date: '2026-08', value: 3 }, { date: '2026-09', value: 3 }] },
        { id: '5y-plus', label: '5年期以上 LPR', data: [{ date: '2026-08', value: 3.5 }, { date: '2026-09', value: 3.5 }] },
      ],
    },
  }));

  assert.equal(policy.state, 'stable');
  assert.deepEqual(policy.risks, []);
  assert.match(policy.explanation, /最后一次|核验|稳定/);
});

test('unchanged readings remain stable without spurious snapshot conclusions', () => {
  const unchanged = data([{ date: '2026-08', value: 0 }, { date: '2026-09', value: 0 }]);
  const unchangedPmi = data([{ date: '2026-08', value: 50 }, { date: '2026-09', value: 50 }]);
  const snapshot = buildMacroSnapshot(makeMacroIndicators({
    gdp: data([{ date: '2026-Q2', value: 0 }, { date: '2026-Q3', value: 0 }]),
    pmi: unchangedPmi,
    'industrial-production': unchanged,
    'retail-sales': unchanged,
    'fixed-asset-investment': data([{ date: '2026-01–08', value: 0 }, { date: '2026-01–09', value: 0 }]),
    cpi: unchanged,
    'core-cpi': unchanged,
    ppi: unchanged,
    m0: unchanged,
    m1: unchanged,
    m2: unchanged,
    credit: unchanged,
    'social-financing': unchanged,
    'policy-rate': data([{ date: '2026-08-01', value: 0 }, { date: '2026-09-01', value: 0 }]),
    lpr: {
      series: [
        { id: '1y', label: '1年期 LPR', data: [{ date: '2026-08', value: 0 }, { date: '2026-09', value: 0 }] },
        { id: '5y-plus', label: '5年期以上 LPR', data: [{ date: '2026-08', value: 0 }, { date: '2026-09', value: 0 }] },
      ],
    },
    'unemployment-rate': unchanged,
    exports: unchanged,
    imports: unchanged,
  }));

  assert.deepEqual(snapshot.domains.map(domain => domain.state), [
    'stable', 'stable', 'stable', 'stable', 'stable', 'stable',
  ]);
  assert.deepEqual(snapshot.synthesis.supportingDomainIds, []);
  assert.deepEqual(snapshot.synthesis.conflictingDomainIds, []);
  assert.deepEqual(snapshot.risks, []);
  assert.deepEqual(snapshot.watchNext, []);
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

test('synthesis preserves conflicting domain directions', () => {
  const snapshot = buildMacroSnapshot(makeMacroIndicators({
    'unemployment-rate': data([{ date: '2026-07', value: 5 }, { date: '2026-08', value: 5.3 }]),
    pmi: data([{ date: '2026-08', value: 51 }, { date: '2026-09', value: 51 }]),
    gdp: data([{ date: '2026-Q2', value: 4 }, { date: '2026-Q3', value: 4 }]),
    'industrial-production': data([{ date: '2026-08', value: 5 }, { date: '2026-09', value: 5 }]),
    'retail-sales': data([{ date: '2026-08', value: 5 }, { date: '2026-09', value: 5 }]),
    'fixed-asset-investment': data([{ date: '2026-01–08', value: 5 }, { date: '2026-01–09', value: 5 }]),
  }));

  assert.match(snapshot.synthesis.label, /混合|分化|谨慎/);
  assert.ok(snapshot.synthesis.supportingDomainIds.includes('growth'));
  assert.ok(snapshot.synthesis.conflictingDomainIds.includes('labor'));
  assert.equal(snapshot.risks.length, snapshot.domains.flatMap(item => item.risks).length);
});

test('synthesis interprets domain direction instead of globally scoring states', () => {
  const synthesis = deriveSynthesis([
    domainState('growth', 'strengthening'),
    domainState('prices', 'strengthening'),
    domainState('policy-financial-conditions', 'easing'),
  ]);

  assert.deepEqual(synthesis.supportingDomainIds, ['growth']);
  assert.deepEqual(synthesis.conflictingDomainIds, []);
  assert.deepEqual(synthesis.contextualDomainIds, ['prices', 'policy-financial-conditions']);
  assert.match(synthesis.explanation, /分别|背景|不纳入/);
});

test('snapshot rejects missing and unexpected indicator input', () => {
  const indicators = getMacroSnapshotIndicators();
  const missing = { ...indicators };
  delete missing.m2;

  assert.throws(() => buildMacroSnapshot(missing), /m2/);
  assert.throws(() => buildMacroSnapshot({ ...indicators, extra: indicators.m2 }), /unexpected|extra/i);
});

test('freshness is a range and evidence retains heterogeneous periods', () => {
  const snapshot = buildMacroSnapshot();
  const evidence = snapshot.domains.flatMap(item => item.evidence);

  assert.ok(snapshot.freshness.earliestUpdatedAt);
  assert.ok(snapshot.freshness.latestUpdatedAt);
  assert.match(snapshot.freshness.note, /各|分别|频率/);
  assert.ok(evidence.some(item => item.frequency === 'quarterly'));
  assert.ok(evidence.some(item => item.isEvent));
  assert.ok(evidence.every(item => item.updatedAt));
});

test('snapshot UI renders domain evidence without exposing implementation metadata', () => {
  const component = readFileSync(snapshotComponent, 'utf8');
  const styles = readFileSync(snapshotStyles, 'utf8');
  const page = readFileSync(snapshotPage, 'utf8');
  const now = readFileSync(macroNowPage, 'utf8');
  const growth = readFileSync(growthPage, 'utf8');

  assert.match(component, /snapshot\.synthesis/);
  assert.match(component, /snapshot\.domains/);
  assert.match(component, /domain\.evidence/);
  assert.match(component, /observationPeriod/);
  assert.match(component, /updatedAt/);
  assert.match(component, /Macro Now · 当前状态/);
  assert.match(component, /各方面的变化和依据/);
  assert.doesNotMatch(component, /<div class="eyebrow">\{domain\.id\}<\/div>/);
  assert.doesNotMatch(component, /snapshot\.phase|snapshot\.signals|rulesVersion|Macro Score|confidence score/);
  assert.match(styles, /@media\s*\(max-width:\s*760px\)/);
  assert.match(page, /MacroSnapshot/);
  assert.match(page, /buildMacroSnapshot/);
  assert.match(page, /canonicalPath="\/now\/"/);
  assert.match(now, /title="Macro Now｜当前宏观状态｜MacroLens"/);
  assert.match(now, /canonicalPath="\/now\/"/);
  assert.match(now, /MacroSnapshot/);
  assert.match(component, /href="\/now\/growth\/"/);
  assert.match(growth, /经济活动在变快还是变慢/);
  assert.match(growth, /buildMacroSnapshot/);
  assert.match(growth, /getMacroSnapshotIndicators/);
  assert.match(growth, /查看数据来源/);
  assert.match(growth, /还缺什么证据/);
  assert.match(growth, /\/concepts\/employment/);
  assert.match(component, /href="\/now\/prices\/"/);
  assert.match(readFileSync(pricesPage, 'utf8'), /价格现在是在上升、放缓，还是分化/);
  assert.match(component, /href="\/now\/credit\/"/);
  assert.match(readFileSync(creditPage, 'utf8'), /钱在变多，融资就一定更容易吗/);
  assert.match(component, /href="\/now\/policy\/"/);
  assert.match(readFileSync(policyPage, 'utf8'), /政策在放松，融资真的更容易了吗/);
  assert.match(component, /href="\/now\/external\/"/);
  assert.match(readFileSync(externalPage, 'utf8'), /出口在增长，外贸真的更强了吗/);
  assert.match(component, /href="\/now\/labor\/"/);
  assert.match(readFileSync(laborPage, 'utf8'), /失业率下降了，就业真的变好了吗/);
});

test('domain conclusions reference evidence from the same domain', () => {
  const snapshot = buildMacroSnapshot();

  for (const domain of snapshot.domains) {
    const evidenceIds = new Set(domain.evidence.map(item => item.id));
    for (const conclusion of [...domain.risks, ...domain.watchNext]) {
      assert.ok(
        conclusion.evidenceIds.every(id => evidenceIds.has(id)),
        `${domain.id}/${conclusion.id} must reference local evidence`,
      );
    }
  }
});

test('Macro Now activity page uses graph relations as a reading map', () => {
  const page = readFileSync(growthPage, 'utf8');
  const map = readFileSync(macroNowMap, 'utf8');

  assert.match(page, /MacroNowRelationshipMap/);
  assert.match(map, /getExplainableConceptRelations/);
  assert.match(map, /当前读数/);
  assert.match(map, /覆盖的部分/);
  assert.match(map, /整体观察/);
  assert.match(map, /为什么这样连/);
  assert.match(map, /不把关系当成已经证明的因果/);
  assert.match(map, /economic-activity/);
});

test('Macro Now price page keeps production and consumer price paths conditional', () => {
  const page = readFileSync(pricesPage, 'utf8');
  const map = readFileSync(priceMap, 'utf8');

  assert.match(page, /MacroNowPriceMap/);
  assert.match(page, /价格增速、价格水平和统计范围不同/);
  assert.match(page, /价格变慢，不代表东西已经变便宜/);
  assert.match(map, /ppi.*producer-price-pressure/);
  assert.match(map, /downstream-price-pressure/);
  assert.match(map, /consumer-price-pressure/);
  assert.match(map, /不能把 PPI 的变化直接当成 CPI 的结果/);
});

test('Macro Now credit page separates money layers from financing paths', () => {
  const page = readFileSync(creditPage, 'utf8');
  const map = readFileSync(creditMap, 'utf8');

  assert.match(page, /MacroNowCreditMap/);
  assert.match(page, /余额增长不等于新增需求/);
  assert.match(page, /资金有没有进入真实活动/);
  assert.match(map, /m0.*m1/);
  assert.match(map, /credit.*m2/);
  assert.match(map, /social-financing.*real-economy-financing/);
  assert.match(map, /不把货币或融资增长直接当成经济改善/);
});

test('Macro Now policy page separates policy events from financing outcomes', () => {
  const page = readFileSync(policyPage, 'utf8');
  const map = readFileSync(policyMap, 'utf8');

  assert.match(page, /MacroNowPolicyMap/);
  assert.match(page, /政策变化和借款感受之间有几道门/);
  assert.match(page, /实际贷款利率还会受到银行定价/);
  assert.match(map, /monetary-policy.*policy-rate/);
  assert.match(map, /policy-rate.*lpr/);
  assert.match(map, /financing-conditions.*credit/);
  assert.match(map, /不是立即发生的结果/);
});

test('Macro Now external page separates trade amounts from demand and activity', () => {
  const page = readFileSync(externalPage, 'utf8');
  const map = readFileSync(externalMap, 'utf8');

  assert.match(page, /MacroNowExternalMap/);
  assert.match(page, /金额不是数量/);
  assert.match(page, /海关货物贸易不是国际收支/);
  assert.match(page, /数量和价格是谁在拉动/);
  assert.match(map, /exports.*external-trade/);
  assert.match(map, /imports.*external-trade/);
  assert.match(map, /exports.*economic-activity/);
  assert.match(map, /imports.*domestic-demand-and-input-demand/);
  assert.match(map, /不把出口或进口增长直接当成需求或增长的证明/);
});

test('Macro Now labor page keeps unemployment scope separate from income outcomes', () => {
  const page = readFileSync(laborPage, 'utf8');
  const map = readFileSync(laborMap, 'utf8');

  assert.match(page, /MacroNowLaborMap/);
  assert.match(page, /它是一个比率，不是人数/);
  assert.match(page, /收入和消费还要再看/);
  assert.match(page, /是就业增加，还是有人退出/);
  assert.match(map, /unemployment-rate.*labor-market-conditions/);
  assert.match(map, /labor-market-conditions.*household-income-conditions/);
  assert.match(map, /labor-market-conditions.*economic-activity/);
  assert.match(map, /不把失业率变化当成所有人的就业结果/);
});

test('domain classifications do not depend on presentation labels', () => {
  const original = buildMacroSnapshot();
  const relabeled = Object.fromEntries(macroIndicatorIds.map(id => {
    const dataset = getMacroSnapshotIndicators()[id];
    return [id, {
      ...dataset,
      label: `renamed-${id}`,
      ...(dataset.series ? {
        series: dataset.series.map(series => ({ ...series, label: `renamed-${series.id}` })),
      } : {}),
    }];
  }));
  const renamed = buildMacroSnapshot(relabeled);

  assert.deepEqual(
    renamed.domains.map(domain => [domain.id, domain.state]),
    original.domains.map(domain => [domain.id, domain.state]),
  );
  assert.equal(renamed.synthesis.label, original.synthesis.label);
});

test('snapshot model has no score, confidence, or investment-advice output', () => {
  const output = JSON.stringify(buildMacroSnapshot());

  assert.doesNotMatch(output, /score|confidence|投资建议|投资决策/i);
});
