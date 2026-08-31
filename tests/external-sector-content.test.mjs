import assert from 'node:assert/strict';
import test from 'node:test';
import { categories, categoryIds } from '../src/data/categories.ts';

test('registers external as the category after exchange', () => {
  assert.equal(categoryIds.at(-1), 'external');
  assert.deepEqual(categories.external, {
    label: '外部部门',
    description: '理解国际收支、跨境资金流动与一国对外经济联系。',
    order: 70,
  });
  assert.ok(categories.external.order > categories.exchange.order);
});
