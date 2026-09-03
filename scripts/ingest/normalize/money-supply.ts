import { IngestionContractError, MethodologyMismatchError } from '../types.ts';
import { MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS } from '../types.ts';
import type { IndicatorDataset, IndicatorSource, MoneySupplyDatasetId, RawMoneySupplyPublication } from '../types.ts';
import { mergeObservations } from '../validate/overlap.ts';
import { nextMonth, pruneSources, validateMonthlyObservations } from '../validate/dataset.ts';
import { validateMoneySupplyDataset } from '../validate/money-supply.ts';

function validateReports(rawReports: RawMoneySupplyPublication[], id: MoneySupplyDatasetId): void {
  if (!Array.isArray(rawReports) || rawReports.length === 0) {
    throw new IngestionContractError('Fetched PBOC reports contain no observations');
  }
  const observations = rawReports.map((report) => {
    const value = report.values[id];
    if (!Number.isFinite(value)) throw new IngestionContractError(`Missing finite ${id} value for ${report.publication.month}`);
    if (report.methodologyFingerprints[id] !== MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS[id]) {
      throw new MethodologyMismatchError(`PBOC report methodology fingerprint mismatch for ${report.publication.month}`);
    }
    return { date: report.publication.month, value };
  });
  validateMonthlyObservations(observations, `Fetched PBOC ${id}`);
}

export function normalizeMoneySupplyDataset(
  rawReports: RawMoneySupplyPublication[],
  existing: IndicatorDataset,
  id: MoneySupplyDatasetId,
): IndicatorDataset {
  validateMoneySupplyDataset(existing, id);
  validateReports(rawReports, id);
  const existingLatestMonth = existing.data.at(-1)?.date;
  if (!existingLatestMonth) throw new IngestionContractError(`Existing ${id} dataset contains no observations`);
  for (const report of rawReports) {
    if (report.publication.month > existingLatestMonth && report.publication.sourceDate < existing.updatedAt) {
      throw new IngestionContractError(`Fetched PBOC publication is older than existing updatedAt: ${report.publication.sourceDate} < ${existing.updatedAt}`);
    }
  }

  const incoming = rawReports.map((report) => ({ date: report.publication.month, value: report.values[id] }));
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
  const latestReport = rawReports.at(-1);
  if (!latestReport) throw new IngestionContractError('Fetched PBOC reports contain no latest report');
  const normalized: IndicatorDataset = {
    ...existing,
    updatedAt: latestReport.publication.sourceDate,
    methodologyFingerprint: MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS[id],
    sources: pruneSources(candidates, data.map((observation) => observation.date)),
    data,
  };
  validateMoneySupplyDataset(normalized, id);
  return normalized;
}

export function validateReportRange(rawReports: RawMoneySupplyPublication[]): void {
  for (let index = 1; index < rawReports.length; index += 1) {
    if (nextMonth(rawReports[index - 1].publication.month) !== rawReports[index].publication.month) {
      throw new IngestionContractError(`PBOC report months are not contiguous: ${rawReports[index - 1].publication.month} -> ${rawReports[index].publication.month}`);
    }
  }
}
