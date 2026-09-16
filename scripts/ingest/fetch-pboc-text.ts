import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fetchText, type FetchTextOptions } from './fetch-text.ts';

// The workflow creates a fresh directory for every job attempt. Successful GET
// responses can then be reused by separate ingestion processes in that attempt.
export async function fetchPbocText(
  url: string,
  options: Pick<FetchTextOptions, 'fetchImpl' | 'sleep'> & { cacheDir?: string } = {},
): Promise<string> {
  const cacheDir = options.cacheDir ?? process.env.MACROLENS_PBOC_CACHE_DIR;
  const file = cacheDir ? path.join(cacheDir, createHash('sha256').update(url).digest('hex') + '.html') : undefined;
  if (file) {
    try {
      return await fs.readFile(file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  const body = await fetchText(url, {
    fetchImpl: options.fetchImpl,
    sleep: options.sleep,
    backoffMs: 2_000,
    maxBackoffMs: 8_000,
    onDiagnostic: message => console.warn(message),
  });
  if (file) {
    await fs.mkdir(cacheDir!, { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, body, 'utf8');
      await fs.rename(temporary, file);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }
  return body;
}
