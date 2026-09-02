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
  ['exports', '出口'],
  ['imports', '进口'],
  ['trade-balance', '贸易差额'],
  ['trade-volume-and-price', '贸易数量与价格拆分'],
  ['terms-of-trade', '贸易条件'],
  ['cross-border-financial-transactions', '跨境金融交易'],
  ['multilateral-currency-value', '货币多边价值'],
  ['external-trade', '对外贸易'],
  ['domestic-demand-and-input-demand', '国内需求与投入需求'],
  ['exports-and-imports', '出口与进口'],
  ['current-account-goods-balance', '经常账户货物差额'],
  ['export-import-relative-prices', '进出口相对价格'],
  ['trade-pricing-and-competitiveness', '贸易定价与竞争力'],
]);

const expectedRelations = [
  ['capital-account', 'balance-of-payments', 'COMPONENT_OF'],
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
  ['exports', 'economic-activity', 'AFFECTS'],
  ['imports', 'domestic-demand-and-input-demand', 'REFLECTS'],
  ['exports', 'external-trade', 'COMPONENT_OF'],
  ['imports', 'external-trade', 'COMPONENT_OF'],
  ['trade-balance', 'exports-and-imports', 'DERIVED_FROM'],
  ['trade-balance', 'current-account-goods-balance', 'OVERLAPS_WITH'],
  ['terms-of-trade', 'export-import-relative-prices', 'REFLECTS'],
  ['exchange-rate', 'trade-pricing-and-competitiveness', 'AFFECTS'],
];

const relationKey = ({ source, target, type }) => `${source}\0${target}\0${type}`;
const expectedRelationKeys = expectedRelations
  .map(([source, target, type]) => relationKey({ source, target, type }))
  .sort();
const openEconomySources = new Set(['capital-controls', 'impossible-trinity', 'interest-rate-parity', 'usd-cnh', 'carry-trade']);

test('registers external concept and abstract graph nodes', () => {
  const nodeIds = rawNodes.map(node => node.id);
  assert.equal(new Set(nodeIds).size, rawNodes.length, 'graph node IDs must be unique');
  for (const [id, label] of expectedNodes) assert.equal(nodes.get(id)?.label, label, `missing graph node ${id}`);

  for (const id of [
    'cross-border-financial-transactions', 'multilateral-currency-value',
    'external-trade', 'domestic-demand-and-input-demand', 'exports-and-imports',
    'current-account-goods-balance', 'export-import-relative-prices',
    'trade-pricing-and-competitiveness',
  ]) {
    assert.equal(Object.hasOwn(nodes.get(id), 'kind'), false, `${id} must remain an abstract node`);
    assert.equal(existsSync(`${conceptsPath}${id}.md`), false, `${id} must not have a concept page`);
  }

  assert.equal(nodes.get('capital-account')?.label, '资本账户', 'capital-account must be a standalone graph node');
  assert.equal(nodes.get('capital-account')?.kind, 'indicator', 'capital-account must be an indicator node');
  assert.equal(existsSync(`${conceptsPath}capital-account.md`), true, 'capital-account must have a concept page');
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
    relation => !openEconomySources.has(relation.source)
      && (expectedNodes.has(relation.source) || expectedNodes.has(relation.target)),
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
