import assert from 'node:assert/strict';
import test from 'node:test';
import { getIndicatorData } from '../src/data/indicatorRegistry.ts';
import { getIndicatorReading } from '../src/data/indicatorReading.ts';

test('monthly readings separate observation period, comparison and percentage-point units', () => {
  const dataset = getIndicatorData('unemployment-rate');
  const result = getIndicatorReading({ ...dataset, data: [{ date: '2026-06', value: 5 }, { date: '2026-07', value: 5.2 }] });
  assert.equal(result.isEvent, false);
  assert.equal(result.rows[0].period, '2026-07');
  assert.equal(result.rows[0].previousPeriod, '2026-06');
  assert.equal(result.rows[0].change, '+0.20 个百分点');
  assert.equal(result.presentation.changeLabel, '较上月变化');
});

test('PMI and quarterly GDP retain different units and comparison labels', () => {
  const pmi = getIndicatorReading(getIndicatorData('pmi'));
  const gdp = getIndicatorReading(getIndicatorData('gdp'));
  assert.equal(pmi.rows[0].unit, '点');
  assert.match(pmi.rows[0].change, / 点$/);
  assert.equal(gdp.presentation.valueLabel, '同比');
  assert.equal(gdp.presentation.changeLabel, '较上一季度');
  assert.match(gdp.rows[0].period, /^\d{4}-Q[1-4]$/);
});

test('multi-series LPR keeps every tenor separate', () => {
  const dataset = getIndicatorData('lpr');
  const result = getIndicatorReading(dataset);
  assert.equal(result.rows.length, dataset.series.length);
  for (const [index, row] of result.rows.entries()) {
    assert.equal(row.label, dataset.series[index].label);
    assert.equal(row.value, dataset.series[index].data.at(-1).value.toFixed(2));
  }
});

test('event readings never substitute verification dates for actual change dates', () => {
  const dataset = getIndicatorData('policy-rate');
  const result = getIndicatorReading(dataset);
  assert.equal(result.isEvent, true);
  assert.equal(result.rows[0].period, dataset.data.at(-1).date);
  assert.notEqual(result.rows[0].period, dataset.verifiedThrough);
  assert.equal(result.presentation.changeLabel, '较上次事件变化');
});

test('missing comparisons and rounding noise do not invent changes', () => {
  const dataset = getIndicatorData('pmi');
  assert.equal(getIndicatorReading({ ...dataset, data: [{ date: '2026-07', value: 50 }] }).rows[0].change, '暂无可比数据');
  assert.equal(getIndicatorReading({ ...dataset, data: [{ date: '2026-07', value: 50 }, { date: '2026-08', value: 49.999999 }] }).rows[0].change, '0.0 点');
});
