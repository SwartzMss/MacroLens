import { IngestionContractError } from '../types.ts';
import type { Observation, PmiPublication, RawPmiPublication } from '../types.ts';

const NBS_ORIGIN = 'https://www.stats.gov.cn/';
const NBS_PUBLICATION_INDEX = 'https://www.stats.gov.cn/sj/zxfbhjd/';
const PUBLICATION_TITLE = '中国采购经理指数运行情况';
const TABLE_HEADING = '表1 中国制造业PMI及构成指数';

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

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function cellsOf(rowHtml: string): string[] {
  return [...rowHtml.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((match) => textOf(match[1]));
}

function monthFromCell(value: string): string | null {
  const match = value.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月$/);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new IngestionContractError(`Invalid month label: ${value}`);
  return `${match[1]}-${String(month).padStart(2, '0')}`;
}

function ensureContinuousMonths(observations: Observation[]): void {
  for (let index = 1; index < observations.length; index += 1) {
    const previous = observations[index - 1].date.split('-').map(Number);
    const current = observations[index].date.split('-').map(Number);
    const expectedMonth = previous[1] === 12 ? 1 : previous[1] + 1;
    const expectedYear = previous[1] === 12 ? previous[0] + 1 : previous[0];
    if (current[0] !== expectedYear || current[1] !== expectedMonth) {
      throw new IngestionContractError(`PMI months are not contiguous: ${observations[index - 1].date} -> ${observations[index].date}`);
    }
  }
}

export function discoverLatestPmiPublication(indexHtml: string): PmiPublication {
  const candidates: PmiPublication[] = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of indexHtml.matchAll(anchorPattern)) {
    const title = textOf(match[2]);
    if (!title.includes(PUBLICATION_TITLE) || title.includes('解读')) continue;
    const afterAnchor = indexHtml.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 400);
    const dateMatch = afterAnchor.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (!dateMatch || !validIsoDate(dateMatch[1])) {
      throw new IngestionContractError(`Publication date missing or invalid for: ${title}`);
    }
    const url = new URL(match[1], NBS_PUBLICATION_INDEX).toString();
    if (new URL(url).origin !== new URL(NBS_ORIGIN).origin) {
      throw new IngestionContractError(`PMI publication is not hosted by stats.gov.cn: ${url}`);
    }
    candidates.push({ title, url, sourceDate: dateMatch[1] });
  }

  if (candidates.length === 0) {
    throw new IngestionContractError(`No NBS publication matching ${PUBLICATION_TITLE}`);
  }
  return candidates.sort((left, right) => right.sourceDate.localeCompare(left.sourceDate))[0];
}

export function parsePmiPublication(publication: PmiPublication, html: string): RawPmiPublication {
  const canonicalHeading = TABLE_HEADING.replace(/\s+/g, '');
  const tableMatch = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].find((match) => {
    const beforeTable = textOf(html.slice(0, match.index ?? 0)).replace(/\s+/g, '');
    return beforeTable.includes(canonicalHeading);
  });
  if (!tableMatch) throw new IngestionContractError(`Missing required table heading: ${TABLE_HEADING}`);
  const tableHtml = tableMatch[0];
  const rows = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => cellsOf(match[1]));
  const header = rows.find((row) => row.includes('PMI'));
  if (!header) throw new IngestionContractError('Missing PMI column in the manufacturing PMI table');
  const pmiColumn = header.indexOf('PMI');
  if (pmiColumn < 1) throw new IngestionContractError('PMI column has no date column before it');

  const observations: Observation[] = [];
  for (const row of rows.slice(rows.indexOf(header) + 1)) {
    const date = row.map(monthFromCell).find((value): value is string => value !== null);
    if (!date) continue;
    const valueText = row[pmiColumn];
    if (valueText === undefined || valueText === '') throw new IngestionContractError(`Missing PMI value for ${date}`);
    const value = Number(valueText.replace(/,/g, ''));
    if (!Number.isFinite(value) || !/^\d+(?:\.\d+)?$/.test(valueText.replace(/,/g, ''))) {
      throw new IngestionContractError(`Invalid numeric PMI value for ${date}: ${valueText}`);
    }
    if (value < 0 || value > 100) throw new IngestionContractError(`PMI value outside [0, 100] for ${date}: ${value}`);
    if (observations.some((observation) => observation.date === date)) {
      throw new IngestionContractError(`Duplicate PMI month: ${date}`);
    }
    observations.push({ date, value });
  }

  if (observations.length === 0) throw new IngestionContractError('No monthly PMI observations found');
  observations.sort((left, right) => left.date.localeCompare(right.date));
  ensureContinuousMonths(observations);
  return { publication, observations };
}
