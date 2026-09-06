import { IngestionContractError, MethodologyMismatchError, MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS } from '../types.ts';
import type { MoneySupplyPublication, PBOCFinancialPublication, RawMoneySupplyPublication } from '../types.ts';

const PBOC_INDEX = 'https://www.pbc.gov.cn/diaochatongjisi/116219/116225/index.html';
const PBOC_ORIGIN = 'https://www.pbc.gov.cn';
const REPORT_TITLE_PATTERN = /^\d{4}年(?:\d{1,2}月|一季度|上半年|前三季度)?金融统计数据报告$/;
const SOCIAL_FINANCING_TITLE_PATTERN = /^\d{4}年\d{1,2}月社会融资规模存量统计数据报告$/;
const M1_REVISION_NOTE = '修订后的M1包括：流通中货币(M0)、单位活期存款、个人活期存款、非银行支付机构客户备付金';

export function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalText(html: string): string {
  return textOf(html).replace(/（/g, '(').replace(/）/g, ')').replace(/\s+/g, '');
}

export function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function monthOfTitle(title: string): string {
  const monthlyMatch = title.match(/^(\d{4})年(\d{1,2})月金融统计数据报告$/);
  if (monthlyMatch) {
    const month = Number(monthlyMatch[2]);
    if (month < 1 || month > 12) throw new IngestionContractError(`Invalid PBOC report month: ${title}`);
    return `${monthlyMatch[1]}-${String(month).padStart(2, '0')}`;
  }
  const periodMatch = title.match(/^(\d{4})年(一季度|上半年|前三季度)?金融统计数据报告$/);
  const periodMonths = { 一季度: '03', 上半年: '06', 前三季度: '09', undefined: '12' } as const;
  if (!periodMatch) throw new IngestionContractError(`Invalid PBOC financial-statistics report title: ${title}`);
  const period = periodMatch[2] as keyof typeof periodMonths | undefined;
  return `${periodMatch[1]}-${periodMonths[period ?? 'undefined']}`;
}

function monthOfSocialFinancingTitle(title: string): string {
  const match = title.match(/^(\d{4})年(\d{1,2})月社会融资规模存量统计数据报告$/);
  if (!match) throw new IngestionContractError(`Invalid PBOC social-financing report title: ${title}`);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new IngestionContractError(`Invalid PBOC social-financing report month: ${title}`);
  return `${match[1]}-${String(month).padStart(2, '0')}`;
}

function classifyPublication(title: string): PBOCFinancialPublication['kind'] | null {
  if (REPORT_TITLE_PATTERN.test(title)) return 'money-supply';
  if (SOCIAL_FINANCING_TITLE_PATTERN.test(title)) return 'social-financing';
  return null;
}

export function discoverPBOCFinancialStatisticsPublications(indexHtml: string): PBOCFinancialPublication[] {
  const candidates: PBOCFinancialPublication[] = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of indexHtml.matchAll(anchorPattern)) {
    const title = textOf(match[2]);
    const kind = classifyPublication(title);
    if (!kind) continue;
    const afterAnchor = indexHtml.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 300);
    const dateMatch = afterAnchor.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (!dateMatch || !validIsoDate(dateMatch[1])) {
      throw new IngestionContractError(`PBOC publication date missing or invalid for: ${title}`);
    }
    const url = new URL(match[1], PBOC_INDEX).toString();
    if (new URL(url).origin !== PBOC_ORIGIN) {
      throw new IngestionContractError(`PBOC publication is not hosted by the official PBOC origin: ${url}`);
    }
    candidates.push({
      title,
      url,
      sourceDate: dateMatch[1],
      month: kind === 'money-supply' ? monthOfTitle(title) : monthOfSocialFinancingTitle(title),
      kind,
    });
  }
  if (candidates.length === 0) throw new IngestionContractError('No monthly or social-financing PBOC financial-statistics reports found');
  candidates.sort((left, right) => left.month.localeCompare(right.month) || left.kind.localeCompare(right.kind));
  for (let index = 1; index < candidates.length; index += 1) {
    if (candidates[index - 1].kind === candidates[index].kind && candidates[index - 1].month === candidates[index].month) {
      throw new IngestionContractError(`Duplicate PBOC ${candidates[index].kind} report month: ${candidates[index].month}`);
    }
  }
  return candidates;
}

export function discoverPBOCMoneySupplyPublications(indexHtml: string): MoneySupplyPublication[] {
  const publications = discoverPBOCFinancialStatisticsPublications(indexHtml)
    .filter(({ kind }) => kind === 'money-supply')
    .map(({ kind: _kind, ...publication }) => publication);
  if (publications.length === 0) throw new IngestionContractError('No monthly PBOC financial-statistics reports found');
  return publications;
}

export function discoverPBOCSocialFinancingPublications(indexHtml: string): MoneySupplyPublication[] {
  return discoverPBOCFinancialStatisticsPublications(indexHtml)
    .filter(({ kind }) => kind === 'social-financing')
    .map(({ kind: _kind, ...publication }) => publication);
}

export function validatePBOCReportPage(publication: MoneySupplyPublication, html: string): string {
  const titleCandidates = [
    ...[...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)].map((match) => textOf(match[1])),
    ...[...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map((match) => textOf(match[1])),
    ...[...html.matchAll(/<meta\b[^>]*name=["']ArticleTitle["'][^>]*content=["']([^"']*)["'][^>]*>/gi)].map((match) => textOf(match[1])),
  ];
  const pageTitle = titleCandidates.find((candidate) => candidate === publication.title) ?? '';
  if (pageTitle !== publication.title) throw new IngestionContractError(`PBOC report title mismatch: ${pageTitle} != ${publication.title}`);
  const canonical = canonicalText(html);
  if (!canonical.includes(publication.sourceDate)) {
    throw new IngestionContractError(`PBOC report publication date missing: ${publication.sourceDate}`);
  }
  const pageMonth = pageTitle.includes('社会融资规模存量') ? monthOfSocialFinancingTitle(pageTitle) : monthOfTitle(pageTitle);
  if (pageMonth !== publication.month) throw new IngestionContractError(`PBOC report month mismatch: ${pageMonth} != ${publication.month}`);
  return canonical;
}

export function parseGrowth(text: string, label: string): number {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escapedLabel}余额[^。；]*?同比(增长|下降)([^%。；]+)%`, 'g');
  const matches = [...text.matchAll(pattern)];
  if (matches.length === 0) throw new IngestionContractError(`Missing ${label} YoY growth value`);
  if (matches.length > 1) throw new IngestionContractError(`Duplicate ${label} YoY growth value`);
  const numericText = matches[0][2].trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(numericText)) throw new IngestionContractError(`Invalid numeric ${label} YoY value: ${numericText}`);
  const value = Number(numericText);
  return matches[0][1] === '下降' ? -Math.abs(value) : Math.abs(value);
}

export function parsePBOCMoneySupplyReport(
  publication: MoneySupplyPublication,
  html: string,
): RawMoneySupplyPublication {
  const canonical = validatePBOCReportPage(publication, html);
  for (const label of ['广义货币(M2)', '狭义货币(M1)', '流通中货币(M0)']) {
    if (!canonical.includes(label)) throw new IngestionContractError(`Missing required PBOC series: ${label}`);
  }
  if (!canonical.includes(M1_REVISION_NOTE)) {
    throw new MethodologyMismatchError('PBOC M1 methodology note is missing or changed');
  }
  return {
    publication,
    values: {
      m0: parseGrowth(canonical, '流通中货币(M0)'),
      m1: parseGrowth(canonical, '狭义货币(M1)'),
      m2: parseGrowth(canonical, '广义货币(M2)'),
    },
    methodologyFingerprints: MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS,
  };
}
