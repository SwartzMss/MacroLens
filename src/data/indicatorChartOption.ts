import type { EChartsOption } from 'echarts';
import type { IndicatorSeries } from '../domain/indicatorDataset';

export type IndicatorChartConfig = {
  series: (IndicatorSeries & { unit?: string; yAxisIndex?: number })[];
  dualAxis?: boolean;
  unit: string;
  chartType?: string;
  verifiedThrough?: string;
  referenceValue?: number;
  referenceLabel?: string;
};

export function buildIndicatorChartOption(config: IndicatorChartConfig): EChartsOption {
  const { series } = config;
  const step = config.chartType === 'step';
  const dates = [...new Set(series.flatMap(({ data }) => data.map(({ date }) => date)))].sort();
  const colors = ['#0d6b50', '#d66b32', '#3a72a8', '#8e5aa5'];
  const timestamp = (date: string) => Date.parse(`${date}T00:00:00Z`);
  return {
    useUTC: true,
    animationDuration: 700,
    tooltip: { trigger: 'axis', confine: true, renderMode: config.dualAxis ? 'richText' : 'html' },
    legend: series.length > 1 ? { top: 0 } : undefined,
    grid: { left: 44, right: config.dualAxis ? 44 : 20, top: config.dualAxis ? 58 : series.length > 1 ? 38 : 28, bottom: 38 },
    xAxis: step
      ? { type: 'time', min: timestamp(dates[0]), max: timestamp(config.verifiedThrough ?? dates.at(-1)!), axisLabel: { formatter: '{yyyy}-{MM}-{dd}', hideOverlap: true } }
      : { type: 'category', data: dates, axisLine: { lineStyle: { color: '#b9c2ba' } } },
    yAxis: config.dualAxis ? [
      { type: 'value', name: '万亿元', min: 0, position: 'left', axisLabel: { color: colors[0] }, nameTextStyle: { color: colors[0] }, splitLine: { lineStyle: { color: '#e7e8e1' } } },
      { type: 'value', name: '%', position: 'right', axisLabel: { color: colors[1] }, nameTextStyle: { color: colors[1] }, splitLine: { show: false } },
    ] : { type: 'value', name: config.unit === 'index' ? '点' : config.unit, splitLine: { lineStyle: { color: '#e7e8e1' } } },
    series: series.map((item, index) => {
      const values = new Map(item.data.map(({ date, value }) => [date, value]));
      const last = item.data.at(-1)!;
      // The terminal segment is display-only; the canonical dataset retains change dates only.
      const eventData = item.data.map(({ date, value }) => ({ value: [timestamp(date), value] }));
      const terminal = config.verifiedThrough && config.verifiedThrough > last.date
        ? [{ value: [timestamp(config.verifiedThrough), last.value], symbol: 'none', name: '利率核验（非新增事件）' }]
        : [];
      return {
        name: item.label, type: 'line',
        yAxisIndex: item.yAxisIndex ?? 0,
        tooltip: item.unit ? { valueFormatter: value => `${Number(value).toFixed(item.unit === '%' ? 1 : 2)} ${item.unit}` } : undefined,
        data: step ? [...eventData, ...terminal] : dates.map(date => values.get(date) ?? null),
        step: step ? 'end' : false, smooth: step || config.dualAxis ? false : .25,
        symbolSize: 7,
        lineStyle: { width: 3, color: colors[index % colors.length], type: config.dualAxis && index === 1 ? 'dashed' : 'solid' },
        itemStyle: { color: colors[index % colors.length] },
        areaStyle: series.length === 1 ? { color: 'rgba(13,107,80,.09)' } : undefined,
        markLine: index === 0 && config.referenceValue !== undefined ? {
          silent: true, symbol: 'none', label: { formatter: config.referenceLabel || String(config.referenceValue) },
          data: [{ yAxis: config.referenceValue }],
        } : undefined,
      };
    }),
  };
}
