import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const pages = [
  'dist/index.html',
  'dist/concepts/gdp/index.html',
  'dist/concepts/credit/index.html',
].map((file) => resolve(root, file));
const engineeringMetadata = /rulesVersion|methodologyFingerprint|runtime|静态生成/;

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  assert.doesNotMatch(html, engineeringMetadata, `${page} exposes engineering metadata`);
}

const dashboard = readFileSync(pages[0], 'utf8');
const gdp = readFileSync(pages[1], 'utf8');
const credit = readFileSync(pages[2], 'utf8');
assert.match(dashboard, /快照更新/);
assert.match(gdp, /如何阅读/);
assert.match(gdp, /来源详情/);
assert.match(credit, /来源：中国人民银行/);
