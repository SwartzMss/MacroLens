import { IngestionContractError } from '../types.ts';
import type { LprPublication, RawLprPublication } from '../types.ts';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_PATTERN = /^\d+(?:\.\d+)?$/;
const LPR_TITLE_PATTERN = /贷款市场报价利率（LPR）/;

function canonicalText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseValue(value: string, label: string, date: string): number {
  if (!NUMBER_PATTERN.test(value)) throw new IngestionContractError(`Invalid ${label} LPR value for ${date}: ${value}`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 20) throw new IngestionContractError(`Invalid ${label} LPR value for ${date}: ${value}`);
  return parsed;
}

function parsePublicationDate(title: string): { sourceDate: string; month: string } {
  const match = title.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!match) throw new IngestionContractError(`LPR announcement title has no publication date: ${title}`);
  const sourceDate = `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
  if (!DATE_PATTERN.test(sourceDate) || Number.isNaN(new Date(`${sourceDate}T00:00:00Z`).valueOf())) throw new IngestionContractError(`Invalid LPR announcement date: ${sourceDate}`);
  return { sourceDate, month: sourceDate.slice(0, 7) };
}

export function discoverLprArchivePageLinks(indexHtml: string, baseUrl: string): string[] {
  const links = [...indexHtml.matchAll(/tagname="([^"]*de24575c-\d+\.html)"/g)].map(([, href]) => new URL(href, baseUrl).href);
  return [...new Set(links)].sort();
}

export function discoverLprPublications(indexHtml: string | string[], baseUrl = 'https://www.pbc.gov.cn'): LprPublication[] {
  const html = Array.isArray(indexHtml) ? indexHtml.join('\n') : indexHtml;
  const publications: LprPublication[] = [];
  const seenMonths = new Set<string>();
  const pattern = /<a[^>]+href="([^"]+)"[^>]+title="([^"]*贷款市场报价利率（LPR）[^"]*公告)"[^>]*>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    if (match[2].includes('报价行名单')) continue;
    const { sourceDate, month } = parsePublicationDate(match[2]);
    if (seenMonths.has(month)) throw new IngestionContractError(`Duplicate LPR announcement month: ${month}`);
    seenMonths.add(month);
    publications.push({ title: match[2], url: new URL(match[1], baseUrl).href, sourceDate, month });
  }
  if (publications.length === 0) throw new IngestionContractError('PBOC LPR archive contains no announcements');
  return publications.sort((left, right) => left.month.localeCompare(right.month));
}

export function parseLprAnnouncement(publication: LprPublication, html: string): RawLprPublication {
  if (!LPR_TITLE_PATTERN.test(publication.title) || !publication.title.includes('公告')) throw new IngestionContractError(`Unexpected LPR announcement title: ${publication.title}`);
  const parsedDate = parsePublicationDate(publication.title);
  if (parsedDate.sourceDate !== publication.sourceDate || parsedDate.month !== publication.month) throw new IngestionContractError(`LPR announcement date/month mismatch: ${publication.sourceDate} -> ${publication.month}`);
  const text = canonicalText(html);
  if (!text.includes(publication.title) && !text.includes('贷款市场报价利率（LPR）')) throw new IngestionContractError(`LPR announcement identity is missing from ${publication.url}`);
  const oneYearMatches = [...text.matchAll(/1年期LPR为\s*([^%。，；;]+)%/g)];
  const fiveYearMatches = [...text.matchAll(/5年期以上LPR为\s*([^%。，；;]+)%/g)];
  if (oneYearMatches.length === 0) throw new IngestionContractError(`Missing 1Y LPR value for ${publication.month}`);
  if (fiveYearMatches.length === 0) throw new IngestionContractError(`Missing 5Y+ LPR value for ${publication.month}`);
  if (oneYearMatches.length > 1) throw new IngestionContractError(`Duplicate 1Y LPR value for ${publication.month}`);
  if (fiveYearMatches.length > 1) throw new IngestionContractError(`Duplicate 5Y+ LPR value for ${publication.month}`);
  return {
    publication,
    values: {
      '1y': parseValue(oneYearMatches[0][1].trim(), '1Y', publication.sourceDate),
      '5y-plus': parseValue(fiveYearMatches[0][1].trim(), '5Y+', publication.sourceDate),
    },
  };
}
