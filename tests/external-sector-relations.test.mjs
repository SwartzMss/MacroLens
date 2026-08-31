import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const graphPath = fileURLToPath(new URL('../data/relations/macro.json', import.meta.url));
const elements = JSON.parse(readFileSync(graphPath, 'utf8'));
const nodes = new Map(elements.filter(item => 'id' in item.data).map(item => [item.data.id, item.data]));
const relations = elements.filter(item => 'source' in item.data).map(item => item.data);

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

test('registers external concept and abstract graph nodes', () => {
  for (const [id, label] of expectedNodes) assert.equal(nodes.get(id)?.label, label, `missing graph node ${id}`);
});

test('uses the canonical non-deterministic external-sector relationships', () => {
  for (const [source, target, type] of expectedRelations) {
    assert.ok(
      relations.some(relation => relation.source === source && relation.target === target && relation.type === type),
      `missing ${source} --${type}--> ${target}`,
    );
  }
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
