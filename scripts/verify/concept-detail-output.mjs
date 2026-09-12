import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const directory = fileURLToPath(new URL('../../dist/concepts/', import.meta.url));
let checked = 0;
for (const item of readdirSync(directory, { withFileTypes: true })) {
  if (!item.isDirectory()) continue;
  const html = readFileSync(join(directory, item.name, 'index.html'), 'utf8');
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const links = [...html.matchAll(/href="#([^"]+)"/g)].map(match => decodeURIComponent(match[1]));
  for (const id of links) assert.ok(ids.has(id), `${item.name}: missing anchor ${id}`);
  const dataPosition = html.indexOf(`id="${item.name}-data"`);
  const detailPosition = html.indexOf(`id="${item.name}-detail"`);
  assert.ok(detailPosition >= 0, `${item.name}: missing article details`);
  if (dataPosition >= 0) {
    assert.ok(dataPosition < detailPosition, `${item.name}: data must precede article`);
    assert.ok(html.indexOf('data-chart=') < detailPosition, `${item.name}: chart must precede article`);
    assert.ok(ids.has(`${item.name}-sources`));
  }
  assert.match(html, /aria-label="本页目录"/);
  assert.match(html, /class="detail-mobile-toc"/);
  checked++;
}
console.log(`Verified section anchors and reading order on ${checked} concept pages.`);
