import m1 from '../../data/indicators/m1.json';
import m2 from '../../data/indicators/m2.json';

export interface IndicatorDataset {
  id: string; country: string; frequency: string;
  unit: string; metric: string; definitionVersion: string; source: string;
  sourceUrl: string; updatedAt: string; comparabilityNote: string;
  data: Array<{ date: string; value: number }>;
}

const indicatorData = { m1, m2 } satisfies Record<string, IndicatorDataset>;

export function getIndicatorData(id: string): IndicatorDataset {
  if (!Object.prototype.hasOwnProperty.call(indicatorData, id)) throw new Error(`Unknown indicator dataset: ${id}`);
  return indicatorData[id as keyof typeof indicatorData];
}
