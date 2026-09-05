import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  discoverLatestPricePublication,
  fetchNbsPriceIndex,
  fetchNbsPricePublication,
  parseNbsPricePublication,
} from './fetch/nbs-prices.ts';
import { normalizePriceDataset } from './normalize/prices.ts';
import { writeIndicatorDatasetGroup } from './write/group.ts';
import { PRICE_CONTRACTS } from './types.ts';
import type { IndicatorDataset, PriceDatasetId } from './types.ts';
import { validatePriceDataset } from './validate/prices.ts';

const IDS: PriceDatasetId[] = ['cpi', 'core-cpi', 'ppi'];

type CliOptions = {
  fixtureIndex?: string;
  fixtureDir?: string;
  targetDir: string;
  help?: boolean;
};

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { targetDir: 'data/indicators' };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--fixture-index') options.fixtureIndex = args[++index];
    else if (argument === '--fixture-dir') options.fixtureDir = args[++index];
    else if (argument === '--target-dir') options.targetDir = args[++index] ?? '';
    else if (argument === '--help') {
      console.log('Usage: npm run ingest:nbs-prices -- [--fixture-index FILE --fixture-dir DIR] [--target-dir DIR]');
      options.help = true;
      return options;
    } else throw new Error('Unknown CLI option: ' + argument);
  }
  if (!options.targetDir) throw new Error('--target-dir requires a directory path');
  const fixtureCount = [options.fixtureIndex, options.fixtureDir].filter(Boolean).length;
  if (fixtureCount !== 0 && fixtureCount !== 2) throw new Error('--fixture-index and --fixture-dir must be provided together');
  return options;
}

async function loadExisting(targetDir: string): Promise<Map<PriceDatasetId, IndicatorDataset>> {
  const existing = new Map<PriceDatasetId, IndicatorDataset>();
  for (const id of IDS) {
    const dataset = JSON.parse(await fs.readFile(path.join(targetDir, `${id}.json`), 'utf8')) as IndicatorDataset;
    validatePriceDataset(dataset, id);
    existing.set(id, dataset);
  }
  return existing;
}

async function loadRawSeries(
  id: PriceDatasetId,
  options: CliOptions,
  fixtureIndex?: Record<string, string>,
  liveIndex?: string,
) {
  if (options.fixtureDir && fixtureIndex) {
    const fixtureName = fixtureIndex[id];
    if (!fixtureName) throw new Error(`Fixture index is missing ${id}`);
    const payload = JSON.parse(await fs.readFile(path.join(options.fixtureDir, fixtureName), 'utf8')) as { publication: Parameters<typeof parseNbsPricePublication>[0]; html: string };
    return parseNbsPricePublication(payload.publication, payload.html, id);
  }
  if (!liveIndex) throw new Error(`Live NBS price index was not loaded for ${id}`);
  const publication = discoverLatestPricePublication(liveIndex, id);
  return fetchNbsPricePublication(publication, id);
}

export async function runPrices(args: string[] = process.argv.slice(2)): Promise<{ changed: boolean }> {
  const options = parseArgs(args);
  if (options.help) return { changed: false };
  const existing = await loadExisting(options.targetDir);
  const fixtureIndex = options.fixtureIndex
    ? JSON.parse(await fs.readFile(options.fixtureIndex, 'utf8')) as Record<string, string>
    : undefined;
  const liveIndex = fixtureIndex ? undefined : await fetchNbsPriceIndex();
  const candidates = new Map<PriceDatasetId, IndicatorDataset>();
  for (const id of IDS) {
    const raw = await loadRawSeries(id, options, fixtureIndex, liveIndex);
    candidates.set(id, normalizePriceDataset(raw, existing.get(id)!, id));
  }

  const outputs = new Map<string, string>();
  for (const id of IDS) outputs.set(
    path.join(options.targetDir, `${id}.json`),
    `${JSON.stringify(candidates.get(id), null, 2)}\n`,
  );
  const result = await writeIndicatorDatasetGroup(outputs);
  for (const id of IDS) console.log(`${id}: ${candidates.get(id)!.data.at(-1)?.date} Changed: ${result.changed}`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPrices().catch((error: unknown) => {
    console.error(error instanceof Error ? error.name + ': ' + error.message : error);
    process.exitCode = 1;
  });
}
