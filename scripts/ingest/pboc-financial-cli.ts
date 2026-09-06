import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fetchText } from './fetch-text.ts';
import {
  discoverPBOCCreditPublications,
  discoverPBOCSocialFinancingPublications,
  parsePBOCCreditReport,
  parsePBOCSocialFinancingReport,
} from './fetch/pboc-credit-social-financing.ts';
import { normalizePBOCFinancialDataset, validatePBOCFinancialReportRange } from './normalize/pboc-credit-social-financing.ts';
import { validatePBOCFinancialDataset } from './validate/pboc-credit-social-financing.ts';
import { writeIndicatorDatasetGroup } from './write/group.ts';
import type { IndicatorDataset, MoneySupplyPublication, PBOCFinancialDatasetId, RawPBOCFinancialPublication } from './types.ts';
import { IngestionContractError } from './types.ts';

const PBOC_INDEX = 'https://www.pbc.gov.cn/diaochatongjisi/116219/116225/index.html';
const IDS: PBOCFinancialDatasetId[] = ['credit', 'social-financing'];

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
      console.log('Usage: npm run ingest:pboc-financial -- [--fixture-index FILE --fixture-dir DIR] [--target-dir DIR]');
      options.help = true;
      return options;
    } else throw new Error(`Unknown CLI option: ${argument}`);
  }
  if (!options.targetDir) throw new Error('--target-dir requires a directory path');
  const fixtureCount = [options.fixtureIndex, options.fixtureDir].filter(Boolean).length;
  if (fixtureCount !== 0 && fixtureCount !== 2) throw new Error('--fixture-index and --fixture-dir must be provided together');
  return options;
}

async function loadIndex(options: CliOptions): Promise<string> {
  return options.fixtureIndex ? fs.readFile(options.fixtureIndex, 'utf8') : fetchText(PBOC_INDEX);
}

function latestMonth(dataset: IndicatorDataset): string {
  const latest = dataset.data.at(-1)?.date;
  if (!latest) throw new IngestionContractError(`Dataset ${dataset.id} contains no observations`);
  return latest;
}

export function selectPBOCFinancialPublications(publications: MoneySupplyPublication[], existingMonth: string): MoneySupplyPublication[] {
  const latestPublication = publications.at(-1);
  if (!latestPublication) throw new IngestionContractError('No PBOC financial publications available');
  const selected = publications.filter(({ month }) => month >= existingMonth);
  const firstMonth = selected[0]?.month;
  if (latestPublication.month > existingMonth && ![existingMonth, nextMonth(existingMonth)].includes(firstMonth ?? '')) {
    throw new IngestionContractError(`PBOC publication range starts at ${firstMonth}, expected ${existingMonth} or ${nextMonth(existingMonth)}`);
  }
  if (selected.length === 0) throw new IngestionContractError(`No PBOC publication covers existing month ${existingMonth}`);
  return selected;
}

function nextMonth(date: string): string {
  const [year, month] = date.split('-').map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
}

async function loadCreditReports(options: CliOptions, publications: MoneySupplyPublication[]): Promise<RawPBOCFinancialPublication[]> {
  const reports: RawPBOCFinancialPublication[] = [];
  for (const publication of publications) {
    const html = options.fixtureDir
      ? await fs.readFile(`${options.fixtureDir}/report-${publication.month}.html`, 'utf8')
      : await fetchText(publication.url);
    reports.push(parsePBOCCreditReport(publication, html));
  }
  return reports;
}

async function loadSocialFinancingReports(options: CliOptions, publications: MoneySupplyPublication[]): Promise<RawPBOCFinancialPublication[]> {
  const reports: RawPBOCFinancialPublication[] = [];
  for (const publication of publications) {
    const html = options.fixtureDir
      ? await fs.readFile(`${options.fixtureDir}/social-financing-${publication.month}.html`, 'utf8')
      : await fetchText(publication.url);
    reports.push(parsePBOCSocialFinancingReport(publication, html));
  }
  return reports;
}

export async function runPBOCFinancial(args: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args);
  if (options.help) return;
  const existing = new Map<PBOCFinancialDatasetId, IndicatorDataset>();
  for (const id of IDS) {
    const dataset = JSON.parse(await fs.readFile(`${options.targetDir}/${id}.json`, 'utf8')) as IndicatorDataset;
    validatePBOCFinancialDataset(dataset, id);
    existing.set(id, dataset);
  }
  const indexHtml = await loadIndex(options);
  const creditPublications = selectPBOCFinancialPublications(discoverPBOCCreditPublications(indexHtml), latestMonth(existing.get('credit')!));
  const socialPublications = selectPBOCFinancialPublications(discoverPBOCSocialFinancingPublications(indexHtml), latestMonth(existing.get('social-financing')!));
  const creditReports = await loadCreditReports(options, creditPublications);
  const socialReports = await loadSocialFinancingReports(options, socialPublications);
  validatePBOCFinancialReportRange(creditReports);
  validatePBOCFinancialReportRange(socialReports);
  const normalized = new Map<PBOCFinancialDatasetId, IndicatorDataset>([
    ['credit', normalizePBOCFinancialDataset(creditReports, existing.get('credit')!, 'credit')],
    ['social-financing', normalizePBOCFinancialDataset(socialReports, existing.get('social-financing')!, 'social-financing')],
  ]);
  const outputs = new Map(IDS.map((id) => [
    `${options.targetDir}/${id}.json`,
    `${JSON.stringify(normalized.get(id)!, null, 2)}\n`,
  ]));
  const result = await writeIndicatorDatasetGroup(outputs);
  for (const id of IDS) console.log(`${id}: ${normalized.get(id)!.data.at(-1)?.date} Changed: ${result.changed}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPBOCFinancial().catch((error: unknown) => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : error);
    process.exitCode = 1;
  });
}
