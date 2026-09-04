import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fetchText } from './fetch-text.ts';
import { discoverPBOCMoneySupplyPublications, parsePBOCMoneySupplyReport } from './fetch/pboc-money-supply.ts';
import { normalizeMoneySupplyDataset, validateReportRange } from './normalize/money-supply.ts';
import { validateMoneySupplyDataset } from './validate/money-supply.ts';
import { writeIndicatorDataset } from './write/indicator.ts';
import type { IndicatorDataset, MoneySupplyDatasetId, MoneySupplyPublication, RawMoneySupplyPublication } from './types.ts';
import { IngestionContractError } from './types.ts';

const PBOC_INDEX = 'https://www.pbc.gov.cn/diaochatongjisi/116219/116225/index.html';
const IDS: MoneySupplyDatasetId[] = ['m0', 'm1', 'm2'];

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
      console.log('Usage: npm run ingest:pboc-money-supply -- [--fixture-index FILE --fixture-dir DIR] [--target-dir DIR]');
      options.help = true;
      return options;
    } else throw new Error(`Unknown CLI option: ${argument}`);
  }
  if (!options.targetDir) throw new Error('--target-dir requires a directory path');
  const fixtureCount = [options.fixtureIndex, options.fixtureDir].filter(Boolean).length;
  if (fixtureCount !== 0 && fixtureCount !== 2) throw new Error('--fixture-index and --fixture-dir must be provided together');
  return options;
}

async function loadReports(options: CliOptions, publications: MoneySupplyPublication[]): Promise<RawMoneySupplyPublication[]> {
  const reports: RawMoneySupplyPublication[] = [];
  for (const publication of publications) {
    const html = options.fixtureDir
      ? await fs.readFile(`${options.fixtureDir}/report-${publication.month}.html`, 'utf8')
      : await fetchText(publication.url);
    reports.push(parsePBOCMoneySupplyReport(publication, html));
  }
  return reports;
}

async function loadIndex(options: CliOptions): Promise<string> {
  return options.fixtureIndex ? fs.readFile(options.fixtureIndex, 'utf8') : fetchText(PBOC_INDEX);
}

function latestMonth(dataset: IndicatorDataset): string {
  const latest = dataset.data.at(-1)?.date;
  if (!latest) throw new IngestionContractError(`Dataset ${dataset.id} contains no observations`);
  return latest;
}

export function selectPublications(publications: MoneySupplyPublication[], existingMonth: string): MoneySupplyPublication[] {
  const latestPublication = publications.at(-1);
  if (!latestPublication) throw new IngestionContractError('No PBOC publications available');
  const selected = publications.filter(({ month }) => month >= existingMonth);
  if (latestPublication.month > existingMonth && ![existingMonth, nextMonth(existingMonth)].includes(selected[0]?.month ?? '')) {
    throw new IngestionContractError(`PBOC publication range starts at ${selected[0]?.month}, expected ${existingMonth} or ${nextMonth(existingMonth)}`);
  }
  if (selected.length === 0) throw new IngestionContractError(`No PBOC publication covers existing month ${existingMonth}`);
  return selected;
}

function nextMonth(date: string): string {
  const [year, month] = date.split('-').map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
}

export async function runMoneySupply(args: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args);
  if (options.help) return;
  const existing = new Map<MoneySupplyDatasetId, IndicatorDataset>();
  for (const id of IDS) {
    const dataset = JSON.parse(await fs.readFile(`${options.targetDir}/${id}.json`, 'utf8')) as IndicatorDataset;
    validateMoneySupplyDataset(dataset, id);
    existing.set(id, dataset);
  }
  const existingMonths = IDS.map((id) => latestMonth(existing.get(id)!));
  if (new Set(existingMonths).size !== 1) throw new IngestionContractError(`PBOC datasets end at different months: ${existingMonths.join(', ')}`);
  const publications = discoverPBOCMoneySupplyPublications(await loadIndex(options));
  const selectedPublications = selectPublications(publications, existingMonths[0]);
  const rawReports = await loadReports(options, selectedPublications);
  validateReportRange(rawReports);

  const normalized = new Map<MoneySupplyDatasetId, IndicatorDataset>();
  for (const id of IDS) {
    normalized.set(id, normalizeMoneySupplyDataset(rawReports, existing.get(id)!, id));
  }
  for (const id of IDS) {
    const result = writeIndicatorDataset(`${options.targetDir}/${id}.json`, normalized.get(id)!);
    console.log(`${id}: ${normalized.get(id)!.data.at(-1)?.date} Changed: ${result.changed}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMoneySupply().catch((error: unknown) => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : error);
    process.exitCode = 1;
  });
}
