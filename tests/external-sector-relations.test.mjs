import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const graphPath = fileURLToPath(new URL('../data/relations/macro.json', import.meta.url));
const conceptsPath = fileURLToPath(new URL('../src/content/concepts/', import.meta.url));
const elements = JSON.parse(readFileSync(graphPath, 'utf8'));
const rawNodes = elements.filter(item => 'id' in item.data).map(item => item.data);
const nodes = new Map(rawNodes.map(node => [node.id, node]));
const relations = elements.filter(item => 'source' in item.data).map(item => item.data);

const canonicalRelationTypes = new Set([
  'CAUSES',
  'AFFECTS',
  'REFLECTS',
  'CORRELATES',
  'COMPONENT_OF',
  'IMPLEMENTS',
  'USES',
  'OVERLAPS_WITH',
  'MEASURES',
  'DERIVED_FROM',
]);

const expectedNodes = new Map([
  ['balance-of-payments', '国际收支'],
  ['current-account', '经常账户'],
  ['financial-account', '金融账户'],
  ['cross-border-capital-flows', '跨境资本流动'],
  ['effective-exchange-rate', '有效汇率（NEER / REER）'],
  ['cross-border-financial-transactions', '跨境金融交易'],
  ['multilateral-currency-value', '货币多边价值'],
]);

const expectedRelations = [
  ['current-account', 'balance-of-payments', 'COMPONENT_OF'],
  ['financial-account', 'balance-of-payments', 'COMPONENT_OF'],
  ['financial-account', 'cross-border-financial-transactions', 'MEASURES'],
  ['cross-border-capital-flows', 'cross-border-financial-transactions', 'REFLECTS'],
  ['cross-border-capital-flows', 'exchange-rate', 'AFFECTS'],
  ['cross-border-capital-flows', 'financing-conditions', 'AFFECTS'],
  ['current-account', 'exchange-rate', 'CORRELATES'],
  ['effective-exchange-rate', 'multilateral-currency-value', 'MEASURES'],
  ['effective-exchange-rate', 'cfets-rmb-index', 'CORRELATES'],
  ['effective-exchange-rate', 'economic-activity', 'AFFECTS'],
];

const relationKey = ({ source, target, type }) => `${source}\0${target}\0${type}`;
const expectedRelationKeys = expectedRelations
  .map(([source, target, type]) => relationKey({ source, target, type }))
  .sort();

test('registers external concept and abstract graph nodes', () => {
  const nodeIds = rawNodes.map(node => node.id);
  assert.equal(new Set(nodeIds).size, rawNodes.length, 'graph node IDs must be unique');
  for (const [id, label] of expectedNodes) assert.equal(nodes.get(id)?.label, label, `missing graph node ${id}`);

  for (const id of ['cross-border-financial-transactions', 'multilateral-currency-value']) {
    assert.equal(Object.hasOwn(nodes.get(id), 'kind'), false, `${id} must remain an abstract node`);
    assert.equal(existsSync(`${conceptsPath}${id}.md`), false, `${id} must not have a concept page`);
  }

  assert.equal(nodes.has('capital-account'), false, 'capital-account must not be a graph node');
  assert.equal(existsSync(`${conceptsPath}capital-account.md`), false, 'capital-account must not have a concept page');
});

test('uses the canonical non-deterministic external-sector relationships', () => {
  const relationKeys = relations.map(relationKey);
  assert.equal(new Set(relationKeys).size, relations.length, 'graph relation triples must be unique');

  for (const relation of relations) {
    assert.ok(nodes.has(relation.source), `missing source node ${relation.source}`);
    assert.ok(nodes.has(relation.target), `missing target node ${relation.target}`);
    assert.ok(canonicalRelationTypes.has(relation.type), `unknown relation type ${relation.type}`);
  }

  const externalRelations = relations.filter(
    relation => expectedNodes.has(relation.source) || expectedNodes.has(relation.target),
  );
  assert.deepEqual(externalRelations.map(relationKey).sort(), expectedRelationKeys);

  assert.equal(relations.some(relation => relation.type === 'CAUSES' && expectedNodes.has(relation.source)), false);
  assert.equal(relations.some(relation => relation.source === 'balance-of-payments' && relation.type === 'AFFECTS'), false);
});

test('stores symmetric external correlations only once', () => {
  for (const [source, target, type] of expectedRelations.filter(([, , type]) => type === 'CORRELATES')) {
    assert.equal(
      relations.filter(relation => relation.type === type && (
        (relation.source === source && relation.target === target)
        || (relation.source === target && relation.target === source)
      )).length,
      1,
    );
  }
});
