import { IngestionContractError, MethodologyMismatchError, PRICE_CONTRACTS } from '../types.ts';
import type {
  IndicatorSource,
  NbsPricePublication,
  PriceDatasetId,
  RawNbsPriceSeries,
} from '../types.ts';
import { fetchText } from '../fetch-text.ts';
import type { FetchTextOptions } from '../fetch-text.ts';

const NBS_INDEX = 'https://www.stats.gov.cn/sj/zxfbhjd/';
const NBS_INDEX_MAX_PAGES = 12;
const NBS_ORIGIN = 'https://www.stats.gov.cn';
type TextFetcher = (url: string, options?: FetchTextOptions) => Promise<string>;

function fail(message: string): never {
  throw new IngestionContractError(message);
}

function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function monthFromCoverage(coverage: string): string {
  const match = coverage.match(/^(\d{4})-(\d{2}) to \1-\2$/);
  if (!match) fail(`Price publication must cover one exact month: ${coverage}`);
  return `${match[1]}-${match[2]}`;
}

function signedValue(direction: string, value: string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) fail(`Invalid published price value: ${value}`);
  if (direction === '下降') return -numeric;
  return numeric;
}

function assertObservableMethodology(text: string, id: PriceDatasetId, url: string): void {
  const compact = text.replace(/\s+/g, '');
  const marker = /2026年1月份?(?:起|开始编制和发布).{0,240}2025年为基期/;
  if (!marker.test(compact)) {
    throw new MethodologyMismatchError(
      `Official ${id} publication is missing the expected 2025-base methodology marker: ${url}`,
    );
  }
}

function tableCells(fragment: string): string[] {
  return [...fragment.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)]
    .map((match) => textOf(match[1]));
}

function coreCpiTableValue(html: string): number {
  for (const tableMatch of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const rows = [...tableMatch[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map((match) => tableCells(match[1]))
      .filter((cells) => cells.length > 0);
    const row = rows.find((cells) => cells.some((cell) => /不包括食品和能源/.test(cell)));
    if (!row) continue;

    const header = rows.find((cells) => cells.some((cell) => /同比/.test(cell)) && cells.some((cell) => /环比/.test(cell)));
    const labelIndex = row.findIndex((cell) => /不包括食品和能源/.test(cell));
    const yoyIndex = header?.findIndex((cell) => /同比/.test(cell)) ?? -1;
    const numericCells = row.slice(labelIndex + 1).filter((cell) => /^[-+]?\d+(?:\.\d+)?%?$/.test(cell));
    const candidate = yoyIndex >= 0
      ? row[yoyIndex]
      : numericCells[1];
    const numeric = candidate?.replace('%', '').trim();
    if (numeric && /^[-+]?\d+(?:\.\d+)?$/.test(numeric)) return Number(numeric);
    fail('Official core-cpi table contains an invalid YoY value');
  }
  fail('Official core-cpi YoY value was not found in the CPI table');
}

function publishedValue(text: string, id: PriceDatasetId): number {
  if (id === 'core-cpi') return coreCpiTableValue(text);
  const pattern = id === 'cpi'
    ? /居民消费价格(?:同比)?(?:(上涨|下降)(\d+(?:\.\d+)?)%|(持平))/
    : /工业生产者出厂价格(?:同比)?(?:(上涨|下降)(\d+(?:\.\d+)?)%|(持平))/;
  const match = text.match(pattern);
  if (!match) fail(`Official ${id} YoY value was not found in publication`);
  return match[3] ? 0 : signedValue(match[1], match[2]);
}

function coverageFromTitle(title: string, id: PriceDatasetId): string {
  const pattern = id === 'ppi'
    ? /^(\d{4})年(\d{1,2})月份.*工业生产者出厂价格/
    : /^(\d{4})年(\d{1,2})月份.*居民消费价格/;
  const match = title.replace(/\s+/g, '').match(pattern);
  if (!match) fail(`Cannot derive monthly price coverage from publication: ${title}`);
  const month = String(Number(match[2])).padStart(2, '0');
  return `${match[1]}-${month} to ${match[1]}-${month}`;
}

function publicationPattern(id: PriceDatasetId): RegExp {
  return id === 'ppi' ? /工业生产者出厂价格.*同比/ : /居民消费价格.*同比/;
}

function indexPageUrl(page: number): string {
  return page === 0 ? NBS_INDEX : `${NBS_INDEX}index_${page}.html`;
}

function hasPublication(indexHtml: string, id: PriceDatasetId): boolean {
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  return [...indexHtml.matchAll(anchorPattern)].some((match) => {
    const title = textOf(match[2]);
    return publicationPattern(id).test(title) && !title.includes('解读');
  });
}

export function parseNbsPricePublication(
  publication: NbsPricePublication,
  html: string,
  id: PriceDatasetId,
): RawNbsPriceSeries {
  const contract = PRICE_CONTRACTS[id];
  if (!contract) fail(`Unsupported price dataset: ${id}`);
  if (new URL(publication.url).origin !== NBS_ORIGIN) fail(`Price publication is not hosted by stats.gov.cn: ${publication.url}`);
  if (!validDate(publication.sourceDate)) fail(`Invalid price publication date: ${publication.sourceDate}`);
  const visible = textOf(html);
  assertObservableMethodology(visible, id, publication.url);
  const value = publishedValue(id === 'core-cpi' ? html : visible, id);
  const coverage = publication.coverage || coverageFromTitle(publication.title, id);
  const date = monthFromCoverage(coverage);
  const source: IndicatorSource = {
    title: `国家统计局：${publication.title}`,
    url: publication.url,
    sourceDate: publication.sourceDate,
    coverage,
    role: 'data',
  };
  return {
    publication: { ...publication, coverage },
    id,
    seriesCode: contract.sourceCode,
    seriesTitle: contract.sourceTitle,
    unit: contract.unit,
    frequency: contract.frequency,
    metric: contract.metric,
    methodologyFingerprint: contract.methodologyFingerprint,
    dataSources: [source],
    observations: [{ date, value }],
  };
}

export function discoverLatestPricePublication(indexHtml: string, id: PriceDatasetId): NbsPricePublication {
  const candidates: NbsPricePublication[] = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of indexHtml.matchAll(anchorPattern)) {
    const title = textOf(match[2]);
    if (!publicationPattern(id).test(title) || title.includes('解读')) continue;
    const afterAnchor = indexHtml.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 500);
    const dateMatch = afterAnchor.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (!dateMatch || !validDate(dateMatch[1])) fail(`Price publication date missing or invalid: ${title}`);
    const url = new URL(match[1], NBS_INDEX).toString();
    if (new URL(url).origin !== NBS_ORIGIN) fail(`Price publication is not hosted by stats.gov.cn: ${url}`);
    candidates.push({ title, url, sourceDate: dateMatch[1], coverage: coverageFromTitle(title, id) });
  }
  if (candidates.length === 0) fail(`No official NBS publication matching ${id}`);
  return candidates.sort((left, right) => right.sourceDate.localeCompare(left.sourceDate))[0];
}

export async function fetchNbsPricePublication(
  publication: NbsPricePublication,
  id: PriceDatasetId,
  fetcher: TextFetcher = fetchText,
): Promise<RawNbsPriceSeries> {
  return parseNbsPricePublication(publication, await fetcher(publication.url), id);
}

export async function fetchNbsPriceIndex(fetcher: TextFetcher = fetchText): Promise<string> {
  const pages = [];
  for (let page = 0; page < NBS_INDEX_MAX_PAGES; page += 1) {
    pages.push(await fetcher(indexPageUrl(page)));
    const combined = pages.join('\n');
    if (hasPublication(combined, 'cpi') && hasPublication(combined, 'ppi')) return combined;
  }
  return pages.join('\n');
}

export const nbsPricePublicationIndex = NBS_INDEX;
