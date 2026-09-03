import { HistoricalMismatchError, IngestionContractError } from '../types.ts';
import type { Observation } from '../types.ts';

export function mergeObservations(existing: Observation[], incoming: Observation[], label: string): Observation[] {
  const byDate = new Map<string, number>();
  for (const observation of existing) byDate.set(observation.date, observation.value);

  for (const observation of incoming) {
    const previous = byDate.get(observation.date);
    if (previous !== undefined && previous !== observation.value) {
      throw new HistoricalMismatchError(
        `Historical ${label} mismatch for ${observation.date}: existing=${previous}, fetched=${observation.value}`,
      );
    }
    if (previous === undefined) byDate.set(observation.date, observation.value);
  }

  if (byDate.size === 0) throw new IngestionContractError(`Cannot merge an empty ${label} observation set`);
  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => ({ date, value }));
}

export function mergePmiObservations(existing: Observation[], incoming: Observation[]): Observation[] {
  return mergeObservations(existing, incoming, 'PMI');
}
