import type { IndicatorDataset, IndicatorSource } from '../types.ts';
import { HistoricalMismatchError, IngestionContractError } from '../types.ts';
import type { RawPolicyRate } from '../fetch/policy-rate.ts';
import { validateDay, validatePublication } from '../fetch/policy-rate.ts';
import { validatePolicyRateDataset } from '../validate/policy-rate.ts';

export function combinePolicyRatePublications(raw: RawPolicyRate[]): RawPolicyRate[] {
  const byDate = new Map<string, RawPolicyRate[]>();
  const urls = new Set<string>();
  for (const item of raw) {
    validatePublication(item.publication);
    validateDay(item.date);
    if (!Number.isFinite(item.value) || item.value <= 0 || item.value >= 20 || urls.has(item.publication.url)) throw new IngestionContractError('Invalid or duplicate policy-rate publication');
    urls.add(item.publication.url);
    const sameDate = byDate.get(item.date) ?? [];
    if (sameDate.some(previous => previous.kind === item.kind)) throw new IngestionContractError(`Duplicate policy-rate date: ${item.date}`);
    if (sameDate.some(previous => previous.value !== item.value)) throw new HistoricalMismatchError(`Conflicting policy-rate values: ${item.date}`);
    sameDate.push(item);
    byDate.set(item.date, sameDate);
  }
  // One operation can corroborate one decision on its effective date. Prefer the decision's exact provenance.
  return [...byDate.values()].map(items => items.find(item => item.kind === 'change') ?? items[0]).sort((a, b) => a.date.localeCompare(b.date));
}

function sourceFor(item: RawPolicyRate): IndicatorSource {
  const { title, url, sourceDate } = item.publication;
  return { title, url, sourceDate, coverage: `${item.date} to ${item.date}` };
}

export function normalizePolicyRateDataset(incoming: RawPolicyRate[], existing: IndicatorDataset): IndicatorDataset {
  validatePolicyRateDataset(existing);
  if (!incoming.length) throw new IngestionContractError('No policy-rate observations');
  let previousDate = '';
  for (const item of incoming) {
    if (item.date <= previousDate) throw new IngestionContractError('Incoming event dates must be chronologically sorted and unique');
    previousDate = item.date;
  }
  // Validate values and publication identities even for direct callers.
  combinePolicyRatePublications(incoming);
  for (const source of existing.sources) {
    const expectedDate = source.coverage.split(' to ')[0];
    const fetched = incoming.find(item => item.publication.url === source.url);
    const expectedValue = existing.data.findLast(item => item.date <= expectedDate)!.value;
    if (!fetched || fetched.date !== expectedDate || fetched.value !== expectedValue
      || fetched.publication.title !== source.title || fetched.publication.sourceDate !== source.sourceDate) {
      throw new HistoricalMismatchError(`Historical policy-rate event/provenance mismatch: ${expectedDate}`);
    }
  }

  const data = existing.data.map(point => ({ ...point }));
  const sources = existing.sources.filter(source => data.some(point => source.coverage === `${point.date} to ${point.date}`));
  let latest = incoming[0];
  for (const item of incoming) {
    if (item.date < data[0].date) throw new IngestionContractError('Incoming rate predates the bootstrap boundary');
    const prior = data.findLast(point => point.date < item.date);
    if (item.kind === 'change' && (!prior || item.previousValue !== prior.value)) throw new HistoricalMismatchError(`Announced previous policy rate mismatch: ${item.date}`);
    if (item.date <= existing.verifiedThrough!) {
      if (existing.data.findLast(point => point.date <= item.date)?.value !== item.value) throw new HistoricalMismatchError(`Historical policy-rate overlap mismatch: ${item.date}`);
    } else if (item.value !== data.at(-1)!.value) {
      data.push({ date: item.date, value: item.value });
      sources.push(sourceFor(item));
    }
    if (item.date >= latest.date) latest = item;
  }
  if (latest.date < existing.verifiedThrough!) throw new IngestionContractError('Archive regressed before the verified rate');
  if (!sources.some(source => source.coverage === `${latest.date} to ${latest.date}`)) sources.push(sourceFor(latest));
  sources.sort((a, b) => a.sourceDate.localeCompare(b.sourceDate) || a.coverage.localeCompare(b.coverage));
  const dataset = { ...existing, data, sources, verifiedThrough: latest.date, updatedAt: sources.at(-1)!.sourceDate };
  validatePolicyRateDataset(dataset);
  return dataset;
}
