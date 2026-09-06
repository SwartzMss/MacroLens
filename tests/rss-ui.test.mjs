import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const layoutPath = fileURLToPath(new URL('../src/layouts/BaseLayout.astro', import.meta.url));
const layout = readFileSync(layoutPath, 'utf8');

test('exposes an accessible RSS subscription link in the footer', () => {
  const footer = layout.match(/<footer class="site-footer">([\s\S]*?)<\/footer>/)?.[1] ?? '';

  assert.match(footer, /<a href="\/rss\.xml" aria-label="订阅 MacroLens RSS">RSS 订阅<\/a>/);
  assert.match(layout, /<link rel="alternate" type="application\/rss\+xml" title="MacroLens 知识库更新" href="\/rss\.xml" \/>/);

  const nav = layout.match(/<nav[\s\S]*?<\/nav>/)?.[0] ?? '';
  assert.doesNotMatch(nav, /rss\.xml|RSS 订阅/i);
});
