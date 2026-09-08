import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildMacroSnapshot } from '../src/data/macroSnapshot.ts';
import { getRelationData } from '../src/data/graphRegistry.ts';
import { getHomepageRelationshipPreview, getNotableSignals, learningPaths } from '../src/data/home.ts';

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
