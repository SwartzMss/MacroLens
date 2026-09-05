import type { IndicatorDataset } from './indicatorRegistry';

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

const sourceLabels: Record<string, string> = {
  NBS: '国家统计局',
  PBOC: '中国人民银行',
};

function frequencyLabel(indicator: IndicatorDataset): string {
  if (indicator.frequency === 'monthly') return '月度';
  if (indicator.frequency === 'quarterly') return '季度';
  return indicator.frequency;
}

function valueLabel(indicator: IndicatorDataset): string {
  if (indicator.metric === 'yoy') return '同比';
  if (indicator.metric === 'cumulative_yoy') return '累计同比';
  if (indicator.metric === 'index') return '指数';
  return indicator.metric;
}

function changeLabel(indicator: IndicatorDataset): string {
  if (indicator.frequency === 'quarterly') return '较上一季度';
  if (indicator.metric === 'cumulative_yoy') return '较上一个累计期';
  return '较上月变化';
}

function comparisonMethod(indicator: IndicatorDataset): string {
  if (indicator.frequency === 'quarterly' && indicator.metric === 'yoy') {
    return '季度同比：最新读数与上年同期比较；近期变化与上一季度的同比读数比较。';
  }
  if (indicator.metric === 'cumulative_yoy') {
    return '累计同比：最新读数与上年同期累计值比较；近期变化与上一个累计期的读数比较。';
  }
  if (indicator.metric === 'index') {
    return '月度指数：最新读数为当月调查指数；近期变化与上月读数比较，50 为荣枯线参考。';
  }
  if (indicator.metric === 'yoy') {
    return '月度同比：最新读数与上年同月比较；近期变化与上月的同比读数比较。';
  }
  return `最新读数按${frequencyLabel(indicator)}数据展示；近期变化${changeLabel(indicator)}。`;
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
    sourceLabel: sourceLabels[indicator.source] ?? indicator.source,
    coverage: `${first.date} 至 ${last.date}`,
    sources: indicator.sources.map((source) => ({ ...source })),
  };
}
