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
import {
  buildMacroSnapshot,
  getMacroSnapshotIndicators,
  macroIndicatorIds,
  makeEvidence,
} from '../src/data/macroSnapshot.ts';

const data = observations => ({ data: observations });
const snapshotComponent = fileURLToPath(new URL('../src/components/MacroSnapshot.astro', import.meta.url));
const snapshotStyles = fileURLToPath(new URL('../src/styles/snapshot.css', import.meta.url));
const homepage = fileURLToPath(new URL('../src/pages/index.astro', import.meta.url));
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
  const page = readFileSync(homepage, 'utf8');

  assert.match(component, /snapshot\.synthesis/);
  assert.match(component, /snapshot\.domains/);
  assert.match(component, /domain\.evidence/);
  assert.match(component, /observationPeriod/);
  assert.match(component, /updatedAt/);
  assert.doesNotMatch(component, /snapshot\.phase|snapshot\.signals|rulesVersion|Macro Score|confidence score/);
  assert.match(styles, /@media\s*\(max-width:\s*760px\)/);
  assert.match(page, /MacroDashboard/);
  assert.match(page, /MacroSnapshot/);
  assert.match(page, /buildMacroSnapshot/);
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
