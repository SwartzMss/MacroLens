import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dashboardIndicatorIds, getDashboardIndicators } from '../src/data/dashboard.ts';
import { buildMacroSnapshot, macroSnapshotRulesVersion } from '../src/data/macroSnapshot.ts';

const snapshotComponent = fileURLToPath(new URL('../src/components/MacroSnapshot.astro', import.meta.url));
const snapshotStyles = fileURLToPath(new URL('../src/styles/snapshot.css', import.meta.url));
const homepage = fileURLToPath(new URL('../src/pages/index.astro', import.meta.url));

function makeIndicators(overrides = {}) {
  return getDashboardIndicators().map((indicator) => {
    const override = overrides[indicator.id] ?? {};
    const latest = override.latest ?? indicator.latest;
    const previous = override.previous === undefined ? indicator.previous : override.previous;
    const change = previous ? latest.value - previous.value : null;
    const data = [...indicator.dataset.data.slice(0, -2), ...(previous ? [previous] : []), latest];
    return {
      ...indicator,
      ...override,
      latest,
      previous,
      change,
      dataset: {
        ...indicator.dataset,
        ...override.dataset,
        data,
        updatedAt: override.updatedAt ?? indicator.dataset.updatedAt,
      },
    };
  });
}

function signal(snapshot, id) {
  return snapshot.signals.find((item) => item.id === id);
}

test('builds one signal for each existing dashboard indicator', () => {
  const snapshot = buildMacroSnapshot();

  assert.deepEqual(snapshot.signals.map((item) => item.id), dashboardIndicatorIds);
  assert.equal(snapshot.signals.length, dashboardIndicatorIds.length);
  assert.ok(snapshot.signals.every((item) => item.fact && item.interpretation));
  assert.equal(signal(snapshot, 'pmi').metric, 'index');
  assert.equal(signal(snapshot, 'pmi').changeUnit, 'points');
  assert.equal(signal(snapshot, 'm2').metric, 'yoy');
  assert.equal(signal(snapshot, 'm2').changeUnit, 'percentage-points');
});

test('classifies PMI using the 50 threshold and momentum boundary', () => {
  const snapshot = buildMacroSnapshot(makeIndicators({
    pmi: { latest: { date: '2026-08', value: 49.8 }, previous: { date: '2026-07', value: 49.2 } },
  }));
  const pmi = signal(snapshot, 'pmi');

  assert.match(pmi.fact, /49\.8/);
  assert.match(pmi.fact, /较上月变化\+0\.6 点/);
  assert.match(pmi.interpretation, /低于|景气/);
  assert.match(pmi.interpretation, /改善|回升|动能/);
});

test('classifies growth indicators by level and change without flattening semantics', () => {
  const snapshot = buildMacroSnapshot(makeIndicators({
    gdp: { latest: { date: '2026-Q2', value: 4.3 }, previous: { date: '2026-Q1', value: 5 } },
    'fixed-asset-investment': { latest: { date: '2026-01–07', value: -6.7 }, previous: { date: '2026-01–06', value: -5.7 } },
  }));

  assert.match(signal(snapshot, 'gdp').interpretation, /正增长/);
  assert.match(signal(snapshot, 'gdp').interpretation, /走弱|放缓/);
  assert.match(signal(snapshot, 'fixed-asset-investment').interpretation, /负|非正/);
  assert.match(signal(snapshot, 'fixed-asset-investment').interpretation, /走弱|放缓/);
  assert.match(signal(snapshot, 'gdp').fact, /较上一季度-0\.7 个百分点/);
});

test('reports monetary growth momentum cautiously without causal claims', () => {
  const snapshot = buildMacroSnapshot(makeIndicators({
    m2: { latest: { date: '2026-07', value: 7.7 }, previous: { date: '2026-06', value: 8 } },
  }));
  const m2 = signal(snapshot, 'm2');

  assert.match(m2.fact, /7\.7/);
  assert.match(m2.interpretation, /货币增速|动能/);
  assert.doesNotMatch(m2.interpretation, /意味着|导致|必然上涨/);
});

test('keeps exact momentum boundaries stable despite floating-point subtraction', () => {
  const pmiUp = buildMacroSnapshot(makeIndicators({
    pmi: { latest: { date: '2026-08', value: 50.2 }, previous: { date: '2026-07', value: 50 } },
  }));
  const pmiDown = buildMacroSnapshot(makeIndicators({
    pmi: { latest: { date: '2026-08', value: 50 }, previous: { date: '2026-07', value: 50.2 } },
  }));
  const monetaryStable = buildMacroSnapshot(makeIndicators({
    m2: { latest: { date: '2026-07', value: 7.8 }, previous: { date: '2026-06', value: 8 } },
  }));
  const monetaryWeakening = buildMacroSnapshot(makeIndicators({
    m2: { latest: { date: '2026-07', value: 7.7 }, previous: { date: '2026-06', value: 8 } },
  }));

  assert.match(signal(pmiUp, 'pmi').interpretation, /基本稳定/);
  assert.match(signal(pmiDown, 'pmi').interpretation, /基本稳定/);
  assert.doesNotMatch(signal(monetaryStable, 'm2').interpretation, /走弱/);
  assert.match(signal(monetaryWeakening, 'm2').interpretation, /走弱/);
});

test('keeps PMI at 50 neutral and zero growth distinct from negative growth', () => {
  const snapshot = buildMacroSnapshot(makeIndicators({
    pmi: { latest: { date: '2026-08', value: 50 }, previous: { date: '2026-07', value: 50 } },
    gdp: { latest: { date: '2026-Q2', value: 0 }, previous: { date: '2026-Q1', value: 0 } },
    'industrial-production': { latest: { date: '2026-07', value: 4 }, previous: { date: '2026-06', value: 4 } },
    'retail-sales': { latest: { date: '2026-07', value: 4 }, previous: { date: '2026-06', value: 4 } },
    'fixed-asset-investment': { latest: { date: '2026-01–07', value: 4 }, previous: { date: '2026-01–06', value: 4 } },
    m0: { latest: { date: '2026-07', value: 11 }, previous: { date: '2026-06', value: 11 } },
    m1: { latest: { date: '2026-07', value: 4 }, previous: { date: '2026-06', value: 4 } },
    m2: { latest: { date: '2026-07', value: 8 }, previous: { date: '2026-06', value: 8 } },
  }));

  assert.match(signal(snapshot, 'pmi').interpretation, /中性|持平/);
  assert.match(signal(snapshot, 'gdp').interpretation, /零增长/);
  assert.equal(snapshot.risks.length, 0);
});

test('applies phase precedence for expansion, contraction, slowing, and mixed signals', () => {
  const expansion = buildMacroSnapshot(makeIndicators({
    pmi: { latest: { date: '2026-08', value: 50.2 }, previous: { date: '2026-07', value: 50 } },
    gdp: { latest: { date: '2026-Q2', value: 4 }, previous: { date: '2026-Q1', value: 4 } },
    'industrial-production': { latest: { date: '2026-07', value: 4 }, previous: { date: '2026-06', value: 4 } },
    'retail-sales': { latest: { date: '2026-07', value: 4 }, previous: { date: '2026-06', value: 4 } },
    'fixed-asset-investment': { latest: { date: '2026-01–07', value: 4 }, previous: { date: '2026-01–06', value: 4 } },
  }));
  assert.equal(expansion.phase.label, '扩张信号');

  const contraction = buildMacroSnapshot(makeIndicators({
    gdp: { latest: { date: '2026-Q2', value: -1 }, previous: { date: '2026-Q1', value: -1 } },
    'industrial-production': { latest: { date: '2026-07', value: -1 }, previous: { date: '2026-06', value: -1 } },
    'retail-sales': { latest: { date: '2026-07', value: -1 }, previous: { date: '2026-06', value: -1 } },
  }));
  assert.equal(contraction.phase.label, '收缩压力');

  const slowing = buildMacroSnapshot(makeIndicators({
    pmi: { latest: { date: '2026-08', value: 50.2 }, previous: { date: '2026-07', value: 50.6 } },
    gdp: { latest: { date: '2026-Q2', value: 4 }, previous: { date: '2026-Q1', value: 5 } },
    'industrial-production': { latest: { date: '2026-07', value: 4 }, previous: { date: '2026-06', value: 5 } },
    'retail-sales': { latest: { date: '2026-07', value: 4 }, previous: { date: '2026-06', value: 5 } },
  }));
  assert.equal(slowing.phase.label, '增长放缓');

  const mixed = buildMacroSnapshot(makeIndicators({
    pmi: { latest: { date: '2026-08', value: 50.1 }, previous: { date: '2026-07', value: 50.1 } },
    gdp: { latest: { date: '2026-Q2', value: 4 }, previous: { date: '2026-Q1', value: 4 } },
    'industrial-production': { latest: { date: '2026-07', value: 4 }, previous: { date: '2026-06', value: 4 } },
    'retail-sales': { latest: { date: '2026-07', value: 0 }, previous: { date: '2026-06', value: 0 } },
    'fixed-asset-investment': { latest: { date: '2026-01–07', value: -1 }, previous: { date: '2026-01–06', value: -1 } },
  }));
  assert.equal(mixed.phase.label, '混合信号');
});

test('emits independent risks and evidence-backed watch items', () => {
  const snapshot = buildMacroSnapshot(makeIndicators({
    pmi: { latest: { date: '2026-08', value: 49.8 }, previous: { date: '2026-07', value: 50.4 } },
    gdp: { latest: { date: '2026-Q2', value: 4 }, previous: { date: '2026-Q1', value: 5 } },
    'industrial-production': { latest: { date: '2026-07', value: 4 }, previous: { date: '2026-06', value: 5 } },
    'retail-sales': { latest: { date: '2026-07', value: 0 }, previous: { date: '2026-06', value: 1 } },
    'fixed-asset-investment': { latest: { date: '2026-01–07', value: -1 }, previous: { date: '2026-01–06', value: 0 } },
    m2: { latest: { date: '2026-07', value: 7.7 }, previous: { date: '2026-06', value: 8 } },
  }));

  assert.ok(snapshot.risks.length >= 4);
  assert.ok(snapshot.risks.some((item) => item.title.includes('制造业')));
  assert.ok(snapshot.risks.some((item) => item.title.includes('同步走弱')));
  assert.ok(snapshot.risks.some((item) => item.title.includes('负增长')));
  assert.equal(snapshot.risks.find((item) => item.title.includes('负增长')).id, 'negative-activity-growth');
  assert.ok(snapshot.risks.some((item) => item.title.includes('货币增速')));
  assert.ok(snapshot.watchNext.length >= snapshot.risks.length);
  assert.ok(snapshot.watchNext.every((item) => item.evidenceIds.length > 0 && /下一期|下一次|继续观察/.test(item.explanation)));
  const publicExplanations = [
    snapshot.phase.explanation,
    ...snapshot.risks.map((item) => item.explanation),
    ...snapshot.watchNext.map((item) => item.explanation),
  ];
  assert.ok(publicExplanations.every((text) => !text.includes('较上一期')));
});

test('classifies price indicators separately from activity phase rules', () => {
  const baseline = buildMacroSnapshot(makeIndicators());
  const priceSnapshot = buildMacroSnapshot(makeIndicators({
    cpi: { latest: { date: '2026-07', value: -1 }, previous: { date: '2026-06', value: 2 } },
    'core-cpi': { latest: { date: '2026-07', value: 0 }, previous: { date: '2026-06', value: 0.2 } },
    ppi: { latest: { date: '2026-07', value: 3.5 }, previous: { date: '2026-06', value: 4.1 } },
  }));
  assert.equal(priceSnapshot.phase.label, baseline.phase.label);
  assert.deepEqual(
    priceSnapshot.signals.filter((signal) => signal.family === 'price-yoy').map((signal) => signal.id),
    ['cpi', 'core-cpi', 'ppi'],
  );
  assert.equal(priceSnapshot.signals.find((signal) => signal.id === 'cpi').changeUnit, 'percentage-points');
  assert.match(priceSnapshot.signals.find((signal) => signal.id === 'cpi').interpretation, /同比下降/);
  assert.ok(priceSnapshot.risks.every((risk) => !/通胀|通缩|价格/.test(risk.title)));
});

test('keeps exact price momentum boundaries stable', () => {
  const snapshot = buildMacroSnapshot(makeIndicators({
    cpi: { latest: { date: '2026-07', value: 1.0 }, previous: { date: '2026-06', value: 0.8 } },
  }));
  const cpi = snapshot.signals.find((signal) => signal.id === 'cpi');
  assert.equal(cpi.change, 0.19999999999999996);
  assert.match(cpi.interpretation, /基本稳定/);
});

test('derives a deterministic date and rejects incomplete input', () => {
  const snapshot = buildMacroSnapshot(makeIndicators({
    m1: { updatedAt: '2026-09-01' },
    m2: { updatedAt: '2026-08-31' },
  }));

  assert.equal(snapshot.asOf, '2026-09-01');
  assert.equal(snapshot.rulesVersion, macroSnapshotRulesVersion);
  assert.throws(
    () => buildMacroSnapshot(getDashboardIndicators().filter((item) => item.id !== 'm2')),
    /missing required indicator.*m2/i,
  );
});

test('renders an explainable homepage snapshot without changing dashboard ownership', () => {
  const component = readFileSync(snapshotComponent, 'utf8');
  const styles = readFileSync(snapshotStyles, 'utf8');
  const page = readFileSync(homepage, 'utf8');

  assert.match(component, /Macro snapshot|宏观快照/);
  assert.match(component, /fact/);
  assert.match(component, /interpretation/);
  assert.match(component, /changeUnit/);
  assert.match(component, /conceptHref|\/concepts/);
  assert.match(component, /投资建议|投资决策/);
  assert.match(component, /快照更新/);
  assert.match(styles, /@media\s*\(max-width:\s*760px\)/);
  assert.match(page, /MacroDashboard/);
  assert.match(page, /MacroSnapshot/);
  assert.match(page, /buildMacroSnapshot/);
});

test('snapshot exposes its update date without exposing the rules version', () => {
  const component = readFileSync(snapshotComponent, 'utf8');
  assert.match(component, /快照更新/);
  assert.doesNotMatch(component, /rulesVersion/);
  assert.doesNotMatch(component, /规则版本/);
  assert.doesNotMatch(component, /较上一期/);
  assert.doesNotMatch(component, /每个指标按自身口径解释/);
});

test('snapshot evidence carries indicator-specific change labels', () => {
  const snapshot = buildMacroSnapshot();
  assert.equal(signal(snapshot, 'gdp').changeLabel, '较上一季度');
  assert.equal(signal(snapshot, 'cpi').changeLabel, '较上月变化');
});
