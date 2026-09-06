import { fetchText } from '../fetch-text.ts';
import { IngestionContractError } from '../types.ts';

export const PBOC_OMO_BASE = 'https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/';
export const POLICY_RATE_ARCHIVES = [`${PBOC_OMO_BASE}125469/index.html`, `${PBOC_OMO_BASE}125475/index.html`];
export type PolicyRatePublication = { title: string; url: string; sourceDate: string };
export type RawPolicyRate = {
  publication: PolicyRatePublication;
  date: string;
  value: number;
  kind: 'change' | 'operation';
  previousValue?: number;
};

function fail(message: string): never { throw new IngestionContractError(message); }
const compact = (text: string): string => text.normalize('NFKC').replace(/\s+/g, '');
const titlePattern = /^(?:中国人民银行)?公开市场业务(交易)?公告\[(\d{4})\]第(\d+)号$/;

export function validateOfficialPolicyRateUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'www.pbc.gov.cn' || url.port || url.username || url.password || url.search || url.hash
    || !url.pathname.startsWith('/zhengcehuobisi/125207/125213/125431/')) fail(`Not an official PBOC OMO URL: ${value}`);
  return url;
}

export async function fetchPolicyRateText(url: string): Promise<string> {
  validateOfficialPolicyRateUrl(url);
  return fetchText(url, { fetchImpl: async (input, init) => {
    // Reject redirects before following them, including redirects to other PBOC publications.
    return fetch(input, { ...init, redirect: 'error' });
  } });
}

export function validateDay(date: string): void {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) fail(`Invalid policy-rate date: ${date}`);
}

export function validatePublication(publication: PolicyRatePublication): void {
  const url = validateOfficialPolicyRateUrl(publication.url);
  validateDay(publication.sourceDate);
  const title = compact(publication.title).match(titlePattern);
  if (!title || title[2] !== publication.sourceDate.slice(0, 4)) fail(`Invalid PBOC publication title/year: ${publication.title}`);
  const section = title[1] ? '125475' : '125469';
  if (!new RegExp(`/${section}/\\d+/index\\.html$`).test(url.pathname)) fail(`PBOC publication URL/title mismatch: ${publication.url}`);
}

function textContent(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).trim();
}

function articleBody(html: string): string {
  const start = /<div\b[^>]*\bid=["']zoom["'][^>]*>/gi;
  const match = start.exec(html);
  if (!match || start.exec(html)) fail('Missing or duplicate PBOC article body');
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = match.index + match[0].length;
  let depth = 1;
  for (let tag; (tag = tags.exec(html));) {
    depth += /^<\//.test(tag[0]) ? -1 : 1;
    if (depth === 0) return html.slice(match.index + match[0].length, tag.index);
  }
  return fail('Malformed PBOC article body');
}

function verifiedBody(publication: PolicyRatePublication, html: string): string {
  validatePublication(publication);
  const titles = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)];
  const dates = [...html.matchAll(/<span\b[^>]*\bid=["']shijian["'][^>]*>([\s\S]*?)<\/span>/gi)];
  const identity = html.match(/<meta\s+name="Url"\s+content="([^"]+)"/i)?.[1];
  if (titles.length !== 1 || compact(textContent(titles[0][1])) !== compact(publication.title)
    || dates.length !== 1 || textContent(dates[0][1]).slice(0, 10) !== publication.sourceDate
    || identity !== new URL(publication.url).pathname) fail(`PBOC publication identity/date mismatch: ${publication.url}`);
  const body = articleBody(html);
  if (!compact(textContent(body)).includes('中国人民银行公开市场业务操作室')) fail(`Missing PBOC operation office signature: ${publication.url}`);
  return body;
}

export function discoverPolicyRatePublications(html: string, baseUrl: string): PolicyRatePublication[] {
  validateOfficialPolicyRateUrl(baseUrl);
  const publications: PolicyRatePublication[] = [];
  for (const match of html.matchAll(/<a\b([^>]+)>((?:(?!<\/?a\b)[\s\S])*)<\/a>/gi)) {
    const title = match[1].match(/\btitle="([^"]+)"/)?.[1];
    const href = match[1].match(/\bhref="([^"]+)"/)?.[1];
    if (!title || !title.includes('公开市场业务')) continue;
    const sourceDate = html.slice(match.index + match[0].length).match(/^\s*<\/font>\s*<span[^>]*>(\d{4}-\d{2}-\d{2})<\/span>/)?.[1];
    if (!href || !sourceDate || compact(textContent(match[2])) !== compact(title)) fail('Missing/malformed PBOC archive publication identity/date');
    const publication = { title, url: new URL(href, baseUrl).href, sourceDate };
    validatePublication(publication);
    publications.push(publication);
  }
  if (!publications.length) fail(`PBOC archive contains no publications: ${baseUrl}`);
  const seen = new Set<string>();
  for (let index = 0; index < publications.length; index++) {
    const item = publications[index];
    if (seen.has(item.url)) fail(`Duplicate PBOC publication: ${item.url}`);
    if (index && item.sourceDate > publications[index - 1].sourceDate) fail('PBOC archive is not chronologically ordered');
    seen.add(item.url);
  }
  return publications;
}

export function nextPolicyRateArchivePage(html: string, baseUrl: string): string | undefined {
  const href = html.match(/tagname="([^"]+)"[^>]*>下一页<\/a>/)?.[1];
  if (!href || href === '[NEXTPAGE]') return undefined;
  const url = validateOfficialPolicyRateUrl(new URL(href, baseUrl).href);
  if (!/\/\d+-\d+\.html$/.test(url.pathname) || new URL(baseUrl).pathname.split('/').at(-2) !== url.pathname.split('/').at(-2)) fail('Unexpected PBOC pagination URL');
  return url.href;
}

function rate(value: string): number {
  if (!/^\d+(?:\.\d+)?%$/.test(value)) fail(`Malformed 7-day rate: ${value}`);
  const number = Number(value.slice(0, -1));
  if (!Number.isFinite(number) || number <= 0 || number >= 20) fail(`Invalid 7-day rate: ${value}`);
  return number;
}

export class NonPolicyRatePublication extends IngestionContractError {}

export function parsePolicyRatePublication(publication: PolicyRatePublication, html: string): RawPolicyRate {
  const body = verifiedBody(publication, html);
  const text = compact(textContent(body));
  if (!publication.title.includes('交易')) {
    const changes = [...text.matchAll(/(?:从|自)?((?:\d{4}年)?\d{1,2}月\d{1,2}日|即日)起[，,]公开市场7天期逆回购操作利率由此前的([^%。，]+%)调整为([^%。，]+%)/g)];
    if (!changes.length) {
      // References to a policy rate as a spread basis are not policy-rate decisions.
      if (/7天期逆回购操作利率(?:由|调整|下调|上调)/.test(text)) fail(`Missing or malformed policy-rate change: ${publication.url}`);
      throw new NonPolicyRatePublication('Not a 7-day policy-rate change announcement');
    }
    if (changes.length !== 1) fail('Duplicate policy-rate changes in announcement');
    const [, effective, before, after] = changes[0];
    const match = effective.match(/^(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日$/);
    const date = effective === '即日' ? publication.sourceDate : `${match?.[1] ?? publication.sourceDate.slice(0, 4)}-${match?.[2].padStart(2, '0')}-${match?.[3].padStart(2, '0')}`;
    validateDay(date);
    if (date < publication.sourceDate) fail('Policy-rate effective date precedes publication');
    const value = rate(after), previousValue = rate(before);
    if (value === previousValue) fail('Policy-rate change announces identical rates');
    return { publication, date, value, previousValue, kind: 'change' };
  }

  if (!text.includes('逆回购操作情况')) {
    if (!text.includes('逆回购') && /发行.*央行票据/.test(text)) throw new NonPolicyRatePublication('Central-bank bills are not reverse repos');
    if (!text.includes('逆回购') && text.includes('现券买断招标情况')) throw new NonPolicyRatePublication('Outright bond purchases are not reverse repos');
    if (/\d{4}年\d{1,2}月\d{1,2}日逆回购操作量为零。/.test(text) && !body.includes('<table')) throw new NonPolicyRatePublication('Zero reverse-repo operation: no rate was published');
    return fail(`Missing reverse-repo table/instrument: ${publication.url}`);
  }
  const operationDates = [...new Set([...text.matchAll(/(\d{4})年(\d{1,2})月(\d{1,2})日/g)].map(([, y, m, d]) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`))];
  if (operationDates.length !== 1 || operationDates[0] !== publication.sourceDate) fail('PBOC operation date mismatch');
  let previousTableEnd = 0;
  const tables = [...body.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].filter(match => {
    const caption = compact(textContent(body.slice(previousTableEnd, match.index)));
    previousTableEnd = match.index + match[0].length;
    return /(?:^|[。:：])(?:7天期)?逆回购操作情况$/.test(caption);
  }).map(([, table]) =>
    [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(([, row]) =>
      [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(([, cell]) => compact(textContent(cell)))));
  const candidates: number[] = [];
  let otherTenor = false, zeroOperation = false;
  for (const rows of tables) {
    const header = rows[0] ?? [];
    if (!header.includes('期限')) continue;
    if (header.filter(x => x === '期限').length !== 1) fail('Duplicate tenor header');
    const tenorIndex = header.indexOf('期限');
    const rateColumns = header.flatMap((column, index) => ['操作利率', '中标利率'].includes(column) ? [index] : []);
    for (const row of rows.slice(1)) {
      if (row.length !== header.length) fail('Malformed reverse-repo table row');
      const tenor = row[tenorIndex];
      if (!['7天', '14天', '隔夜', '1天'].includes(tenor)) fail(`Unknown reverse-repo tenor: ${tenor}`);
      if (tenor !== '7天') { otherTenor = true; continue; }
      if (rateColumns.length === 0 && text.includes('7天期逆回购操作量为零')
        && header.join('|') === '期限|投标量|中标量' && row.join('|') === '7天|0亿元|0亿元') {
        if (zeroOperation) fail('Duplicate zero-operation row');
        zeroOperation = true;
        continue;
      }
      if (rateColumns.length !== 1) fail('Missing or duplicate 7-day rate column');
      candidates.push(rate(row[rateColumns[0]]));
    }
  }
  if (candidates.length > 1 || (zeroOperation && candidates.length)) fail('Duplicate 7-day rate rows');
  if (candidates.length === 1) return { publication, date: publication.sourceDate, value: candidates[0], kind: 'operation' };
  if (zeroOperation) throw new NonPolicyRatePublication('Zero 7-day operation: no rate was published');
  if (otherTenor && !/7天期逆回购/.test(text)) throw new NonPolicyRatePublication('Wrong tenor: no 7-day operation');
  return fail('Missing exact 7-day reverse-repo rate');
}
