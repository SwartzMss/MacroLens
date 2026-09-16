import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fetchPbocText } from '../scripts/ingest/fetch-pboc-text.ts';
const url = 'https://www.pbc.gov.cn/report.html';
test('separate callers reuse one successful download, while new runs fetch afresh', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pboc-fetch-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  let calls = 0;
  const fetchImpl = async () => { calls++; return new Response('official report'); };
  assert.equal(await fetchPbocText(url, { cacheDir: dir, fetchImpl }), 'official report');
  assert.equal(await fetchPbocText(url, { cacheDir: dir, fetchImpl }), 'official report');
  assert.equal(calls, 1);
  const moduleUrl = new URL('../scripts/ingest/fetch-pboc-text.ts', import.meta.url).href;
  const output = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
    `import { fetchPbocText } from ${JSON.stringify(moduleUrl)};
     globalThis.fetch = async () => { throw new Error('Must not download again'); };
     console.log(await fetchPbocText(${JSON.stringify(url)}));`,
  ], { env: { ...process.env, MACROLENS_PBOC_CACHE_DIR: dir }, encoding: 'utf8' });
  assert.equal(output.trim(), 'official report');
  await fetchPbocText(url, { cacheDir: path.join(dir, 'new-run'), fetchImpl });
  assert.equal(calls, 2);
});
test('failed downloads are not cached and PBOC retries wait 2 then 4 seconds', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pboc-fetch-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const delays = [];
  await assert.rejects(fetchPbocText(url, { cacheDir: dir, sleep: async ms => delays.push(ms), fetchImpl: async () => { throw new Error('offline'); } }), /offline/);
  assert.deepEqual(delays, [2000, 4000]);
  assert.deepEqual(await fs.readdir(dir), []);
  assert.equal(await fetchPbocText(url, { cacheDir: dir, fetchImpl: async () => new Response('recovered') }), 'recovered');
});
