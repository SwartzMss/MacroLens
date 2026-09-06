import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fetchText } from './fetch-text.ts';
import { discoverLprArchivePageLinks, discoverLprPublications, parseLprAnnouncement } from './fetch/lpr.ts';
import { normalizeLprDataset } from './normalize/lpr.ts';
import { validateLprDataset } from './validate/lpr.ts';
import { writeIndicatorDataset } from './write/indicator.ts';
import { IngestionContractError } from './types.ts';
import type { IndicatorDataset, LprPublication, RawLprPublication } from './types.ts';

export const PBOC_LPR_ARCHIVE_URL = 'https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125440/3876551/index.html';

type CliOptions = { fixtureDir?: string; target: string; help?: boolean };

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { target: 'data/indicators/lpr.json' };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--fixture-dir') options.fixtureDir = args[++index];
    else if (argument === '--target') options.target = args[++index] ?? '';
    else if (argument === '--help') {
      console.log('Usage: npm run ingest:lpr -- [--fixture-dir DIR] [--target FILE]');
      options.help = true;
      return options;
    } else throw new Error(`Unknown option: ${argument}`);
  }
  if (!options.target) throw new Error('--target requires a file path');
  return options;
}

export function selectLprPublications(publications: LprPublication[], existingMonth: string): LprPublication[] {
  const latest = publications.at(-1);
  if (!latest) throw new IngestionContractError('No PBOC LPR announcements available');
  const selected = publications.filter(({ month }) => month >= existingMonth);
  const first = selected[0]?.month;
  const [year, month] = existingMonth.split('-').map(Number);
  const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
  if (latest.month > existingMonth && first !== existingMonth && first !== nextMonth) throw new IngestionContractError(`PBOC LPR archive starts at ${first}, expected ${existingMonth} or ${nextMonth}`);
  if (selected.length === 0) throw new IngestionContractError(`No PBOC LPR announcement covers ${existingMonth}`);
  return selected;
}

async function readFixturePublication(fixtureDir: string, publication: LprPublication): Promise<string> {
  return fs.readFile(`${fixtureDir}/lpr-${publication.month}.html`, 'utf8');
}

async function loadPublications(options: CliOptions): Promise<{ publications: LprPublication[]; fixtureDir?: string }> {
  if (options.fixtureDir) {
    const index = await fs.readFile(`${options.fixtureDir}/publication-index.html`, 'utf8');
    return { publications: discoverLprPublications(index, PBOC_LPR_ARCHIVE_URL), fixtureDir: options.fixtureDir };
  }
  const index = await fetchText(PBOC_LPR_ARCHIVE_URL);
  const pageUrls = discoverLprArchivePageLinks(index, PBOC_LPR_ARCHIVE_URL);
  const pages = await Promise.all(pageUrls.map((url) => fetchText(url)));
  return { publications: discoverLprPublications([index, ...pages], PBOC_LPR_ARCHIVE_URL) };
}

export async function runLpr(args: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args);
  if (options.help) return;
  const existing = JSON.parse(await fs.readFile(options.target, 'utf8')) as IndicatorDataset;
  validateLprDataset(existing);
  const { publications, fixtureDir } = await loadPublications(options);
  const latestExisting = existing.data.at(-1)?.date;
  if (!latestExisting) throw new IngestionContractError('LPR dataset contains no latest observation');
  const selected = selectLprPublications(publications, latestExisting);
  const raw: RawLprPublication[] = [];
  for (const publication of selected) {
    const html = fixtureDir ? await readFixturePublication(fixtureDir, publication) : await fetchText(publication.url);
    raw.push(parseLprAnnouncement(publication, html));
  }
  const normalized = normalizeLprDataset(raw, existing);
  const result = writeIndicatorDataset(options.target, normalized);
  console.log(`lpr: ${normalized.data.at(-1)?.date} Changed: ${result.changed}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runLpr().catch((error: unknown) => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : error);
    process.exitCode = 1;
  });
}
