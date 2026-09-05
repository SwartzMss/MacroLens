import { getIndicatorData, type IndicatorDataset } from './indicatorRegistry';

export const dashboardIndicatorIds = [
  'gdp', 'pmi', 'm0', 'm1', 'm2',
  'industrial-production', 'retail-sales', 'fixed-asset-investment',
  'cpi', 'core-cpi', 'ppi',
] as const;

export type DashboardIndicatorId = typeof dashboardIndicatorIds[number];
export type Observation = { date: string; value: number };
export type ObservationSummary = {
  latest: Observation;
  previous: Observation | null;
  change: number | null;
};
export type DashboardIndicator = ObservationSummary & {
  id: DashboardIndicatorId;
  name: string;
  conceptHref: string;
  dataset: IndicatorDataset;
};

const names: Record<DashboardIndicatorId, string> = {
  gdp: 'GDP',
  pmi: '制造业 PMI',
  m0: 'M0',
  m1: 'M1',
  m2: 'M2',
  'industrial-production': '工业增加值',
  'retail-sales': '社会消费品零售',
  'fixed-asset-investment': '固定资产投资',
  cpi: 'CPI',
  'core-cpi': '核心 CPI',
  ppi: 'PPI',
};

export function deriveObservationSummary(observations: Observation[]): ObservationSummary {
  const latest = observations.at(-1);
  if (!latest) throw new Error('Dashboard indicator must contain at least one observation');
  const previous = observations.at(-2) ?? null;
  return { latest, previous, change: previous ? latest.value - previous.value : null };
}

export function getDashboardIndicators(): DashboardIndicator[] {
  return dashboardIndicatorIds.map((id) => {
    const dataset = getIndicatorData(id);
    return {
      id,
      name: names[id],
      conceptHref: `/concepts/${id}`,
      dataset,
      ...deriveObservationSummary(dataset.data),
    };
  });
}
