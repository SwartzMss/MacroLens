import type { EChartsOption, LineSeriesOption } from 'echarts';
import type { IndicatorDataset, IndicatorSeries } from '../domain/indicatorDataset';

export type IndicatorChartConfig = {
  series: (IndicatorSeries & { unit?: string; yAxisIndex?: number })[];
  dualAxis?: boolean;
  unit: string;
  balance?: IndicatorDataset['balance'];
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
    tooltip: { trigger: 'axis', confine: true, renderMode: config.dualAxis ? 'richText' : 'html', ...(config.balance ? {
      formatter: (params) => {
        const points = Array.isArray(params) ? params : [params];
        const date = dates[points[0].dataIndex];
        const balance = config.balance!.data.find(item => item.date === date);
        const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
        return [escape(date), ...series.map(item => {
          const value = item.data.find(point => point.date === date)?.value;
          return `${escape(item.label)}：${value === undefined ? '待补充' : `${value.toFixed(1)}${escape(config.unit)}`}`;
        }), `${escape(config.balance!.label)}：${balance ? `${balance.value.toFixed(2)} ${escape(config.balance!.unit)}` : '待补充'}`].join('<br/>');
      },
    } : {}) },
    legend: series.length > 1 || config.balance ? { top: 0 } : undefined,
    grid: { left: 44, right: config.balance ? 64 : config.dualAxis ? 44 : 20, top: config.balance ? 64 : config.dualAxis ? 58 : series.length > 1 ? 38 : 28, bottom: 38 },
    xAxis: step
      ? { type: 'time', min: timestamp(dates[0]), max: timestamp(config.verifiedThrough ?? dates.at(-1)!), axisLabel: { formatter: '{yyyy}-{MM}-{dd}', hideOverlap: true } }
      : { type: 'category', data: dates, axisLine: { lineStyle: { color: '#b9c2ba' } } },
    yAxis: config.balance ? [
      { type: 'value', name: `同比（${config.unit}）`, position: 'left', splitLine: { lineStyle: { color: '#e7e8e1' } } },
      { type: 'value', name: `余额（${config.balance.unit}）`, position: 'right', scale: true, splitLine: { show: false } },
    ] : config.dualAxis ? [
      { type: 'value', name: '万亿元', min: 0, position: 'left', axisLabel: { color: colors[0] }, nameTextStyle: { color: colors[0] }, splitLine: { lineStyle: { color: '#e7e8e1' } } },
      { type: 'value', name: '%', position: 'right', axisLabel: { color: colors[1] }, nameTextStyle: { color: colors[1] }, splitLine: { show: false } },
    ] : { type: 'value', name: config.unit === 'index' ? '点' : config.unit, splitLine: { lineStyle: { color: '#e7e8e1' } } },
    series: [...series.map((item, index): LineSeriesOption => {

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
        areaStyle: series.length === 1 && !config.balance ? { color: 'rgba(13,107,80,.09)' } : undefined,
        markLine: index === 0 && config.referenceValue !== undefined ? {
          silent: true, symbol: 'none', label: { formatter: config.referenceLabel || String(config.referenceValue) },
          data: [{ yAxis: config.referenceValue }],
        } : undefined,
      };
    }), ...(config.balance ? [{
      name: config.balance.label, type: 'line' as const, yAxisIndex: 1,
      data: dates.map(date => config.balance!.data.find(item => item.date === date)?.value ?? null),
      connectNulls: false, smooth: false, symbolSize: 7,
      lineStyle: { width: 3, color: colors[1] },
      itemStyle: { color: colors[1] },
    }] : [])],
  };
}
