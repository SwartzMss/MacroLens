import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
const updateWorkflow = fs.readFileSync('.github/workflows/update-macro-data.yml', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');
const nodeVersion = fs.existsSync('.nvmrc') ? fs.readFileSync('.nvmrc', 'utf8').trim() : '';

test('release runtime is Node 24 with an Astro-compatible minimum', () => {
  assert.equal(nodeVersion, '24');
  assert.equal(packageJson.engines.node, '>=22.12.0');
  assert.match(ci, /node-version:\s*24/);
  assert.match(updateWorkflow, /node-version:\s*24/);
  assert.doesNotMatch(ci, /node-version:\s*20/);
  assert.doesNotMatch(updateWorkflow, /node-version:\s*20/);
});

test('README describes the shipped V1 runtime and product boundaries', () => {
  assert.match(readme, /宏观经济教育|宏观经济学习/);
  assert.match(readme, /Node(?:\.js)?\s*24|Node 24/);
  assert.match(readme, /Macro Snapshot/);
  assert.match(readme, /数据 PR|data PR/);
  assert.match(readme, /不提供投资建议|非投资建议/);
  assert.doesNotMatch(readme, /Cytoscape/);
});
