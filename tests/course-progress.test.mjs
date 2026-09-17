import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCourseProgress, courseStorageKey, toggleCourseCompletion, saveCourseProgress, courseResumeTarget } from '../src/data/courseProgress.ts';
import { learningStorageKey } from '../src/data/learningProgress.ts';
test('new course never treats legacy reading as completion', () => {
  assert.notEqual(courseStorageKey, learningStorageKey);
  assert.deepEqual(parseCourseProgress(JSON.stringify({ version: 1, paths: { 'macro-foundations': { completedStepIds: ['gdp'] } } })), { version: 1, completed: [], lastVisited: null });
});
test('damaged, future and unpublished progress cannot mark courses complete', () => {
  for (const raw of [null, 'broken', 'null', '{}', '{"version":2,"completed":[]}']) assert.deepEqual(parseCourseProgress(raw).completed, []);
  assert.deepEqual(parseCourseProgress(JSON.stringify({ version: 1, completed: ['connected-economy', 'connected-economy', 'bank-lending', 5, '__proto__'], lastVisited: 'bank-lending' })), { version: 1, completed: ['connected-economy'], lastVisited: null });
});

test('new course analytics IDs cannot merge with legacy article feedback', async () => {
  const { learningArticleIdForPath } = await import('../functions/visitor.ts');
  assert.equal(learningArticleIdForPath('/learn/course/connected-economy/'), 'learn:course-connected-economy');
  assert.notEqual(learningArticleIdForPath('/learn/course/connected-economy/'), learningArticleIdForPath('/learn/old/connected-economy/'));
});

test('completion is explicit and reversible, including when persistence is unavailable', () => {
  const initial = parseCourseProgress(null);
  const done = toggleCourseCompletion(initial, 'connected-economy');
  assert.deepEqual(initial.completed, []);
  assert.deepEqual(done.completed, ['connected-economy']);
  assert.deepEqual(toggleCourseCompletion(done, 'connected-economy').completed, []);
  assert.equal(toggleCourseCompletion(initial, 'bank-lending'), initial);
  assert.equal(saveCourseProgress({ setItem() { throw new Error('disabled'); } }, done), false);
  let saved;
  assert.equal(saveCourseProgress({ setItem(key, raw) { assert.equal(key, courseStorageKey); saved = raw; } }, done), true);
  assert.deepEqual(parseCourseProgress(saved), done);
});

test('publishing a chapter preserves old progress without marking new content complete', () => {
  const old = parseCourseProgress(JSON.stringify({ version: 1, completed: ['connected-economy'], lastVisited: 'connected-economy' }));
  assert.deepEqual(old.completed, ['connected-economy']);
  assert.deepEqual(courseResumeTarget(old), { id: 'money', label: '继续学习 →' });
  const visited = { ...old, lastVisited: 'money' };
  assert.deepEqual(courseResumeTarget(visited), { id: 'money', label: '继续阅读 →' });
  assert.deepEqual(visited.completed, ['connected-economy']);
  const finished = toggleCourseCompletion(visited, 'money');
  assert.deepEqual(courseResumeTarget(finished), { id: 'money', label: '回顾已学内容 →' });
  assert.deepEqual(parseCourseProgress(JSON.stringify(finished)), finished);
  assert.deepEqual(toggleCourseCompletion(finished, 'money').completed, ['connected-economy']);
});

test('resume handles fresh, out-of-order and cleared progress without entering unpublished chapters', () => {
  assert.deepEqual(courseResumeTarget(parseCourseProgress(null)), { id: 'connected-economy', label: '开始第一章 →' });
  const jumped = { version: 1, completed: [], lastVisited: 'money' };
  assert.deepEqual(courseResumeTarget(jumped), { id: 'money', label: '继续阅读 →' });
  assert.deepEqual(courseResumeTarget(toggleCourseCompletion(jumped, 'money')), { id: 'connected-economy', label: '继续学习 →' });
  assert.equal(courseResumeTarget(parseCourseProgress('{"version":1,"completed":[],"lastVisited":"bank-lending"}')).id, 'connected-economy');
});
