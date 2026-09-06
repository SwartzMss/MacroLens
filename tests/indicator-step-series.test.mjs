import assert from 'node:assert/strict';
import test from 'node:test';
import * as echarts from 'echarts';
import { getIndicatorData } from '../src/data/indicatorRegistry.ts';
import { getIndicatorPresentation } from '../src/data/indicatorPresentationAdapter.ts';
import { buildIndicatorChartOption } from '../src/data/indicatorChartOption.ts';

const configFor = dataset => ({ ...dataset, series: dataset.series ?? [{ id: 'default', label: dataset.label, data: dataset.data }] });

test('event presentation distinguishes the last change from the last rate verification', () => {
  const data = getIndicatorData('policy-rate');
  const view = getIndicatorPresentation({ ...data, id: 'another-event-rate' });
  assert.equal(view.frequencyLabel, '不定期（事件）');
  assert.equal(view.latestValue, '1.40%');
  assert.equal(view.latestEventDate, '2025-05-08');
  assert.equal(view.verifiedThrough, '2026-09-01');
  assert.equal(view.coverage, '2024-07-19 至 2026-09-01');
  assert.equal(view.changeLabel, '较上次事件变化');
  assert.doesNotMatch(view.comparisonMethod, /上月|月度读数/);
  assert.match(view.comparisonMethod, /水平区间沿用此前公布水平/);
  assert.equal(view.sourceLabel, '中国人民银行');
});

test('step chart uses actual elapsed time and holds the prior level until each change date', () => {
  const dataset = getIndicatorData('policy-rate');
  const before = JSON.stringify(dataset);
  const option = buildIndicatorChartOption(configFor(dataset));
  assert.equal(option.xAxis.type, 'time');
  assert.equal(option.useUTC, true);
  assert.equal(option.series[0].step, 'end');
  assert.equal(option.series[0].smooth, false);
  const points = option.series[0].data;
  assert.deepEqual(points.slice(0, -1).map(({ value }) => value), dataset.data.map(({ date, value }) => [Date.parse(`${date}T00:00:00Z`), value]));
  assert.equal(points.at(-1).symbol, 'none');
  assert.match(points.at(-1).name, /非新增事件/);
  assert.deepEqual(points.at(-1).value, [Date.parse('2026-09-01T00:00:00Z'), 1.4]);
  assert.equal(JSON.stringify(dataset), before);

  // Exercise ECharts itself, not only the option shape: each vertical segment
  // must occur at the NEW event's time coordinate, with proportional date spacing.
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 1000, height: 420 });
  try {
    chart.setOption({ ...option, animation: false });
    const svg = chart.renderToSVGString();
    assert.match(svg, /<path/);
    const series = chart.getModel().getSeriesByIndex(0);
    let line;
    chart.getViewOfSeriesModel(series).group.traverse(element => { if (element.type === 'ec-polyline') line = element; });
    assert.ok(line, 'ECharts should render a line path');
    const coordinates = Array.from(line.shape.points);
    const xAt = date => chart.convertToPixel({ xAxisIndex: 0 }, Date.parse(`${date}T00:00:00Z`));
    const yAt = value => chart.convertToPixel({ yAxisIndex: 0 }, value);
    for (let index = 1; index < dataset.data.length; index++) {
      const event = dataset.data[index], previous = dataset.data[index - 1];
      const expected = [xAt(event.date), yAt(previous.value), xAt(event.date), yAt(event.value)];
      assert.ok(coordinates.some((_, offset) => offset % 2 === 0 && expected.every((number, n) => Math.abs(coordinates[offset + n] - number) < .01)), `vertical change at ${event.date}`);
    }
    const threeDays = xAt('2024-07-22') - xAt('2024-07-19');
    const sixtySevenDays = xAt('2024-09-27') - xAt('2024-07-22');
    assert.ok(Math.abs(sixtySevenDays / threeDays - 67 / 3) < .001);
  } finally { chart.dispose(); }
});

test('monthly, quarterly, multi-series and reference-line charts preserve their behavior', () => {
  for (const id of ['cpi', 'gdp', 'lpr', 'pmi']) {
    const dataset = getIndicatorData(id);
    const option = buildIndicatorChartOption(configFor(dataset));
    assert.equal(option.xAxis.type, 'category');
    assert.deepEqual(option.xAxis.data, dataset.data.map(({ date }) => date));
    assert.equal(option.series[0].smooth, .25);
    assert.equal(option.series[0].step, false);
    assert.deepEqual(option.series[0].data, dataset.data.map(({ value }) => value));
    assert.equal(getIndicatorPresentation(dataset).latestEventDate, undefined);
    if (id === 'lpr') {
      assert.equal(option.series.length, 2);
      assert.ok(option.legend);
      assert.deepEqual(option.series[1].data, dataset.series[1].data.map(({ value }) => value));
    }
    if (id === 'pmi') assert.equal(option.series[0].markLine.data[0].yAxis, 50);
  }
});
