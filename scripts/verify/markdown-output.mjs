import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, TEXT_NODE } from 'ultrahtml';

// Check rendered prose, not code examples, attributes, or embedded chart data.
export function findUnrenderedEmphasis(html) {
  const findings = [];
  function visit(node) {
    if (['code', 'pre', 'script', 'style'].includes(node.name)) return;
    if (node.type === TEXT_NODE && /\*\*|__|~~/.test(node.value)) {
      findings.push(node.value.trim());
    }
    for (const child of node.children ?? []) visit(child);
  }
  visit(parse(html));
  return findings;
}

function verifyDirectory(directory) {
  let checked = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) checked += verifyDirectory(path);
    else if (entry.name.endsWith('.html')) {
      const findings = findUnrenderedEmphasis(readFileSync(path, 'utf8'));
      assert.deepEqual(findings, [], `${path}: unrendered Markdown emphasis; use code markup for literal syntax examples`);
      checked++;
    }
  }
  return checked;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const checked = verifyDirectory(fileURLToPath(new URL('../../dist/', import.meta.url)));
  assert.ok(checked > 0, 'Build the site before checking Markdown output');
  console.log(`Verified rendered Markdown emphasis on ${checked} pages.`);
}
