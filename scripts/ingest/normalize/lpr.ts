import { IngestionContractError, LPR_METHODOLOGY_FINGERPRINT } from '../types.ts';
import type { IndicatorDataset, IndicatorSource, RawLprPublication } from '../types.ts';
import { mergeObservations } from '../validate/overlap.ts';
import { validateLprDataset, validateLprPublications } from '../validate/lpr.ts';

export function normalizeLprDataset(rawPublications: RawLprPublication[], existing: IndicatorDataset): IndicatorDataset {
  validateLprDataset(existing);
  validateLprPublications(rawPublications);
  const incoming = {
    '1y': rawPublications.map(({ publication, values }) => ({ date: publication.month, value: values['1y'] })),
    '5y-plus': rawPublications.map(({ publication, values }) => ({ date: publication.month, value: values['5y-plus'] })),
  };
  const existingSeries = new Map((existing.series ?? [{ id: '1y', label: '1年期 LPR', data: existing.data }]).map((series) => [series.id, series.data]));
  const series = [
    { id: '1y', label: '1年期 LPR', data: mergeObservations(existingSeries.get('1y') ?? [], incoming['1y'], 'LPR 1Y') },
    { id: '5y-plus', label: '5年期以上 LPR', data: mergeObservations(existingSeries.get('5y-plus') ?? [], incoming['5y-plus'], 'LPR 5Y+') },
  ];
  const incomingSources: IndicatorSource[] = rawPublications.map(({ publication }) => ({
    title: `中国人民银行：${publication.title}`,
    url: publication.url,
    sourceDate: publication.sourceDate,
    coverage: `${publication.month} to ${publication.month}`,
  }));
  const sourceByKey = new Map<string, IndicatorSource>();
  for (const source of [...existing.sources, ...incomingSources]) sourceByKey.set(`${source.url}|${source.coverage}`, source);
  const sources = [...sourceByKey.values()].sort((left, right) => left.sourceDate.localeCompare(right.sourceDate) || left.coverage.localeCompare(right.coverage));
  const latest = sources.at(-1);
  if (!latest) throw new IngestionContractError('LPR dataset contains no source provenance');
  const normalized: IndicatorDataset = {
    ...existing,
    updatedAt: latest.sourceDate,
    methodologyFingerprint: LPR_METHODOLOGY_FINGERPRINT,
    sources,
    data: series[0].data,
    series,
  };
  validateLprDataset(normalized);
  return normalized;
}
