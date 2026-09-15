import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ids = ['m0', 'm1', 'm2'];
const read = async file => JSON.parse(await readFile(file, 'utf8'));
const run = dir => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/ingest/money-supply-balance-cli.ts', '--fixture-index', 'tests/fixtures/pboc/publication-index.html', '--fixture-dir', 'tests/fixtures/pboc', '--target-dir', dir], { encoding: 'utf8' });
async function setup(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'money-balance-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const id of ids) {
    const dataset = await read(`data/chart-overlays/${id}-balance.json`);
    dataset.data = dataset.data.filter(row => row.date <= '2026-06');
    dataset.sources = dataset.sources.filter(source => source.coverage.split(' to ')[1] <= '2026-06');
    await writeFile(`${dir}/${id}-balance.json`, `${JSON.stringify(dataset, null, 2)}\n`);
  }
  return dir;
}

test('balance CLI appends published balances with provenance and preserves comparable history, then is idempotent', async t => {
  const dir = await setup(t);
  const before = await read(`${dir}/m1-balance.json`);
  const result = run(dir);
  assert.equal(result.status, 0, result.stderr);
  for (const id of ids) {
    const dataset = await read(`${dir}/${id}-balance.json`);
    const original = await read(`data/chart-overlays/${id}-balance.json`);
    assert.deepEqual(dataset.data, original.data.filter(row => row.date <= '2026-07'));
    assert.equal(dataset.sources.at(-1).coverage, '2026-07 to 2026-07');
    assert.equal(dataset.sources.at(-1).sourceDate, '2026-08-14');
  }
  const after = await read(`${dir}/m1-balance.json`);
  assert.deepEqual(after.data.slice(0, before.data.length), before.data);
  const second = run(dir);
  assert.equal(second.status, 0, second.stderr);
  assert.equal((second.stdout.match(/Changed: false/g) ?? []).length, 3);
});

test('a balance overlap mismatch prevents all three files from being written', async t => {
  const dir = await setup(t);
  const dataset = await read(`${dir}/m2-balance.json`);
  dataset.data.at(-1).value += 1;
  await writeFile(`${dir}/m2-balance.json`, JSON.stringify(dataset));
  const before = await Promise.all(ids.map(id => readFile(`${dir}/${id}-balance.json`, 'utf8')));
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Historical .*balance mismatch/);
  assert.deepEqual(await Promise.all(ids.map(id => readFile(`${dir}/${id}-balance.json`, 'utf8'))), before);
});

test('published balance parser converts explicit units and rejects missing, negative and duplicate values', async () => {
  const { parsePublishedBalance } = await import('../scripts/ingest/money-supply-balance-cli.ts');
  assert.equal(parsePublishedBalance('流通中货币(M0)余额123400亿元', 'm0'), 12.34);
  assert.equal(parsePublishedBalance('狭义货币（M1）余额115.46万亿元', 'm1'), 115.46);
  for (const text of ['狭义货币(M1)同比增长5%', '狭义货币(M1)余额-1万亿元', '狭义货币(M1)余额1万亿元，狭义货币(M1)余额1万亿元']) {
    assert.throws(() => parsePublishedBalance(text, 'm1'), /published balance/);
  }
});
