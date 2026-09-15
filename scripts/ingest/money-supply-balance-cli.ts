import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fetchText } from './fetch-text.ts';
import { canonicalText, discoverPBOCMoneySupplyPublications, parsePBOCMoneySupplyReport, validIsoDate } from './fetch/pboc-money-supply.ts';
import { selectPublications } from './money-supply-cli.ts';
import { coverageCoversDates, validateMonthlyObservations } from './validate/dataset.ts';
import { writeIndicatorDatasetGroup } from './write/group.ts';
import { mergeObservations } from './validate/overlap.ts';
import { IngestionContractError } from './types.ts';
import type { IndicatorSource, MoneySupplyDatasetId, Observation } from './types.ts';

type BalanceDataset = { unit: string; note: string; sources: IndicatorSource[]; data: Observation[] };
const IDS: MoneySupplyDatasetId[] = ['m0', 'm1', 'm2'];
const LABELS = { m0: '流通中货币', m1: '狭义货币', m2: '广义货币' };

export function parsePublishedBalance(html: string, id: MoneySupplyDatasetId): number {
  const matches = [...canonicalText(html).matchAll(new RegExp(`${LABELS[id]}\\(${id.toUpperCase()}\\)余额([^，。；]+?)(万亿元|亿元)`, 'g'))];
  if (matches.length !== 1 || !/^\d+(?:\.\d+)?$/.test(matches[0][1])) {
    throw new IngestionContractError(`Missing, duplicate or invalid ${id} published balance`);
  }
  const value = Number(matches[0][1]) / (matches[0][2] === '亿元' ? 10000 : 1);
  if (!Number.isFinite(value) || value <= 0) throw new IngestionContractError(`Invalid ${id} published balance`);
  return value;
}

function validateBalance(dataset: BalanceDataset): void {
  if (dataset.unit !== '万亿元' || !dataset.note) throw new IngestionContractError('Invalid balance metadata');
  validateMonthlyObservations(dataset.data, 'Money supply balance');
  if (dataset.data.some(row => row.value <= 0)) throw new IngestionContractError('Invalid balance value');
  if (!Array.isArray(dataset.sources) || !dataset.sources.length) throw new IngestionContractError('Missing balance sources');
  for (const source of dataset.sources) {
    const coverage = /^(\d{4}-(?:0[1-9]|1[0-2])) to (\d{4}-(?:0[1-9]|1[0-2]))$/.exec(source.coverage);
    if (!coverage || coverage[1] > coverage[2] || !validIsoDate(source.sourceDate) || !source.title || new URL(source.url).origin !== 'https://www.pbc.gov.cn') {
      throw new IngestionContractError('Invalid balance source');
    }
  }
  if (!coverageCoversDates(dataset.sources, dataset.data.map(row => row.date))) throw new IngestionContractError('Balance sources do not cover observations');
}

export async function runMoneySupplyBalances(args: string[] = process.argv.slice(2)): Promise<void> {
  let targetDir = 'data/chart-overlays';
  let fixtureIndex: string | undefined;
  let fixtureDir: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help') {
      console.log('Usage: node --import tsx scripts/ingest/money-supply-balance-cli.ts [--fixture-index FILE --fixture-dir DIR] [--target-dir DIR]');
      return;
    }
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new IngestionContractError(`${argument} requires a value`);
    if (argument === '--target-dir') targetDir = value;
    else if (argument === '--fixture-index') fixtureIndex = value;
    else if (argument === '--fixture-dir') fixtureDir = value;
    else throw new IngestionContractError(`Unknown CLI option: ${argument}`);
  }
  if (Boolean(fixtureIndex) !== Boolean(fixtureDir)) throw new IngestionContractError('Both fixture options are required');
  const existing = new Map<MoneySupplyDatasetId, BalanceDataset>();
  const originals = new Map<MoneySupplyDatasetId, string>();
  for (const id of IDS) {
    const original = await fs.readFile(`${targetDir}/${id}-balance.json`, 'utf8');
    const dataset = JSON.parse(original) as BalanceDataset;
    validateBalance(dataset);
    existing.set(id, dataset);
    originals.set(id, original);
  }
  const months = IDS.map(id => existing.get(id)!.data.at(-1)!.date);
  if (new Set(months).size !== 1) throw new IngestionContractError('Balance datasets end at different months');
  const indexHtml = fixtureIndex ? await fs.readFile(fixtureIndex, 'utf8') : await fetchText('https://www.pbc.gov.cn/diaochatongjisi/116219/116225/index.html');
  const publications = selectPublications(discoverPBOCMoneySupplyPublications(indexHtml), months[0]);
  const incoming = new Map<MoneySupplyDatasetId, Observation[]>(IDS.map(id => [id, []]));
  for (const publication of publications) {
    const html = fixtureDir ? await fs.readFile(`${fixtureDir}/report-${publication.month}.html`, 'utf8') : await fetchText(publication.url);
    // Enforce official report identity, publication date and revised M1 methodology.
    parsePBOCMoneySupplyReport(publication, html);
    for (const id of IDS) incoming.get(id)!.push({ date: publication.month, value: parsePublishedBalance(html, id) });
  }
  const outputs = new Map<MoneySupplyDatasetId, string>();
  for (const id of IDS) {
    const dataset = existing.get(id)!;
    validateMonthlyObservations(incoming.get(id)!, `Incoming ${id} balance`);
    const data = mergeObservations(dataset.data, incoming.get(id)!, `${id} balance`);
    // Keep table provenance and precise retrospective M1 history intact. Only add sources for appended months.
    const sources = [...dataset.sources, ...publications.filter(publication => publication.month > months[0]).map(publication => ({
      title: `中国人民银行：${publication.title}`, url: publication.url, sourceDate: publication.sourceDate,
      coverage: `${publication.month} to ${publication.month}`,
    }))];
    const normalized = { ...dataset, sources, data };
    validateBalance(normalized);
    outputs.set(id, `${JSON.stringify(normalized, null, 2)}\n`);
  }
  // Validate the complete group before staging; the shared writer rolls back failed replacements.
  await writeIndicatorDatasetGroup(new Map(IDS.map(id => [`${targetDir}/${id}-balance.json`, outputs.get(id)!])));
  for (const id of IDS) {
    console.log(`${id} balance: ${incoming.get(id)!.at(-1)!.date} Changed: ${outputs.get(id) !== originals.get(id)}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMoneySupplyBalances().catch((error: unknown) => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : error);
    process.exitCode = 1;
  });
}
