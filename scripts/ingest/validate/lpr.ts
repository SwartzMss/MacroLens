import { IngestionContractError, LPR_METHODOLOGY_FINGERPRINT } from '../types.ts';
import type { IndicatorDataset, RawLprPublication } from '../types.ts';
import { validateIndicatorDataset, nextMonth } from './dataset.ts';

export function validateLprPublications(publications: RawLprPublication[]): void {
  if (!Array.isArray(publications) || publications.length === 0) throw new IngestionContractError('LPR publications are empty');
  let previous = '';
  for (const { publication, values } of publications) {
    if (!/^\d{4}-\d{2}$/.test(publication.month) || publication.sourceDate.slice(0, 7) !== publication.month) {
      throw new IngestionContractError(`LPR publication date/month mismatch: ${publication.sourceDate} -> ${publication.month}`);
    }
    if (previous && nextMonth(previous) !== publication.month) throw new IngestionContractError(`LPR publications are not monthly continuous: ${previous} -> ${publication.month}`);
    if (!Number.isFinite(values['1y']) || !Number.isFinite(values['5y-plus'])) throw new IngestionContractError(`LPR publication is missing a tenor: ${publication.month}`);
    previous = publication.month;
  }
}

export function validateLprDataset(dataset: IndicatorDataset): void {
  validateIndicatorDataset(dataset);
  if (dataset.id !== 'lpr' || dataset.country !== 'CN' || dataset.frequency !== 'monthly' || dataset.unit !== '%' || dataset.metric !== 'rate') {
    throw new IngestionContractError('LPR dataset metadata does not match the official monthly rate-level contract');
  }
  if (dataset.calculation !== 'published' || dataset.source !== 'PBOC') throw new IngestionContractError('LPR dataset must contain published PBOC rates');
  if (dataset.methodologyFingerprint !== LPR_METHODOLOGY_FINGERPRINT) throw new IngestionContractError('LPR methodology fingerprint mismatch');
  if (!dataset.series || dataset.series.length !== 2 || dataset.series.map(({ id }) => id).join(',') !== '1y,5y-plus') throw new IngestionContractError('LPR dataset must contain the 1Y and 5Y+ series in deterministic order');
  for (const series of dataset.series) {
    if (!series.label || !Array.isArray(series.data) || series.data.length === 0) throw new IngestionContractError(`LPR series ${series.id} is empty`);
    if (series.id === '1y' && series.label !== '1年期 LPR') throw new IngestionContractError('Unexpected LPR 1Y series label');
    if (series.id === '5y-plus' && series.label !== '5年期以上 LPR') throw new IngestionContractError('Unexpected LPR 5Y+ series label');
    const dates = series.data.map(({ date }) => date);
    if (dates.join('|') !== [...dates].sort().join('|')) throw new IngestionContractError(`LPR series ${series.id} is not sorted`);
    if (new Set(dates).size !== dates.length) throw new IngestionContractError(`LPR series ${series.id} contains duplicate months`);
    for (let index = 1; index < dates.length; index += 1) {
      if (nextMonth(dates[index - 1]) !== dates[index]) throw new IngestionContractError(`LPR series ${series.id} is not monthly continuous: ${dates[index - 1]} -> ${dates[index]}`);
    }
  }
  for (const source of dataset.sources) {
    if (!source.url.startsWith('https://www.pbc.gov.cn/')) throw new IngestionContractError(`LPR source is not an official PBOC announcement: ${source.url}`);
  }
  if (JSON.stringify(dataset.data) !== JSON.stringify(dataset.series[0].data)) throw new IngestionContractError('LPR compatibility data must mirror the 1Y series');
}
