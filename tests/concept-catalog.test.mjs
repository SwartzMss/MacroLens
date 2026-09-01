import assert from 'node:assert/strict';
import test from 'node:test';
import { buildConceptCatalog } from '../src/data/conceptCatalog.ts';

const topics = [
  { id: 'money-supply', label: '货币供应与流动性', description: '理解货币层次。', category: 'money', order: 10 },
  { id: 'credit-financing', label: '信用与融资', description: '理解融资链条。', category: 'credit', order: 20 },
];

function entry(id, overrides = {}) {
  return {
    data: {
      id,
      name: id.toUpperCase(),
      subtitle: id,
      category: 'money',
      order: 1,
      level: 'basic',
      topics: ['money-supply'],
      prerequisites: [],
      featured: false,
      ...overrides,
    },
  };
}

test('builds stable lookup and topic membership for valid concepts', () => {
  const catalog = buildConceptCatalog([
    entry('m1'),
    entry('m2', { topics: ['money-supply', 'credit-financing'], order: 2 }),
  ], topics);

  assert.equal(catalog.byId.get('m1').data.name, 'M1');
  assert.deepEqual(catalog.topics.get('money-supply').map((item) => item.data.id), ['m1', 'm2']);
  assert.deepEqual(catalog.topics.get('credit-financing').map((item) => item.data.id), ['m2']);
});

test('rejects duplicate concept IDs and unknown topic IDs', () => {
  assert.throws(
    () => buildConceptCatalog([entry('m1'), entry('m1')], topics),
    /Duplicate stable concept ID: m1/,
  );
  assert.throws(
    () => buildConceptCatalog([entry('m1', { topics: ['unknown'] })], topics),
    /m1.*unknown topic/,
  );
});

test('rejects unknown, self, duplicate, and cyclic prerequisites', () => {
  assert.throws(
    () => buildConceptCatalog([entry('m1', { prerequisites: ['missing'] })], topics),
    /m1.*missing prerequisite/,
  );
  assert.throws(
    () => buildConceptCatalog([entry('m1', { prerequisites: ['m1'] })], topics),
    /m1.*itself/,
  );
  assert.throws(
    () => buildConceptCatalog([entry('m1', { topics: ['money-supply', 'money-supply'] })], topics),
    /m1.*duplicate topic/,
  );
  assert.throws(
    () => buildConceptCatalog([
      entry('m1', { prerequisites: ['m2'] }),
      entry('m2', { prerequisites: ['m1'] }),
    ], topics),
    /prerequisite cycle/,
  );
  assert.throws(
    () => buildConceptCatalog([
      entry('m1', { prerequisites: ['m2', 'm2'] }),
      entry('m2'),
    ], topics),
    /m1.*duplicate prerequisite/,
  );
});
