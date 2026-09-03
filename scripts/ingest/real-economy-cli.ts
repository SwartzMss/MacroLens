import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fetchNbsRealEconomySeries, parseNbsRealEconomyResponse } from './fetch/nbs-real-economy.ts';
import { normalizeRealEconomyDataset } from './normalize/real-economy.ts';
import { writeIndicatorDataset } from './write/indicator.ts';
import {
  REAL_ECONOMY_CONTRACTS,
} from './types.ts';
import type { IndicatorDataset, RealEconomyDatasetId } from './types.ts';
import { validateRealEconomyDataset } from './validate/real-economy.ts';

const IDS: RealEconomyDatasetId[] = ['gdp', 'industrial-production', 'retail-sales', 'fixed-asset-investment'];
const NBS_QUERY_ENDPOINT = 'https://data.stats.gov.cn/easyquery.htm';

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
      console.log('Usage: npm run ingest:nbs-real-economy -- [--fixture-index FILE --fixture-dir DIR] [--target-dir DIR]');
      options.help = true;
      return options;
    } else throw new Error('Unknown CLI option: ' + argument);
  }
  if (!options.targetDir) throw new Error('--target-dir requires a directory path');
  const fixtureCount = [options.fixtureIndex, options.fixtureDir].filter(Boolean).length;
  if (fixtureCount !== 0 && fixtureCount !== 2) throw new Error('--fixture-index and --fixture-dir must be provided together');
  return options;
}

async function loadExisting(targetDir: string): Promise<Map<RealEconomyDatasetId, IndicatorDataset>> {
  const existing = new Map<RealEconomyDatasetId, IndicatorDataset>();
  for (const id of IDS) {
    const dataset = JSON.parse(await fs.readFile(path.join(targetDir, id + '.json'), 'utf8')) as IndicatorDataset;
    validateRealEconomyDataset(dataset, id);
    existing.set(id, dataset);
  }
  return existing;
}

function livePublication(id: RealEconomyDatasetId) {
  const contract = REAL_ECONOMY_CONTRACTS[id];
  const dbcode = id === 'gdp' ? 'hgjd' : 'hgyd';
  const query = new URL(NBS_QUERY_ENDPOINT);
  query.searchParams.set('m', 'QueryData');
  query.searchParams.set('dbcode', dbcode);
  query.searchParams.set('rowcode', 'sj');
  query.searchParams.set('colcode', 'zb');
  query.searchParams.set('wds', '[]');
  query.searchParams.set('dfwds', JSON.stringify([{ wdcode: 'zb', valuecode: contract.sourceCodes.join(',') }]));
  query.searchParams.set('k1', String(Date.now()));
  query.searchParams.set('h', '1');
  return {
    title: '国家数据：' + contract.sourceTitle,
    url: query.toString(),
    sourceDate: new Date().toISOString().slice(0, 10),
    coverage: '',
  };
}

async function loadRawSeries(id: RealEconomyDatasetId, options: CliOptions) {
  const contract = REAL_ECONOMY_CONTRACTS[id];
  if (options.fixtureDir && options.fixtureIndex) {
    const index = JSON.parse(await fs.readFile(options.fixtureIndex, 'utf8')) as Record<string, string>;
    const fixtureName = index[id];
    if (!fixtureName) throw new Error('Fixture index is missing ' + id);
    const payload = JSON.parse(await fs.readFile(path.join(options.fixtureDir, fixtureName), 'utf8'));
    return parseNbsRealEconomyResponse(payload, payload.publication, contract);
  }
  return fetchNbsRealEconomySeries(livePublication(id), contract);
}

export async function runRealEconomy(args: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args);
  if (options.help) return;
  const existing = await loadExisting(options.targetDir);
  const candidates = new Map<RealEconomyDatasetId, IndicatorDataset>();
  for (const id of IDS) {
    const raw = await loadRawSeries(id, options);
    candidates.set(id, normalizeRealEconomyDataset(raw, existing.get(id)!, id));
  }
  for (const id of IDS) {
    const target = path.join(options.targetDir, id + '.json');
    const result = writeIndicatorDataset(target, candidates.get(id)!);
    console.log(id + ': ' + candidates.get(id)!.data.at(-1)?.date + ' Changed: ' + result.changed);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRealEconomy().catch((error: unknown) => {
    console.error(error instanceof Error ? error.name + ': ' + error.message : error);
    process.exitCode = 1;
  });
}

