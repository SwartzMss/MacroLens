import assert from 'node:assert/strict';
import test from 'node:test';
import { categories, categoryIds } from '../src/data/categories.ts';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const conceptDirectory = fileURLToPath(new URL('../src/content/concepts/', import.meta.url));

function readConcept(id) {
  const path = `${conceptDirectory}/${id}.md`;
  assert.ok(existsSync(path), `${id} concept page is missing`);
  return readFileSync(path, 'utf8');
}

function assertConcept(id, order, terms, sourceUrls) {
  const document = readConcept(id);
  assert.match(document, new RegExp(`^id: ${id}$`, 'm'));
  assert.match(document, /^category: external$/m);
  assert.match(document, /^graph: macro$/m);
  assert.match(document, new RegExp(`^order: ${order}$`, 'm'));
  assert.doesNotMatch(document, /^chart:/m);
  for (const term of terms) assert.ok(document.includes(term), `${id} must explain ${term}`);
  for (const url of sourceUrls) assert.ok(document.includes(url), `${id} must cite ${url}`);
}

test('registers external as the category after exchange', () => {
  assert.equal(categoryIds.at(-1), 'external');
  assert.deepEqual(categories.external, {
    label: '外部部门',
    description: '理解国际收支、跨境资金流动与一国对外经济联系。',
    order: 70,
  });
  assert.ok(categories.external.order > categories.exchange.order);
});

test('balance-of-payments teaches the complete BPM6 accounting structure', () => {
  assertConcept('balance-of-payments', 1, [
    '居民与非居民', '国籍', '某一期间', '国际投资头寸', '估值变化',
    '经常账户', '资本账户', '金融账户', '净误差与遗漏',
    '净获得金融资产', '净发生负债', '会计恒等',
  ], [
    'https://www.safe.gov.cn/safe/2015/1230/6080.html',
    'https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm',
  ]);
});

test('current-account separates BOP flows from customs trade data', () => {
  assertConcept('current-account', 2, [
    '货物和服务', '初次收入', '二次收入', '海关', '经济所有权',
    '离岸价格', '季度或年度流量', '并不保证人民币升值',
  ], [
    'https://www.safe.gov.cn/safe/2015/1230/6080.html',
    'https://www.safe.gov.cn/safe/zggjszphb/index.html',
  ]);
});
