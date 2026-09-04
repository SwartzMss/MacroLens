import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fetchText } from './fetch-text.ts';
import { discoverLatestPmiPublication, parsePmiPublication } from './fetch/nbs-pmi.ts';
import { normalizePmiDataset } from './normalize/pmi.ts';
import { validateIndicatorDataset } from './validate/dataset.ts';
import { writeIndicatorDataset } from './write/indicator.ts';
import type { PmiPublication } from './types.ts';

const NBS_PUBLICATION_INDEX = 'https://www.stats.gov.cn/sj/zxfbhjd/';

type CliOptions = {
  fixtureIndex?: string;
  fixturePublication?: string;
  target: string;
};

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { target: 'data/indicators/pmi.json' };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--target') options.target = args[++index] ?? '';
    else if (argument === '--fixture-index') options.fixtureIndex = args[++index];
    else if (argument === '--fixture-publication') options.fixturePublication = args[++index];
    else throw new Error(`Unknown CLI option: ${argument}`);
  }
  if (!options.target) throw new Error('--target requires a file path');
  const fixtureArgs = [options.fixtureIndex, options.fixturePublication].filter(Boolean).length;
  if (fixtureArgs !== 0 && fixtureArgs !== 2) throw new Error('--fixture-index and --fixture-publication must be provided together');
  return options;
}

async function loadPublication(options: CliOptions): Promise<{ publication: PmiPublication; html: string }> {
  if (options.fixtureIndex && options.fixturePublication) {
    const [indexHtml, html] = await Promise.all([
      fs.readFile(options.fixtureIndex, 'utf8'),
      fs.readFile(options.fixturePublication, 'utf8'),
    ]);
    const publication = discoverLatestPmiPublication(indexHtml);
    return { publication, html };
  }
  const indexHtml = await fetchText(NBS_PUBLICATION_INDEX);
  const publication = discoverLatestPmiPublication(indexHtml);
  return { publication, html: await fetchText(publication.url) };
}

export async function run(args: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args);
  const existing = JSON.parse(await fs.readFile(options.target, 'utf8'));
  validateIndicatorDataset(existing);
  const { publication, html } = await loadPublication(options);
  const raw = parsePmiPublication(publication, html);
  const dataset = normalizePmiDataset(raw, existing);
  validateIndicatorDataset(dataset);
  const result = writeIndicatorDataset(options.target, dataset);
  const first = raw.observations[0].date;
  const lastObservation = raw.observations.at(-1);
  if (!lastObservation) throw new Error('No observations returned from NBS PMI publication');
  const last = lastObservation.date;
  console.log(`PMI source: ${publication.url}`);
  console.log(`Published: ${publication.sourceDate}`);
  console.log(`Observations: ${first} to ${last}`);
  console.log(`Changed: ${result.changed}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : error);
    process.exitCode = 1;
  });
}
