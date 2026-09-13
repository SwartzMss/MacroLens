import { IngestionContractError, MethodologyMismatchError, PBOC_FINANCIAL_METHODOLOGY_FINGERPRINTS } from '../types.ts';
import type { MoneySupplyPublication, PBOCFinancialDatasetId, RawPBOCFinancialPublication } from '../types.ts';
import {
  discoverPBOCFinancialStatisticsPublications,
  validatePBOCReportPage,
} from './pboc-money-supply.ts';

export { discoverPBOCFinancialStatisticsPublications } from './pboc-money-supply.ts';

const CREDIT_MARKERS = ['金融机构人民币各项贷款余额', '月末人民币贷款余额'] as const;
const SOCIAL_FINANCING_MARKER = '社会融资规模存量';

function validatedFingerprint(id: 'credit', canonical: string): typeof PBOC_FINANCIAL_METHODOLOGY_FINGERPRINTS.credit;
function validatedFingerprint(id: 'social-financing', canonical: string): typeof PBOC_FINANCIAL_METHODOLOGY_FINGERPRINTS['social-financing'];
function validatedFingerprint(id: PBOCFinancialDatasetId, canonical: string): string {
  const anchors = id === 'credit'
    ? ['同比']
    : [`${SOCIAL_FINANCING_MARKER}为`, '同比'];
  if (!anchors.every((anchor) => canonical.includes(anchor))) {
    throw new MethodologyMismatchError(`PBOC ${id} methodology or scope anchors are missing or changed`);
  }
  if (id === 'credit' && !CREDIT_MARKERS.some((marker) => canonical.includes(marker))) {
    throw new MethodologyMismatchError(`PBOC ${id} methodology or scope anchors are missing or changed`);
  }
  return PBOC_FINANCIAL_METHODOLOGY_FINGERPRINTS[id];
}

export function discoverPBOCCreditPublications(indexHtml: string): MoneySupplyPublication[] {
  return discoverPBOCFinancialStatisticsPublications(indexHtml)
    .filter(({ kind }) => kind === 'money-supply')
    .map(({ kind: _kind, ...publication }) => publication);
}

export function discoverPBOCSocialFinancingPublications(indexHtml: string): MoneySupplyPublication[] {
  return discoverPBOCFinancialStatisticsPublications(indexHtml)
    .filter(({ kind }) => kind === 'social-financing')
    .map(({ kind: _kind, ...publication }) => publication);
}

function parseSignedGrowth(text: string, labels: readonly string[], suffixPattern: string): number {
  const matches = labels.flatMap((label) => {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [...text.matchAll(new RegExp(`${escapedLabel}${suffixPattern}[^。；]*?同比(增长|下降)([^%。；]+)%`, 'g'))];
  });
  const label = labels.join('/');
  if (matches.length === 0) throw new IngestionContractError(`Missing ${label} YoY growth value`);
  if (matches.length > 1) throw new IngestionContractError(`Duplicate ${label} YoY growth value`);
  const numericText = matches[0][2].trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(numericText)) throw new IngestionContractError(`Invalid numeric ${label} YoY value: ${numericText}`);
  const value = Number(numericText);
  return matches[0][1] === '下降' ? -Math.abs(value) : Math.abs(value);
}

export function parsePBOCCreditReport(
  publication: MoneySupplyPublication,
  html: string,
): RawPBOCFinancialPublication {
  const canonical = validatePBOCReportPage(publication, html);
  if (!publication.title.endsWith('金融统计数据报告')) {
    throw new IngestionContractError(`Credit must use a PBOC financial-statistics report: ${publication.title}`);
  }
  if (!CREDIT_MARKERS.some((marker) => canonical.includes(marker))) {
    throw new MethodologyMismatchError('PBOC credit scope marker is missing or changed');
  }
  if (!CREDIT_MARKERS.some((marker) => new RegExp(`${marker}(?:为|是|(?=\\d))`).test(canonical))) {
    throw new MethodologyMismatchError('PBOC credit scope marker is missing or changed');
  }
  const methodologyFingerprint = validatedFingerprint('credit', canonical);
  const balances = CREDIT_MARKERS.flatMap(marker => [...canonical.matchAll(
    new RegExp(`${marker}(?:为|是)?([0-9]+(?:\\.[0-9]+)?)(万亿元|亿元)`, 'g'),
  )]);
  if (balances.length !== 1) throw new IngestionContractError('Missing or duplicate credit balance amount');
  const creditBalance = Number(balances[0][1]) / (balances[0][2] === '亿元' ? 10000 : 1);
  if (!Number.isFinite(creditBalance) || creditBalance <= 0) throw new IngestionContractError('Invalid credit balance amount');
  return {
    publication,
    creditBalance,
    values: { credit: parseSignedGrowth(canonical, CREDIT_MARKERS, '') },
    methodologyFingerprints: { ...PBOC_FINANCIAL_METHODOLOGY_FINGERPRINTS, credit: methodologyFingerprint },
  };
}

export function parsePBOCSocialFinancingReport(
  publication: MoneySupplyPublication,
  html: string,
): RawPBOCFinancialPublication {
  const canonical = validatePBOCReportPage(publication, html);
  if (!publication.title.endsWith('社会融资规模存量统计数据报告') && !publication.title.endsWith('金融统计数据报告')) {
    throw new IngestionContractError(`Social-financing must use a PBOC financial-statistics or stock report: ${publication.title}`);
  }
  if (!canonical.includes(SOCIAL_FINANCING_MARKER)) {
    throw new MethodologyMismatchError('PBOC social-financing stock marker is missing or changed');
  }
  if (!new RegExp(`${SOCIAL_FINANCING_MARKER}(?:为|是)`).test(canonical)) {
    throw new MethodologyMismatchError('PBOC social-financing stock marker is missing or changed');
  }
  const methodologyFingerprint = validatedFingerprint('social-financing', canonical);
  const stocks = [...canonical.matchAll(/社会融资规模存量(?:为|是)([0-9]+(?:\.[0-9]+)?)(万亿元|亿元)/g)];
  if (stocks.length !== 1) throw new IngestionContractError('Missing or duplicate social-financing stock amount');
  const socialFinancingStock = Number(stocks[0][1]) / (stocks[0][2] === '亿元' ? 10000 : 1);
  if (!Number.isFinite(socialFinancingStock) || socialFinancingStock <= 0) throw new IngestionContractError('Invalid social-financing stock amount');
  return {
    publication,
    socialFinancingStock,
    values: { 'social-financing': parseSignedGrowth(canonical, [SOCIAL_FINANCING_MARKER], '(?:为|是)[^同比]*?') },
    methodologyFingerprints: { ...PBOC_FINANCIAL_METHODOLOGY_FINGERPRINTS, 'social-financing': methodologyFingerprint },
  };
}
