import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const elements = JSON.parse(readFileSync(fileURLToPath(new URL('../data/relations/macro.json', import.meta.url)), 'utf8'));
const conceptDir = fileURLToPath(new URL('../src/content/concepts/', import.meta.url));
const nodes = new Map(elements.filter(item => 'id' in item.data).map(item => [item.data.id, item.data]));
const relations = elements.filter(item => 'source' in item.data).map(item => item.data);
const expectedNodes = new Map([
  ['international-investment-position', '国际投资头寸'], ['external-debt', '外债'], ['reserve-assets', '官方储备资产'],
  ['capital-account', '资本账户'], ['net-foreign-assets', '对外净资产 / 净国际投资头寸'],
  ['external-financial-position', '对外金融头寸'], ['external-liabilities', '对外负债'],
]);
const expected = [
  ['capital-account', 'balance-of-payments', 'COMPONENT_OF'],
  ['international-investment-position', 'external-financial-position', 'MEASURES'],
  ['external-debt', 'external-liabilities', 'COMPONENT_OF'],
  ['reserve-assets', 'international-investment-position', 'COMPONENT_OF'],
  ['foreign-exchange-reserves', 'reserve-assets', 'COMPONENT_OF'],
  ['net-foreign-assets', 'international-investment-position', 'DERIVED_FROM'],
];
const key = ({ source, target, type }) => `${source}\0${target}\0${type}`;

test('registers external stock indicators and abstract nodes', () => {
  assert.equal(new Set(nodes.keys()).size, nodes.size);
  for (const [id, label] of expectedNodes) assert.equal(nodes.get(id)?.label, label, `missing node ${id}`);
  for (const id of ['external-financial-position', 'external-liabilities']) {
    assert.equal(Object.hasOwn(nodes.get(id), 'kind'), false);
    assert.equal(existsSync(`${conceptDir}${id}.md`), false);
  }
  for (const id of ['international-investment-position', 'external-debt', 'reserve-assets', 'capital-account', 'net-foreign-assets']) assert.equal(nodes.get(id)?.kind, 'indicator');
});

test('uses only approved stock-flow accounting relations', () => {
  assert.equal(new Set(relations.map(key)).size, relations.length);
  for (const relation of relations) { assert.ok(nodes.has(relation.source)); assert.ok(nodes.has(relation.target)); }
  const cluster = relations.filter(relation => expectedNodes.has(relation.source) || expectedNodes.has(relation.target));
  assert.deepEqual(cluster.map(key).sort(), expected.map(([source, target, type]) => key({ source, target, type })).sort());
  assert.equal(cluster.some(relation => relation.type === 'CAUSES'), false);
});
