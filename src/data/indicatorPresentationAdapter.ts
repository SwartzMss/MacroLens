import type { IndicatorDataset } from './indicatorRegistry';
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

function changeLabel(indicator: IndicatorDataset): string {
  if (indicator.metric === 'cumulative_yoy') return '较上一个累计期';
  if (indicator.metric === 'mom') return indicator.frequency === 'quarterly' ? '较上一季度环比变化' : '较上月环比变化';
  if (indicator.frequency === 'quarterly' && indicator.metric === 'yoy') return '较上一季度';
  if (indicator.frequency === 'quarterly') return '较上一季度';
  return '较上月变化';
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

export function getIndicatorPresentation(indicator: IndicatorDataset): IndicatorViewModel {
  const first = indicator.data.at(0);
  const last = indicator.data.at(-1);
  if (!first || !last) throw new Error('Indicator dataset must contain at least one observation');

  return {
    frequencyLabel: frequencyLabel(indicator),
    valueLabel: valueLabel(indicator),
    changeLabel: changeLabel(indicator),
    comparisonMethod: comparisonMethod(indicator),
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
