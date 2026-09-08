import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildMacroSnapshot } from '../src/data/macroSnapshot.ts';
import { getRelationData } from '../src/data/graphRegistry.ts';
import { getHomepageRelationshipPreview, getNotableSignals, learningPaths, formatSignalChange, getPmiReading, getHomeSynthesis, localizeExplanation } from '../src/data/home.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const conceptsDirectory = `${root}src/content/concepts`;
const homeDirectory = `${root}src/components/home`;
const componentNames = ['HomeHero', 'MacroStateSummary', 'NotableSignals', 'RelationshipPreview', 'LearningPaths'];
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

test('homepage learning paths link only to existing concepts', () => {
  const conceptIds = new Set(readdirSync(conceptsDirectory).map((name) => name.replace(/\.md$/, '')));
  for (const path of learningPaths) {
    assert.ok(path.title.trim());
    assert.ok(path.steps.length >= 2);
    for (const step of path.steps) assert.ok(conceptIds.has(step.id), `${path.title}/${step.id}`);
  }
});

test('homepage components expose the required semantic sections and links', () => {
  const source = componentNames.map((name) => readFileSync(`${homeDirectory}/${name}.astro`, 'utf8')).join('\n');
  const styles = readFileSync(`${root}src/styles/home.css`, 'utf8');

  for (const id of ['home-hero', 'macro-state', 'notable-signals', 'relationship-preview', 'learning-paths']) {
    assert.match(source, new RegExp(`id=["']${id}["']`));
  }
  assert.match(source, /domain\.state/);
  assert.match(source, /domain\.explanation/);
  assert.match(source, /signal\.conceptHref/);
  assert.match(source, /relation\.source/);
  assert.match(source, /relation\.target/);
  assert.match(source, /\/graph/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media\s*\(max-width:\s*760px\)/);
});

test('homepage is a narrative entry point and full snapshot has its own route', () => {
  const home = readFileSync(homepagePath, 'utf8');
  const homeComponents = componentNames.map((name) => readFileSync(`${homeDirectory}/${name}.astro`, 'utf8')).join('\n');
  const snapshot = readFileSync(snapshotPagePath, 'utf8');
  for (const name of ['HomeHero', 'MacroStateSummary', 'NotableSignals', 'RelationshipPreview', 'LearningPaths']) {
    assert.match(home, new RegExp(name));
  }
  assert.doesNotMatch(home, /MacroDashboard|<MacroSnapshot|TransmissionPaths/);
  assert.match(`${home}\n${homeComponents}`, /href=["']\/snapshot["']/);
  assert.match(snapshot, /MacroSnapshot/);
  assert.match(snapshot, /buildMacroSnapshot/);

  const order = ['HomeHero', 'MacroStateSummary', 'NotableSignals', 'RelationshipPreview', 'LearningPaths']
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

test('notable signals do not classify raw change direction as negative', () => {
  const component = readFileSync(`${homeDirectory}/NotableSignals.astro`, 'utf8');
  const styles = readFileSync(`${root}src/styles/home.css`, 'utf8');
  assert.doesNotMatch(component, /is-negative|change\s*<\s*0/);
  assert.doesNotMatch(styles, /\.home-signal-change\.is-negative/);
});
