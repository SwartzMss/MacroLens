import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildMacroSnapshot } from '../src/data/macroSnapshot.ts';
import { getRelationData } from '../src/data/graphRegistry.ts';
import { getHomepageRelationshipPreview, getNotableSignals, formatSignalChange, getPmiReading, getHomeSynthesis, localizeExplanation } from '../src/data/home.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const homeDirectory = `${root}src/components/home`;
const componentNames = ['HomeHero', 'MacroStateSummary', 'LatestReading', 'LearningPaths'];
const homepagePath = `${root}src/pages/index.astro`;
const snapshotPagePath = `${root}src/pages/snapshot.astro`;

test('homepage view models use stable signals and valid concept routes', () => {
  const snapshot = buildMacroSnapshot();
  const signals = getNotableSignals(snapshot);

  assert.deepEqual(signals.map((signal) => signal.id), [
    'pmi', 'gdp', 'fixed-asset-investment', 'unemployment-rate', 'm2',
  ]);
  assert.ok(signals.every((signal) => signal.conceptHref === `/concepts/${signal.id}`));
});

test('homepage relationship preview resolves canonical graph edges', () => {
  const { relations } = getRelationData('macro');
  const relationKeys = new Set(relations.map((item) => `${item.source}|${item.target}|${item.type}`));

  for (const relation of getHomepageRelationshipPreview()) {
    assert.ok(relationKeys.has(`${relation.source}|${relation.target}|${relation.type}`));
  }
});

test('homepage learning entry opens an independent course', () => {
  const source = readFileSync(`${homeDirectory}/LearningPaths.astro`, 'utf8');
  assert.match(source, /courseLessonHref/);
  assert.doesNotMatch(source, /LearningCard|conceptId/);
});

test('homepage components expose the required semantic sections and links', () => {
  const source = componentNames.map((name) => readFileSync(`${homeDirectory}/${name}.astro`, 'utf8')).join('\n');
  const styles = readFileSync(`${root}src/styles/home.css`, 'utf8');

  for (const id of ['home-hero', 'macro-state', 'learning-paths']) {
    assert.match(source, new RegExp(`id=["']${id}["']`));
  }
  assert.match(source, /domain\.state/);
  assert.match(source, /domain\.explanation/);
  assert.match(source, /signal\.conceptHref/);
  assert.match(source, /featuredDomainIds/);
  assert.match(source, /getMacroNowQuestionForDomain/);
  assert.match(source, /home-domain-grid/);
  assert.match(source, /home-domain-question/);
  assert.match(source, /home-learning-promo/);
  assert.doesNotMatch(source, /(?:01|02)\s*\//);
  assert.doesNotMatch(source, /home-hero-entry-note/);
  assert.doesNotMatch(source, /MacroLens · 宏观经济观察与学习/);
  assert.doesNotMatch(source, /home-featured-grid/);
  assert.doesNotMatch(source, /RelationshipPreview/);
  assert.match(source, /home-domain-detail-link/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media\s*\(max-width:\s*760px\)/);
});

test('homepage is a narrative entry point and full snapshot has its own route', () => {
  const home = readFileSync(homepagePath, 'utf8');
  const homeComponents = componentNames.map((name) => readFileSync(`${homeDirectory}/${name}.astro`, 'utf8')).join('\n');
  const snapshot = readFileSync(snapshotPagePath, 'utf8');
  for (const name of ['HomeHero', 'LearningPaths', 'MacroStateSummary']) {
    assert.match(home, new RegExp(name));
  }
  assert.match(home, /home-landing/);
  assert.doesNotMatch(home, /MacroDashboard|<MacroSnapshot|TransmissionPaths|<NotableSignals/);
  assert.doesNotMatch(`${home}\n${homeComponents}`, /href=["']\/snapshot["']/);
  assert.match(`${home}\n${homeComponents}`, /href=["']\/now\/["']/);
  assert.match(snapshot, /MacroSnapshot/);
  assert.match(snapshot, /buildMacroSnapshot/);

  const order = ['HomeHero', 'LearningPaths', 'MacroStateSummary']
    .map((name) => home.indexOf(name));
  assert.ok(order.every((index) => index >= 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test('homepage loads its presentation stylesheet', () => {
  const home = readFileSync(homepagePath, 'utf8');
  assert.match(home, /import\s+['"]\.\.\/styles\/home\.css['"]/);
});

test('PMI reading distinguishes direction from the expansion threshold', () => {
  const pmi = getNotableSignals(buildMacroSnapshot())[0];
  assert.equal(getPmiReading({ ...pmi, latest: 49.8, change: .6 }), '较上月回升 0.6 点，低于 50 荣枯线。');
  assert.equal(getPmiReading({ ...pmi, latest: 50.2, change: -.2 }), '较上月回落 0.2 点，高于 50 荣枯线。');
  assert.equal(getPmiReading({ ...pmi, latest: 50, change: 0 }), '与上月持平，位于 50 荣枯线。');
  assert.match(getPmiReading({ ...pmi, change: null }), /暂无上期可比读数/);
});

test('signal changes retain rate units and handle absent and rounded-zero changes', () => {
  const signals = getNotableSignals(buildMacroSnapshot());
  const labor = signals.find(signal => signal.id === 'unemployment-rate');
  assert.equal(formatSignalChange({ ...labor, change: .2 }), '+0.2 个百分点');
  assert.equal(formatSignalChange({ ...signals[0], change: -.6 }), '-0.6 点');
  assert.equal(formatSignalChange({ ...labor, change: null }), '暂无可比数据');
  assert.equal(formatSignalChange({ ...labor, change: -.00001 }), '0.0 个百分点');
});

test('homepage synthesis preserves opposing signals and localizes rule labels', () => {
  const snapshot = buildMacroSnapshot();
  const mixed = { ...snapshot, synthesis: { ...snapshot.synthesis, supportingDomainIds: ['growth'], conflictingDomainIds: ['labor'] } };
  assert.match(getHomeSynthesis(mixed), /增长.*改善；劳动.*偏弱/);
  assert.match(getHomeSynthesis({ ...snapshot, synthesis: { ...snapshot.synthesis, supportingDomainIds: [], conflictingDomainIds: [] } }), /尚未形成一致方向/);
  assert.equal(localizeExplanation('方向为weakening和strengthening；政策为stable。'), '方向为走弱和走强；政策为稳定。');
});

test('latest readings do not classify raw change direction as negative', () => {
  const component = readFileSync(`${homeDirectory}/LatestReading.astro`, 'utf8');
  const styles = readFileSync(`${root}src/styles/home.css`, 'utf8');
  assert.doesNotMatch(component, /is-negative|change\s*<\s*0/);
  assert.doesNotMatch(styles, /\.home-signal-change\.is-negative/);
});

test('policy rate changes preserve hundredths of a percentage point', () => {
  const policy = buildMacroSnapshot().domains.find(domain => domain.id === 'policy-financial-conditions').evidence[0];
  assert.equal(formatSignalChange({ ...policy, change: -.05 }), '-0.05 个百分点');
  assert.equal(formatSignalChange({ ...policy, change: .15 }), '+0.15 个百分点');
});
