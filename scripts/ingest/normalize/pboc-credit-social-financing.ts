import { IngestionContractError, MethodologyMismatchError, PBOC_FINANCIAL_METHODOLOGY_FINGERPRINTS } from '../types.ts';
import type { IndicatorDataset, IndicatorSource, PBOCFinancialDatasetId, RawPBOCFinancialPublication } from '../types.ts';
import { mergeObservations } from '../validate/overlap.ts';
import { nextMonth, pruneSources, validateMonthlyObservations } from '../validate/dataset.ts';
import { validatePBOCFinancialDataset } from '../validate/pboc-credit-social-financing.ts';

function prunePBOCFinancialSources(sources: IndicatorSource[], dates: string[]): IndicatorSource[] {
  const methodologySources = sources.filter((source) => source.role === 'methodology');
  const dataSources = sources.filter((source) => source.role !== 'methodology');
  return [...pruneSources(dataSources, dates), ...methodologySources]
    .sort((left, right) => left.sourceDate.localeCompare(right.sourceDate) || Number(left.role === 'methodology') - Number(right.role === 'methodology'));
}

function validateReports(rawReports: RawPBOCFinancialPublication[], id: PBOCFinancialDatasetId): void {
  if (!Array.isArray(rawReports) || rawReports.length === 0) throw new IngestionContractError('Fetched PBOC financial reports contain no observations');
  const observations = rawReports.map((report) => {
    const value = report.values[id];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new IngestionContractError(`Missing finite ${id} value for ${report.publication.month}`);
    if (report.methodologyFingerprints[id] !== PBOC_FINANCIAL_METHODOLOGY_FINGERPRINTS[id]) {
      throw new MethodologyMismatchError(`PBOC financial methodology fingerprint mismatch for ${report.publication.month}`);
    }
    return { date: report.publication.month, value };
  });
  validateMonthlyObservations(observations, `Fetched PBOC ${id}`);
}

export function normalizePBOCFinancialDataset(
  rawReports: RawPBOCFinancialPublication[],
  existing: IndicatorDataset,
  id: PBOCFinancialDatasetId,
): IndicatorDataset {
  validatePBOCFinancialDataset(existing, id);
  validateReports(rawReports, id);
  const existingLatestMonth = existing.data.at(-1)?.date;
  if (!existingLatestMonth) throw new IngestionContractError(`Existing ${id} dataset contains no observations`);
  for (const report of rawReports) {
    const sourceAlreadyCoversReport = existing.sources.some((source) => source.coverage.split(' to ')[1] >= report.publication.month);
    if (report.publication.month > existingLatestMonth && report.publication.sourceDate < existing.updatedAt && !sourceAlreadyCoversReport) {
      throw new IngestionContractError(`Fetched PBOC publication is older than existing updatedAt: ${report.publication.sourceDate} < ${existing.updatedAt}`);
    }
  }
  const incoming = rawReports.map((report) => ({ date: report.publication.month, value: report.values[id]! }));
  const data = mergeObservations(existing.data, incoming, `PBOC ${id}`);
  const incomingSources: IndicatorSource[] = rawReports.map((report) => ({
    title: `中国人民银行：${report.publication.title}`,
    url: report.publication.url,
    sourceDate: report.publication.sourceDate,
    coverage: `${report.publication.month} to ${report.publication.month}`,
  }));
  const candidates = [
    ...existing.sources.filter((source) => !incomingSources.some((incomingSource) => incomingSource.url === source.url)),
    ...incomingSources,
  ];
  const sources = prunePBOCFinancialSources(candidates, data.map((observation) => observation.date));
  const latestSource = sources.at(-1);
  if (!latestSource) throw new IngestionContractError('PBOC financial dataset contains no latest source after normalization');
  const normalized: IndicatorDataset = {
    ...existing,
    updatedAt: latestSource.sourceDate,
    methodologyFingerprint: PBOC_FINANCIAL_METHODOLOGY_FINGERPRINTS[id],
    sources,
    data,
  };
  const balances = rawReports.map(report => {
    const value = id === 'credit' ? report.creditBalance : report.socialFinancingStock;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new IngestionContractError(`Missing positive ${id} balance for ${report.publication.month}`);
    }
    return { date: report.publication.month, value };
  });
  normalized.balance = {
    label: id === 'credit' ? '人民币贷款余额' : '社会融资规模存量', unit: '万亿元',
    data: mergeObservations(existing.balance?.data ?? [], balances, `PBOC ${id} balance`),
  };
  validatePBOCFinancialDataset(normalized, id);
  return normalized;
}

export function validatePBOCFinancialReportRange(rawReports: RawPBOCFinancialPublication[]): void {
  for (let index = 1; index < rawReports.length; index += 1) {
    if (nextMonth(rawReports[index - 1].publication.month) !== rawReports[index].publication.month) {
      throw new IngestionContractError(`PBOC financial report months are not contiguous: ${rawReports[index - 1].publication.month} -> ${rawReports[index].publication.month}`);
    }
  }
}
