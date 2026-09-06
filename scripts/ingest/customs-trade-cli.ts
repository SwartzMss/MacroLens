import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CUSTOMS_TRADE_INDEX,
  discoverLatestCustomsTradePublication,
  fetchCustomsTradeIndex,
  fetchCustomsTradePublication,
  parseCustomsTradePublication,
} from './fetch/customs-trade.ts';
import { normalizeCustomsTradeDataset } from './normalize/customs-trade.ts';
import { validateCustomsTradeDataset } from './validate/customs-trade.ts';
import { writeIndicatorDatasetGroup } from './write/group.ts';
import type { CustomsTradePublication, IndicatorDataset, RawCustomsTradePublication } from './types.ts';

const IDS = ['exports', 'imports'] as const;

type CliOptions = {
  fixtureIndex?: string;
  fixtureDir?: string;
  targetDir: string;
  help?: boolean;
};

type FixtureConfig = {
  index?: string;
  publication?: string | CustomsTradePublication;
  publicationHtml?: string;
  publications?: Record<string, string>;
  html?: string;
};

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { targetDir: 'data/indicators' };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--fixture-index') options.fixtureIndex = args[++index];
    else if (argument === '--fixture-dir') options.fixtureDir = args[++index];
    else if (argument === '--target-dir') options.targetDir = args[++index] ?? '';
    else if (argument === '--help') {
      console.log('Usage: npm run ingest:customs-trade -- [--fixture-index FILE --fixture-dir DIR] [--target-dir DIR]');
      options.help = true;
      return options;
    } else throw new Error('Unknown CLI option: ' + argument);
  }
  if (!options.targetDir) throw new Error('--target-dir requires a directory path');
  if (options.fixtureIndex && !options.fixtureDir) {
    // A self-contained JSON fixture is useful for unit tests and local replay.
  } else if (!options.fixtureIndex && options.fixtureDir) {
    throw new Error('--fixture-index and --fixture-dir must be provided together');
  }
  return options;
}

async function loadExisting(targetDir: string): Promise<Map<typeof IDS[number], IndicatorDataset>> {
  const existing = new Map<typeof IDS[number], IndicatorDataset>();
  for (const id of IDS) {
    const dataset = JSON.parse(await fs.readFile(path.join(targetDir, `${id}.json`), 'utf8')) as IndicatorDataset;
    validateCustomsTradeDataset(dataset, id);
    existing.set(id, dataset);
  }
  return existing;
}

async function readFixtureFile(fixtureDir: string | undefined, value: string): Promise<string> {
  if (!fixtureDir) throw new Error(`Fixture directory is required to load ${value}`);
  return fs.readFile(path.join(fixtureDir, value), 'utf8');
}

async function loadFixtureRaw(fixturePath: string, fixtureDir?: string): Promise<RawCustomsTradePublication> {
  const config = JSON.parse(await fs.readFile(fixturePath, 'utf8')) as FixtureConfig & {
    publication?: CustomsTradePublication;
  };
  if (config.publication && config.html) {
    return parseCustomsTradePublication(config.publication, config.html);
  }

  const indexHtml = config.index
    ? await readFixtureFile(fixtureDir, config.index)
    : await fs.readFile(fixturePath, 'utf8');
  const publication = discoverLatestCustomsTradePublication(indexHtml);
  const htmlFile = config.publications?.[publication.url] ?? config.publicationHtml;
  if (!htmlFile) throw new Error(`Fixture index does not map the discovered publication: ${publication.url}`);
  return parseCustomsTradePublication(publication, await readFixtureFile(fixtureDir, htmlFile));
}

export async function runCustomsTrade(args: string[] = process.argv.slice(2)): Promise<{ changed: boolean }> {
  const options = parseArgs(args);
  if (options.help) return { changed: false };
  const existing = await loadExisting(options.targetDir);
  // One publication response contains both rows, so it is intentionally fetched
  // and parsed once before the two dataset normalizers run.
  const raw = options.fixtureIndex
    ? await loadFixtureRaw(options.fixtureIndex, options.fixtureDir)
    : await fetchCustomsTradePublication(discoverLatestCustomsTradePublication(await fetchCustomsTradeIndex()));
  const normalized = new Map<typeof IDS[number], IndicatorDataset>();
  for (const id of IDS) normalized.set(id, normalizeCustomsTradeDataset(raw, existing.get(id)!, id));

  const outputs = new Map(IDS.map((id) => [
    path.join(options.targetDir, `${id}.json`),
    `${JSON.stringify(normalized.get(id)!, null, 2)}\n`,
  ]));
  const result = await writeIndicatorDatasetGroup(outputs);
  for (const id of IDS) console.log(`${id}: ${normalized.get(id)!.data.at(-1)?.date} Changed: ${result.changed}`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCustomsTrade().catch((error: unknown) => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : error);
    process.exitCode = 1;
  });
}

export { CUSTOMS_TRADE_INDEX };
