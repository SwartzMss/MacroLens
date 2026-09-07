import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import type { IndicatorDataset } from './types.ts';
import { IngestionContractError } from './types.ts';
import {
  POLICY_RATE_ARCHIVES, discoverPolicyRatePublications, fetchPolicyRateText,
  nextPolicyRateArchivePage, NonPolicyRatePublication, parsePolicyRatePublication, validateDay,
} from './fetch/policy-rate.ts';
import type { PolicyRatePublication, RawPolicyRate } from './fetch/policy-rate.ts';
import { combinePolicyRatePublications, normalizePolicyRateDataset } from './normalize/policy-rate.ts';
import { POLICY_RATE_METHODOLOGY, validatePolicyRateDataset } from './validate/policy-rate.ts';
import { writeIndicatorDataset } from './write/indicator.ts';

export const POLICY_RATE_BASELINE: IndicatorDataset = {
  id: 'policy-rate', country: 'CN', frequency: 'event', chartType: 'step', unit: '%', metric: 'rate',
  label: '7天期逆回购操作利率', chartTitle: '中国人民银行7天期逆回购操作利率',
  source: 'PBOC', calculation: 'published', updatedAt: '2024-07-19', verifiedThrough: '2024-07-19',
  comparabilityNote: '仅记录起始已知水平和官方调息生效日／操作日的利率变化，不补造月度或每日观测。水平区间表示沿用此前公布的利率；末端仅延伸至最近一次明确公布该利率的公告日期。2024-07-19 为历史起始水平，并非首次执行该利率的日期；2024-07-22 起改为固定利率、数量招标并强化主要政策利率地位，此前的操作利率不代表完全相同的政策框架。该利率不同于 LPR、DR007、R007；传导并非即时或等比例。',
  methodologyFingerprint: POLICY_RATE_METHODOLOGY, methodologyEffectiveFrom: '2024-07-22',
  sources: [{
    title: '公开市场业务交易公告 [2024]第142号',
    url: 'https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/5409133/index.html',
    sourceDate: '2024-07-19', coverage: '2024-07-19 to 2024-07-19',
  }],
  data: [{ date: '2024-07-19', value: 1.8 }],
};

type ReadText = (url: string) => Promise<string>;

export async function readPolicyRateArchive(startUrl: string, since: string, readText: ReadText): Promise<PolicyRatePublication[]> {
  validateDay(since);
  const selected: PolicyRatePublication[] = [];
  const visited = new Set<string>();
  let url: string | undefined = startUrl;
  let oldest = '9999-12-31';
  let reachedBoundary = false;
  while (url) {
    if (visited.has(url) || visited.size >= 300) throw new IngestionContractError('PBOC archive pagination cycle/limit');
    visited.add(url);
    const html = await readText(url);
    const publications = discoverPolicyRatePublications(html, url);
    if (publications[0].sourceDate > oldest) throw new IngestionContractError('PBOC archive pages are not chronologically ordered');
    oldest = publications.at(-1)!.sourceDate;
    selected.push(...publications.filter(item => item.sourceDate >= since));
    if (oldest < since) { reachedBoundary = true; break; }
    url = nextPolicyRateArchivePage(html, url);
  }
  if (!reachedBoundary || !selected.length) throw new IngestionContractError(`PBOC archive does not cover the historical overlap: ${since}`);
  if (new Set(selected.map(item => item.url)).size !== selected.length) throw new IngestionContractError('Duplicate publication across archive pages');
  // Numbering covers all transaction notices, including other instruments and zero operations.
  // Checking it before filtering prevents a missing notice from hiding a change and reversal.
  const chronological = selected.reverse();
  for (let index = 1; index < chronological.length; index++) {
    const number = (title: string) => Number(title.match(/第(\d+)号/)?.[1]);
    const previous = chronological[index - 1], current = chronological[index];
    if (previous.sourceDate.slice(0, 4) === current.sourceDate.slice(0, 4)
      ? number(current.title) !== number(previous.title) + 1
      : number(current.title) !== 1) throw new IngestionContractError(`Missing/out-of-order numbered PBOC announcement: ${current.title}`);
  }
  return chronological;
}

export async function runPolicyRate(args = process.argv.slice(2), readText: ReadText = fetchPolicyRateText): Promise<void> {
  let target = 'data/indicators/policy-rate.json', bootstrap = false;
  let asOf = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--target') target = args[++index] ?? '';
    else if (args[index] === '--bootstrap') bootstrap = true;
    else if (args[index] === '--as-of') asOf = args[++index] ?? '';
    else if (args[index] === '--help') {
      console.log('Usage: npm run ingest:policy-rate -- [--target FILE] [--bootstrap] [--as-of YYYY-MM-DD]');
      return;
    } else throw new Error(`Unknown option: ${args[index]}`);
  }
  if (!target) throw new Error('--target requires a file path');
  validateDay(asOf);
  let existing = POLICY_RATE_BASELINE;
  try {
    const content = await fs.readFile(target, 'utf8');
    if (bootstrap) throw new Error('--bootstrap requires a new target; refusing to overwrite existing history');
    existing = JSON.parse(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || !bootstrap) throw error;
  }
  validatePolicyRateDataset(existing);
  if (asOf < existing.verifiedThrough!) throw new IngestionContractError('--as-of predates verified history');
  const publications = new Map<string, PolicyRatePublication>();
  // Always re-fetch every recorded event and the last explicit rate confirmation.
  for (const source of existing.sources) publications.set(source.url, { title: source.title, url: source.url, sourceDate: source.sourceDate });
  for (const archive of POLICY_RATE_ARCHIVES) {
    const since = archive === POLICY_RATE_ARCHIVES[0] ? existing.data[0].date : existing.verifiedThrough!;
    for (const publication of await readPolicyRateArchive(archive, since, readText)) {
      const known = publications.get(publication.url);
      if (known && (known.title !== publication.title || known.sourceDate !== publication.sourceDate)) throw new IngestionContractError('PBOC archive changed a recorded publication identity');
      publications.set(publication.url, publication);
    }
  }
  const raw: RawPolicyRate[] = [];
  let skipped = 0;
  for (const publication of publications.values()) {
    if (publication.sourceDate > asOf) continue;
    try {
      const item = parsePolicyRatePublication(publication, await readText(publication.url));
      if (item.date <= asOf) raw.push(item);
    } catch (error) {
      if (!(error instanceof NonPolicyRatePublication)) throw error;
      skipped++;
    }
  }
  const normalized = normalizePolicyRateDataset(combinePolicyRatePublications(raw), existing);
  const result = writeIndicatorDataset(target, normalized);
  console.log(`policy-rate: ${normalized.data.at(-1)!.value}% from ${normalized.data.at(-1)!.date}; verified through ${normalized.verifiedThrough}; skipped ${skipped} non-rate notices; Changed: ${result.changed}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPolicyRate().catch((error: unknown) => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : error);
    process.exitCode = 1;
  });
}
