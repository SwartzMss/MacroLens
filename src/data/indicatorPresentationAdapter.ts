import type { IndicatorComparisonType, IndicatorDataset } from './indicatorRegistry';
import { normalizeSourceLabel } from './sourceLabelNormalizer';

export type IndicatorPresentationSource = {
  title: string;
  url: string;
  sourceDate: string;
  coverage: string;
  role?: string;
};

export type IndicatorViewModel = {
  frequencyLabel: string;
  valueLabel: string;
  changeLabel: string;
  comparisonMethod: string;
  definition: string;
  updatedAt: string;
  comparabilityNote: string;
  calculationDescription: string;
  sourceLabel: string;
  coverage: string;
  sources: IndicatorPresentationSource[];
};

function frequencyLabel(indicator: IndicatorDataset): string {
  if (indicator.frequency === 'monthly') return '月度';
  if (indicator.frequency === 'quarterly') return '季度';
  return indicator.frequency;
}

function valueLabel(indicator: IndicatorDataset): string {
  if (indicator.metric === 'yoy') return '同比';
  if (indicator.metric === 'mom') return '环比';
  if (indicator.metric === 'cumulative_yoy') return '累计同比';
  if (indicator.metric === 'index') return '指数';
  return indicator.metric;
}

function inferredComparisonType(indicator: IndicatorDataset): IndicatorComparisonType {
  if (indicator.metric === 'cumulative_yoy') return 'previous_cumulative_period';
  if (indicator.metric === 'mom') {
    return indicator.frequency === 'quarterly' ? 'previous_quarter_rate' : 'previous_month_rate';
  }
  if (indicator.metric === 'yoy') {
    return indicator.frequency === 'quarterly' ? 'previous_quarter_same_metric' : 'previous_month_same_metric';
  }
  if (indicator.metric === 'index') return 'previous_month_level';
  return indicator.frequency === 'quarterly' ? 'previous_quarter_level' : 'previous_month_level';
}

function comparisonType(indicator: IndicatorDataset): IndicatorComparisonType {
  return indicator.comparisonType ?? inferredComparisonType(indicator);
}

function changeLabel(indicator: IndicatorDataset): string {
  switch (comparisonType(indicator)) {
    case 'previous_cumulative_period':
      return '较上一个累计期';
    case 'previous_quarter_same_metric':
    case 'previous_quarter_level':
      return '较上一季度';
    case 'previous_quarter_rate':
      return '较上一季度环比变化';
    case 'previous_month_rate':
      return '较上月环比变化';
    case 'previous_month_same_metric':
    case 'previous_month_level':
      return '较上月变化';
  }
}

function comparisonMethod(indicator: IndicatorDataset): string {
  if (indicator.frequency === 'quarterly' && indicator.metric === 'yoy') {
    return '同比增速用于比较与上年同季度的变化；近期变化相对于上一季度。';
  }
  if (indicator.metric === 'cumulative_yoy') {
    return '累计同比用于比较与上年同期累计值的变化；近期变化相对于上一个累计期。';
  }
  if (indicator.metric === 'mom') {
    return indicator.frequency === 'quarterly'
      ? '环比用于表示本季度相对上一季度的变化；近期变化相对于上一个季度的环比读数。'
      : '环比用于表示本月相对上月的变化；近期变化相对于上一个月的环比读数。';
  }
  if (indicator.metric === 'index') {
    return '指数反映当月调查结果；近期变化相对于上月，50 为荣枯线参考。';
  }
  if (indicator.metric === 'yoy') {
    return '同比增速用于比较与上年同月的变化；近期变化相对于上月。';
  }
  return `读数按${frequencyLabel(indicator)}数据展示；近期变化${changeLabel(indicator)}。`;
}

function previousMonth(value: string): string {
  const [year, month] = value.split('-').map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
}

function calculationDescription(indicator: IndicatorDataset): string {
  return indicator.calculationEffectiveFrom && indicator.calculation === 'published'
    ? `${previousMonth(indicator.calculationEffectiveFrom)} 及以前：由官方余额计算；${indicator.calculationEffectiveFrom} 起：央行官方公布值`
    : indicator.calculation === 'published' ? '官方公布值' : '由官方余额计算';
}

export function getIndicatorPresentation(indicator: IndicatorDataset, definition = ''): IndicatorViewModel {
  const sorted = [...indicator.data].sort((left, right) => left.date.localeCompare(right.date));
  const first = sorted.at(0);
  const last = sorted.at(-1);
  if (!first || !last) throw new Error('Indicator dataset must contain at least one observation');

  return {
    frequencyLabel: frequencyLabel(indicator),
    valueLabel: valueLabel(indicator),
    changeLabel: changeLabel(indicator),
    comparisonMethod: comparisonMethod(indicator),
    definition,
    updatedAt: indicator.updatedAt,
    comparabilityNote: indicator.comparabilityNote,
    calculationDescription: calculationDescription(indicator),
    sourceLabel: normalizeSourceLabel(indicator.source),
    coverage: `${first.date} 至 ${last.date}`,
    sources: indicator.sources.map(({ title, url, sourceDate, coverage, role }) => ({
      title,
      url,
      sourceDate,
      coverage,
      ...(role ? { role } : {}),
    })),
  };
}
