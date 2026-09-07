import type { IndicatorDataset, IndicatorSeries, Observation } from '../../domain/indicatorDataset';
import { getIndicatorPresentation } from '../indicatorPresentationAdapter';
import type { SnapshotChangeUnit, SnapshotEvidence } from './types';

const indicatorNames: Record<string, string> = {
  gdp: 'GDP',
  pmi: '制造业 PMI',
  'industrial-production': '工业增加值',
  'retail-sales': '社会消费品零售',
  'fixed-asset-investment': '固定资产投资',
  cpi: 'CPI',
  'core-cpi': '核心 CPI',
  ppi: 'PPI',
  m0: 'M0',
  m1: 'M1',
  m2: 'M2',
  credit: '人民币贷款',
  'social-financing': '社会融资规模',
  lpr: 'LPR',
  'policy-rate': '政策利率',
  'unemployment-rate': '城镇调查失业率',
  exports: '出口',
  imports: '进口',
};

const evidenceId = (id: string, seriesId?: string) => seriesId ? `${id}:${seriesId}` : id;

function changeUnit(metric: string): SnapshotChangeUnit {
  if (metric === 'index') return 'points';
  if (['yoy', 'mom', 'cumulative_yoy'].includes(metric)) return 'percentage-points';
  return 'units';
}

function observationPair(data: Observation[]): { latest: Observation; previous: Observation | null; change: number | null } {
  const latest = data.at(-1);
  if (!latest) throw new Error('Macro snapshot evidence requires at least one observation');
  const previous = data.at(-2) ?? null;
  return { latest, previous, change: previous ? latest.value - previous.value : null };
}

function makeSeriesEvidence(dataset: IndicatorDataset, id: string, series?: IndicatorSeries): SnapshotEvidence {
  const { latest, previous, change } = observationPair(series?.data ?? dataset.data);
  const presentation = getIndicatorPresentation(dataset);
  const seriesId = series?.id;
  return {
    id: evidenceId(id, seriesId),
    ...(seriesId ? { seriesId } : {}),
    name: series?.label ?? indicatorNames[id] ?? dataset.label,
    metric: dataset.metric,
    frequency: dataset.frequency,
    valueLabel: presentation.valueLabel,
    changeLabel: presentation.changeLabel,
    conceptHref: `/concepts/${id}`,
    latest: latest.value,
    previous: previous?.value ?? null,
    change,
    changeUnit: changeUnit(dataset.metric),
    observationPeriod: latest.date,
    unit: dataset.unit,
    updatedAt: dataset.updatedAt,
    verifiedThrough: dataset.verifiedThrough ?? null,
    ...(dataset.chartType ? { chartType: dataset.chartType } : {}),
    isEvent: dataset.frequency === 'event',
  };
}

export function makeIndicatorEvidence(dataset: IndicatorDataset, id = dataset.id): SnapshotEvidence[] {
  return dataset.series?.length
    ? dataset.series.map(series => makeSeriesEvidence(dataset, id, series))
    : [makeSeriesEvidence(dataset, id)];
}

export const makeEvidence = makeIndicatorEvidence;
