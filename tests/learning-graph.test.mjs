import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, 'utf8');

test('relationship explorer accepts and preserves node deep links', () => {
  const explorer = read('src/components/RelationshipExplorer.astro');

  assert.match(explorer, /data-explorer-default-node/);
  assert.match(explorer, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(explorer, /searchParams\.set\('node'/);
  assert.match(explorer, /history\.replaceState/);
});
