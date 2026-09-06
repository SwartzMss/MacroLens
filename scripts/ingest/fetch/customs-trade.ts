import { IngestionContractError, CUSTOMS_TRADE_METHODOLOGY_FINGERPRINT } from '../types.ts';
import type {
  CustomsTradePublication,
  IndicatorSource,
  RawCustomsTradePublication,
} from '../types.ts';
import { fetchText } from '../fetch-text.ts';
import type { FetchTextOptions } from '../fetch-text.ts';

export const CUSTOMS_TRADE_INDEX = 'https://english.customs.gov.cn/statics/report/monthly.html';
const CUSTOMS_ORIGIN_SUFFIX = '.customs.gov.cn';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COVERAGE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])\s+to\s+(\d{4})-(0[1-9]|1[0-2])$/;
const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
type TextFetcher = (url: string, options?: FetchTextOptions) => Promise<string>;

function fail(message: string): never {
  throw new IngestionContractError(message);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function validDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function officialCustomsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && (url.hostname === 'customs.gov.cn' || url.hostname.endsWith(CUSTOMS_ORIGIN_SUFFIX));
  } catch {
    return false;
  }
}

function sourceMonth(coverage: string): string {
  const match = coverage.match(COVERAGE_PATTERN);
  if (!match || `${match[1]}-${match[2]}` !== `${match[3]}-${match[4]}`) {
    fail(`Customs publication must cover one exact month: ${coverage}`);
  }
  return `${match[1]}-${match[2]}`;
}

function coverageFromTitle(title: string): string {
  const english = title.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/i);
  if (english) {
    const month = MONTH_NAMES.indexOf(english[1].slice(0, 3).toLowerCase()) + 1;
    return `${english[2]}-${String(month).padStart(2, '0')} to ${english[2]}-${String(month).padStart(2, '0')}`;
  }
  const chinese = title.match(/(\d{4})年\s*(\d{1,2})月/);
  if (chinese) {
    const month = Number(chinese[2]);
    if (month >= 1 && month <= 12) {
      const padded = String(month).padStart(2, '0');
      return `${chinese[1]}-${padded} to ${chinese[1]}-${padded}`;
    }
  }
  fail(`Cannot derive exact monthly coverage from Customs publication title: ${title}`);
}

function tableCells(fragment: string): string[] {
  return [...fragment.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((match) => textOf(match[1]));
}

function tableRows(fragment: string): string[][] {
  return [...fragment.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => tableCells(match[1]))
    .filter((cells) => cells.length > 0);
}

function normaliseCell(value: string): string {
  return value.replace(/[\s\u00a0]/g, '').replace(/[：:]/g, '').toLowerCase();
}

function isExportLabel(value: string): boolean {
  const normalised = normaliseCell(value);
  return ['totalexport', 'export', 'exports', '出口', '出口总值', '出口总额'].includes(normalised);
}

function isImportLabel(value: string): boolean {
  const normalised = normaliseCell(value);
  return ['totalimport', 'import', 'imports', '进口', '进口总值', '进口总额'].includes(normalised);
}

function isNumberCell(value: string): boolean {
  return /^[-+]?\d[\d,]*(?:\.\d+)?%?$/.test(value.trim());
}

function parseNumber(value: string, label: string): number {
  const numeric = value.trim().replace(/,/g, '').replace(/%$/, '');
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(numeric)) fail(`Invalid published Customs ${label} YoY value: ${value}`);
  const result = Number(numeric);
  if (!Number.isFinite(result) || Math.abs(result) > 1000) fail(`Invalid published Customs ${label} YoY value: ${value}`);
  return result;
}

function isMonthlyYoyHeader(value: string): boolean {
  const normalised = normaliseCell(value);
  const monthly = /(?:monthonmonth|月与上月|当月与上年|月与去年同期|当月同比|本月同比|月同比|month.*year)/i.test(normalised);
  const cumulative = /(?:1to|1至|累计|year.?to.?date|ytd)/i.test(normalised);
  return /(?:year.?on.?year|同比)/i.test(normalised) && !cumulative && monthly;
}

function isCumulativeYoyHeader(value: string): boolean {
  const normalised = normaliseCell(value);
  return /(?:累计|1(?:-|–|—)?(?:to|至)?(?:-|–|—)?\d|year.?to.?date|ytd)/i.test(normalised) && /(?:year.?on.?year|同比)/i.test(normalised);
}

function hasMonthlyColumn(table: string[][]): boolean {
  return table.some((row) => row.some((cell) => isMonthlyYoyHeader(cell)))
    || table.some((row) => row.some((cell) => /month.?on.?month|月与上月/i.test(normaliseCell(cell))));
}

function hasCumulativeColumn(table: string[][]): boolean {
  return table.some((row) => row.some((cell) => isCumulativeYoyHeader(cell)))
    || table.some((row) => row.some((cell) => /1(?:-|–|—)?(?:to|至)?(?:-|–|—)?\d|累计|year.?to.?date|ytd/i.test(normaliseCell(cell))));
}

function currentMonthFromHeader(table: string[][], fallback: string): string {
  for (const row of table) {
    for (const cell of row) {
      const chineseRange = cell.match(/^(\d{4})年\s*(\d{1,2})月(?:份)?\s*[-至—–]\s*\1年\s*(\d{1,2})月(?:份)?$/);
      if (chineseRange && chineseRange[2] === chineseRange[3]) {
        return `${chineseRange[1]}-${String(Number(chineseRange[2])).padStart(2, '0')}`;
      }
      const chinese = cell.match(/^(\d{1,2})月?$/);
      if (chinese) return `${fallback.slice(0, 4)}-${String(Number(chinese[1])).padStart(2, '0')}`;
      const chineseWithYear = cell.match(/^\d{4}年\s*(\d{1,2})月(?:份)?$/);
      if (chineseWithYear) return `${fallback.slice(0, 4)}-${String(Number(chineseWithYear[1])).padStart(2, '0')}`;
      const english = cell.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:uary|ruary|ch|il|e|y|ust|tember|ober|ember)?$/i);
      if (english) return `${fallback.slice(0, 4)}-${String(MONTH_NAMES.indexOf(english[1].slice(0, 3).toLowerCase()) + 1).padStart(2, '0')}`;
    }
  }
  return fallback;
}

function rowValue(table: string[][], labelMatcher: (value: string) => boolean, label: string): number {
  const matchingRows = table.filter((candidate) => candidate.some(labelMatcher));
  if (matchingRows.length === 0) fail(`Official Customs table is missing the national ${label} row`);
  if (matchingRows.length > 1) fail(`Official Customs table contains duplicate national ${label} rows`);
  const row = matchingRows[0];
  const labelIndex = row.findIndex(labelMatcher);
  const numeric = row.slice(labelIndex + 1).filter(isNumberCell);
  if (numeric.length < 3) fail(`Official Customs table does not contain a monthly ${label} YoY column`);

  const header = table.find((candidate) => candidate.some((cell) => isMonthlyYoyHeader(cell)));
  const headerIndex = header?.findIndex(isMonthlyYoyHeader) ?? -1;
  if (headerIndex >= 0 && headerIndex > labelIndex && isNumberCell(row[headerIndex])) {
    return parseNumber(row[headerIndex], label);
  }

  // The GACC total table has: current month, Jan-to-month cumulative,
  // month-on-month, monthly YoY, Jan-to-month cumulative YoY.
  if (numeric.length === 5 && hasCumulativeColumn(table)) return parseNumber(numeric[3], label);
  fail(`Official Customs table has no unambiguous monthly ${label} YoY value`);
}

function findTradeTable(html: string): string[][] {
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map((match) => tableRows(match[1]));
  const candidates = tables.filter((table) => table.some((row) => row.some((cell) => isExportLabel(cell)))
    && table.some((row) => row.some((cell) => isImportLabel(cell))));
  if (candidates.length === 0) fail('Official Customs publication is missing the national export/import total table');
  if (candidates.length > 1) fail('Official Customs publication contains ambiguous national export/import total tables');
  const candidate = candidates[0];
  if (!hasMonthlyColumn(candidate) || !hasCumulativeColumn(candidate)) {
    fail('Official Customs publication must expose both a monthly YoY and a cumulative YoY column');
  }
  return candidate;
}

function validatePublicationIdentity(publication: CustomsTradePublication, visible: string): string {
  if (!officialCustomsUrl(publication.url)) fail(`Customs publication is not hosted by customs.gov.cn: ${publication.url}`);
  if (!validDate(publication.sourceDate)) fail(`Invalid Customs publication date: ${publication.sourceDate}`);
  if (!/海关总署|general administration of customs|\bgacc\b/i.test(visible)) {
    fail(`Customs publication is missing its GACC identity: ${publication.url}`);
  }
  if (!/人民币|\bCNY\b|yuan/i.test(visible) || /美元|\bUSD\b|dollar/i.test(visible)) {
    fail(`Customs publication must be the RMB table, not a USD table: ${publication.url}`);
  }
  if (/服务贸易|balance.?of.?payments|\bservices?\s+trade\b/i.test(visible)) {
    fail(`Customs publication must describe goods trade, not services or BOP: ${publication.url}`);
  }
  const titleCoverage = coverageFromTitle(publication.title);
  const coverage = publication.coverage || titleCoverage;
  if (sourceMonth(coverage) !== sourceMonth(titleCoverage)) {
    fail(`Customs publication coverage disagrees with its title: ${publication.title}`);
  }
  return coverage;
}

export function parseCustomsTradePublication(
  publication: CustomsTradePublication,
  html: string,
): RawCustomsTradePublication {
  const visible = textOf(html);
  const coverage = validatePublicationIdentity(publication, visible);
  const table = findTradeTable(html);
  const month = sourceMonth(coverage);
  if (currentMonthFromHeader(table, month) !== month) {
    fail(`Customs table month does not match publication coverage: ${month}`);
  }
  const values = {
    exports: rowValue(table, isExportLabel, 'export'),
    imports: rowValue(table, isImportLabel, 'import'),
  } as const;
  const source: IndicatorSource = {
    title: `海关总署：${publication.title}`,
    url: publication.url,
    sourceDate: publication.sourceDate,
    coverage,
    role: 'data',
  };
  return {
    publication: { ...publication, coverage },
    values,
    methodologyFingerprint: CUSTOMS_TRADE_METHODOLOGY_FINGERPRINT,
    dataSources: [source],
    observations: {
      exports: { date: month, value: values.exports },
      imports: { date: month, value: values.imports },
    },
  };
}

export function discoverCustomsTradePublications(indexHtml: string): CustomsTradePublication[] {
  const candidates: CustomsTradePublication[] = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of indexHtml.matchAll(anchorPattern)) {
    const title = textOf(match[2]);
    if (!/全国进出口总值表|total\s+export\s*(?:&|and)\s*import\s+values/i.test(title)) continue;
    if (/\bby\s+(?:country|region|trade\s+mode)|(?:按|分)(?:国别|地区|贸易方式)/i.test(title)) continue;
    if (!/人民币|\b(?:CNY|RMB)\b/i.test(title)) continue;
    const anchorEnd = (match.index ?? 0) + match[0].length;
    const afterAnchor = indexHtml.slice(anchorEnd, anchorEnd + 500).split(/<a\b/i, 1)[0];
    const dateMatch = afterAnchor.match(/\b(\d{4})[-\/](\d{2})[-\/](\d{2})\b/);
    const sourceDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '';
    if (!sourceDate || !validDate(sourceDate)) fail(`Customs publication date missing or invalid: ${title}`);
    const url = new URL(match[1], CUSTOMS_TRADE_INDEX).toString();
    if (!officialCustomsUrl(url)) fail(`Customs publication is not hosted by customs.gov.cn: ${url}`);
    candidates.push({ title, url, sourceDate, coverage: coverageFromTitle(title) });
  }
  if (candidates.length === 0) fail('No official GACC monthly RMB total trade publication was found');
  const coverageUrls = new Map<string, string>();
  for (const candidate of candidates) {
    const existingUrl = coverageUrls.get(candidate.coverage);
    if (existingUrl && existingUrl !== candidate.url) {
      fail(`Multiple official GACC publications claim the same monthly coverage: ${candidate.coverage}`);
    }
    coverageUrls.set(candidate.coverage, candidate.url);
  }
  return candidates.sort((left, right) => left.coverage.localeCompare(right.coverage)
    || left.sourceDate.localeCompare(right.sourceDate)
    || left.url.localeCompare(right.url));
}

export function discoverLatestCustomsTradePublication(indexHtml: string): CustomsTradePublication {
  return discoverCustomsTradePublications(indexHtml).at(-1)!;
}

export async function fetchCustomsTradePublication(
  publication: CustomsTradePublication,
  fetcher: TextFetcher = fetchText,
): Promise<RawCustomsTradePublication> {
  return parseCustomsTradePublication(publication, await fetcher(publication.url));
}

export async function fetchCustomsTradeIndex(fetcher: TextFetcher = fetchText): Promise<string> {
  return fetcher(CUSTOMS_TRADE_INDEX);
}
