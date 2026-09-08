import type { IndicatorDataset } from '../domain/indicatorDataset';
import { getIndicatorPresentation } from './indicatorPresentationAdapter';

export function getIndicatorReading(indicator: IndicatorDataset) {
  const presentation = getIndicatorPresentation(indicator);
  const precision = indicator.metric === 'rate' ? 2 : 1;
  const rows = (indicator.series?.length ? indicator.series : [{ id: indicator.id, label: indicator.label, data: indicator.data }])
    .map(series => {
      const latest = series.data.at(-1);
      if (!latest) throw new Error(`Indicator reading requires observations: ${series.id}`);
      const previous = series.data.at(-2);
      const change = previous ? Number((latest.value - previous.value).toFixed(precision)) : null;
      const changeUnit = indicator.unit === '%' ? '个百分点' : indicator.unit === 'index' ? '点' : indicator.unit;
      return {
        id: series.id,
        label: series.label,
        value: latest.value.toFixed(precision),
        unit: indicator.unit === 'index' ? '点' : indicator.unit,
        period: latest.date,
        previousPeriod: previous?.date ?? null,
        change: change === null ? '暂无可比数据' : `${change > 0 ? '+' : ''}${change.toFixed(precision)} ${changeUnit}`,
      };
    });
  return { rows, presentation, isEvent: indicator.frequency === 'event' };
}
