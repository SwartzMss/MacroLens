import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildConceptCatalog } from '../src/data/conceptCatalog.ts';
import { topicRegistry } from '../src/data/topics.ts';

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

test('sorts topic concepts by prerequisite layers before order and ID', () => {
  const catalog = buildConceptCatalog([
    entry('a', { order: 10 }),
    entry('b', { order: 1, prerequisites: ['a'] }),
    entry('c', { order: 2 }),
  ], topics);

  const topicIds = catalog.topics.get('money-supply').map((item) => item.data.id);
  assert.deepEqual(topicIds, ['c', 'a', 'b']);
  assert.ok(topicIds.indexOf('a') < topicIds.indexOf('b'));
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

const conceptsDirectory = fileURLToPath(new URL('../src/content/concepts/', import.meta.url));

function parseFrontmatter(document) {
  const match = document.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, 'concept must have leading YAML frontmatter');
  const values = {};
  for (const line of match[1].split('\n')) {
    const field = line.match(/^([a-zA-Z][\w]*):\s*(.*)$/);
    if (!field) continue;
    const [, key, rawValue] = field;
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      values[key] = rawValue.slice(1, -1).split(',').map((value) => value.trim()).filter(Boolean);
    } else if (rawValue === 'true' || rawValue === 'false') {
      values[key] = rawValue === 'true';
    } else {
      values[key] = rawValue;
    }
  }
  return values;
}

test('every concept declares validated browsing metadata', () => {
  const entries = readdirSync(conceptsDirectory)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => ({ data: parseFrontmatter(readFileSync(`${conceptsDirectory}/${name}`, 'utf8')) }));

  for (const entry of entries) {
    assert.match(entry.data.level ?? '', /^(basic|advanced)$/, `${entry.data.id} must declare level`);
    assert.ok(Array.isArray(entry.data.topics) && entry.data.topics.length > 0, `${entry.data.id} must declare topics`);
    assert.equal(typeof entry.data.featured, 'boolean', `${entry.data.id} must declare featured`);
    assert.ok(Array.isArray(entry.data.prerequisites), `${entry.data.id} must declare prerequisites`);
  }
  const catalog = buildConceptCatalog(entries, topicRegistry);
  const moneySupplyIds = catalog.topics.get('money-supply').map((item) => item.data.id);
  assert.deepEqual(moneySupplyIds, ['m0', 'm1', 'm2']);

  const marketRatesIds = catalog.topics.get('market-rates').map((item) => item.data.id);
  assert.ok(marketRatesIds.indexOf('policy-rate') < marketRatesIds.indexOf('interbank-rate'));
  assert.deepEqual(catalog.byId.get('cpi').data.prerequisites, []);
  assert.deepEqual(catalog.byId.get('core-cpi').data.prerequisites, ['cpi']);
});
