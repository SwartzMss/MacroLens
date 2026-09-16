import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { learningPaths, publishedLearningPaths, validateLearningPaths, getLearningContext } from '../src/data/learningPaths.ts';
import { emptyProgress, parseLearningProgress, recordVisit, setStepRead, resumeStep, saveLearningProgress, contextualConceptHref, learningContextFromSearch } from '../src/data/learningProgress.ts';

const dir = new URL('../src/content/concepts/', import.meta.url);
const concepts = readdirSync(dir).filter(name => name.endsWith('.md')).map(name => {
  const content = readFileSync(new URL(name, dir), 'utf8');
  const id = content.match(/^id:\s*(.+)$/m)[1].trim();
  const prerequisites = content.match(/^prerequisites:\s*\[(.*?)\]/m)[1].split(',').map(s => s.trim()).filter(Boolean);
  return { data: { id, prerequisites } };
});
const money = publishedLearningPaths.find(path => path.id === 'money-credit');
const policy = publishedLearningPaths.find(path => path.id === 'monetary-transmission');
const foundation = publishedLearningPaths.find(path => path.id === 'macro-foundations');
const openEconomy = publishedLearningPaths.find(path => path.id === 'open-economy');

test('published routes resolve real concepts, recap evidence and prerequisite order', () => {
  assert.doesNotThrow(() => validateLearningPaths(learningPaths, concepts));
  assert.equal(publishedLearningPaths.length, 5);
  assert.equal(publishedLearningPaths[0].id, 'macro-foundations');
  assert.equal(publishedLearningPaths[0].steps.length, 18);
  assert.deepEqual(foundation.chapters.map(chapter => chapter.title), [
    '经济是什么', '钱与银行', '信用如何创造', '利率与货币政策',
    '什么是通胀', '经济如何影响就业与收入', '经济为什么会有周期', '把各部分联系起来',
  ]);
  const chapter = title => foundation.chapters.find(item => item.title === title);
  assert.ok(chapter('经济是什么').stepIds.includes('gdp'));
  assert.ok(chapter('钱与银行').stepIds.includes('m2'));
  assert.ok(chapter('信用如何创造').stepIds.includes('credit'));
  assert.ok(chapter('利率与货币政策').stepIds.includes('monetary-policy'));
  assert.ok(chapter('什么是通胀').stepIds.includes('cpi'));
  assert.ok(chapter('经济如何影响就业与收入').stepIds.includes('employment'));
  assert.ok(chapter('经济为什么会有周期').stepIds.includes('pmi'));
  assert.ok(chapter('经济为什么会有周期').stepIds.includes('inventory-cycle'));
  assert.equal(foundation.chapters.at(-1).stepIds.at(-1), 'recap');
  assert.ok(foundation.extensionConceptIds.includes('fiscal-policy'));
  assert.ok(!foundation.steps.some(step => ['fiscal-policy', 'fiscal-expenditure', 'government-debt', 'exchange-rate', 'exports', 'imports'].includes(step.id)));
  assert.deepEqual(openEconomy.topicIds, ['exchange-rates', 'balance-of-payments']);
  assert.deepEqual(openEconomy.steps.map(step => step.id), ['exchange-rate', 'exports', 'imports', 'recap']);
  assert.equal(policy.steps.at(-1).kind, 'recap');
});

test('route validation rejects missing content, reversed prerequisites and incomplete chapters', () => {
  const missing = structuredClone(money);
  missing.steps[0].conceptId = 'does-not-exist';
  assert.throws(() => validateLearningPaths([missing], concepts), /Missing learning concept/);
  const reversed = structuredClone(money);
  [reversed.steps[0], reversed.steps[1]] = [reversed.steps[1], reversed.steps[0]];
  assert.throws(() => validateLearningPaths([reversed], concepts), /prerequisite/);
  const chapter = structuredClone(money);
  chapter.chapters[0].stepIds.pop();
  assert.throws(() => validateLearningPaths([chapter], concepts), /Chapter order/);
  assert.throws(() => validateLearningPaths([money, money], concepts), /Duplicate/);
});

test('opening or jumping to recap only records position, never completes a route', () => {
  const visited = recordVisit(emptyProgress(), money, 'recap', 42);
  assert.equal(visited.paths[money.id].lastVisitedStepId, 'recap');
  assert.deepEqual(visited.paths[money.id].completedStepIds, []);
  const marked = setStepRead(visited, money, 'recap', true);
  assert.deepEqual(marked.paths[money.id].completedStepIds, ['recap']);
  assert.deepEqual(setStepRead(marked, money, 'recap', false).paths[money.id].completedStepIds, []);
  assert.deepEqual(recordVisit(visited, money, 'invalid', 99), visited);
});

test('progress on the same concept remains independent across routes', () => {
  let state = setStepRead(recordVisit(emptyProgress(), money, 'credit', 1), money, 'credit', true);
  state = recordVisit(state, policy, 'credit', 2);
  assert.deepEqual(state.paths[money.id].completedStepIds, ['credit']);
  assert.deepEqual(state.paths[policy.id].completedStepIds, []);
});

test('progress recovery removes invalid steps, preserves stable IDs and does not force new steps read', () => {
  const state = parseLearningProgress(JSON.stringify({ version: 1, paths: {
    [money.id]: { revision: 0, lastVisitedStepId: 'removed', completedStepIds: ['m1', 'm1', 'removed', 23], visitedAt: 5 },
    unknown: { completedStepIds: ['m0'] },
  } }));
  assert.deepEqual(state.paths[money.id].completedStepIds, ['m1']);
  assert.equal(state.paths[money.id].revision, money.revision);
  assert.equal(state.paths[money.id].lastVisitedStepId, 'm0');
  assert.equal(state.paths.unknown, undefined);
  assert.equal(resumeStep(money, state.paths[money.id]).id, 'm0');
  const done = { ...state.paths[money.id], lastVisitedStepId: 'm0', completedStepIds: money.steps.map(step => step.id) };
  assert.equal(resumeStep(money, done).id, 'recap');
  for (const raw of [null, 'broken', 'null', '{}', '{"version":2,"paths":{}}']) assert.deepEqual(parseLearningProgress(raw), emptyProgress());
});

test('supplemental links preserve the original return step across multiple concepts', () => {
  const origin = 'https://macrolens.example';
  const first = contextualConceptHref('/concepts/m2/#m2-detail', origin, policy.id, 'credit', true);
  assert.equal(first, '/concepts/m2/?learnPath=monetary-transmission&learnStep=credit#m2-detail');
  const context = learningContextFromSearch(new URL(first, origin).search);
  assert.equal(context.step.id, 'credit');
  const second = contextualConceptHref('/concepts/m1/', origin, context.path.id, context.step.id, false);
  assert.equal(learningContextFromSearch(new URL(second, origin).search).step.id, 'credit');
  assert.equal(contextualConceptHref('/concepts/lpr/', origin, policy.id, 'credit', true), '/learn/monetary-transmission/lpr/');
  assert.equal(contextualConceptHref('https://other.example/concepts/m2/', origin, policy.id, 'credit', true), null);
});

test('untrusted return contexts cannot redirect to arbitrary URLs or wrong route steps', () => {
  for (const search of ['?learnPath=https://other.example&learnStep=m0', '?learnPath=money-credit&learnStep=policy-rate', '?learnPath=__proto__&learnStep=m0']) assert.equal(learningContextFromSearch(search), null);
  assert.equal(getLearningContext('money-credit', '../m0'), null);
});

test('unavailable storage returns failure without throwing or pretending to persist', () => {
  assert.equal(saveLearningProgress({ setItem() { throw new Error('Quota exceeded'); } }, emptyProgress()), false);
  let raw;
  assert.equal(saveLearningProgress({ setItem(_key, value) { raw = value; } }, emptyProgress()), true);
  assert.deepEqual(parseLearningProgress(raw), emptyProgress());
});
