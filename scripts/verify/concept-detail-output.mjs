import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const directory = fileURLToPath(new URL('../../dist/concepts/', import.meta.url));
let checked = 0;
for (const item of readdirSync(directory, { withFileTypes: true })) {
  if (!item.isDirectory()) continue;
  const html = readFileSync(join(directory, item.name, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /data-content-layer="concept"/);
  assert.doesNotMatch(html, /进入学习路线|回答“它是什么？”/);
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const links = [...html.matchAll(/href="#([^"]+)"/g)].map(match => decodeURIComponent(match[1]));
  for (const id of links) assert.ok(ids.has(id), `${item.name}: missing anchor ${id}`);
  const dataPosition = html.indexOf(`id="${item.name}-data"`);
  const detailPosition = html.indexOf(`id="${item.name}-detail"`);
  const entryPosition = html.indexOf(`id="${item.name}-start"`);
  const knowledgePosition = html.indexOf(`id="${item.name}-knowledge"`);
  assert.ok(detailPosition >= 0, `${item.name}: missing article details`);
  assert.ok(!html.includes('<span>证据与来源</span>'), `${item.name}: relationship evidence must not be duplicated in overview`);
  assert.ok(entryPosition >= 0 && entryPosition < detailPosition, `${item.name}: understanding entry must precede article`);
  assert.equal([...html.matchAll(new RegExp(`id="${item.name}-start"`, 'g'))].length, 1, `${item.name}: duplicate understanding entry`);
  if (knowledgePosition >= 0) assert.ok(detailPosition < knowledgePosition, `${item.name}: relationship overview must follow article`);
  if (dataPosition >= 0) {
    assert.ok(entryPosition < dataPosition, `${item.name}: understanding entry must precede data`);
    assert.ok(detailPosition < dataPosition, `${item.name}: article must precede data`);
    assert.ok(detailPosition < html.indexOf('data-chart='), `${item.name}: article must precede chart`);
    if (knowledgePosition >= 0) assert.ok(dataPosition < knowledgePosition, `${item.name}: data must precede relationship overview`);
    for (const navigation of html.matchAll(/<nav\b[^>]*data-detail-navigation[^>]*>([\s\S]*?)<\/nav>/g)) {
      const detailLink = navigation[1].indexOf(`href="#${item.name}-detail"`);
      const dataLink = navigation[1].indexOf(`href="#${item.name}-data"`);
      assert.ok(detailLink >= 0 && detailLink < dataLink, `${item.name}: navigation must list article before data`);
    }
    assert.ok(ids.has(`${item.name}-sources`));
  }
  assert.match(html, /aria-label="本页目录"/);
  assert.match(html, /class="detail-mobile-toc"/);
  checked++;
}
console.log(`Verified section anchors and reading order on ${checked} concept pages.`);
