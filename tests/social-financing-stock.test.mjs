import assert from 'node:assert/strict';
import test from 'node:test';
import { getIndicatorData } from '../src/data/indicatorRegistry.ts';
import { buildIndicatorChartOption } from '../src/data/indicatorChartOption.ts';
import { validatePBOCFinancialDataset } from '../scripts/ingest/validate/pboc-credit-social-financing.ts';

test('social financing charts all 31 stock amounts on the left and published growth on the right', () => {
  const data = getIndicatorData('social-financing');
  assert.deepEqual(data.balance.data.map(row => row.date), data.data.map(row => row.date));
  assert.equal(data.balance.data.length, 31);
  assert.deepEqual(data.balance.data[0], { date: '2024-01', value: 384.32 });
  assert.deepEqual(data.balance.data.at(-1), { date: '2026-07', value: 463.27 });
  const option = buildIndicatorChartOption({ unit: data.unit, balance: data.balance,
    series: [{ id: data.id, label: data.label, data: data.data }] });
  assert.equal(option.yAxis[1].position, 'left');
  assert.equal(option.yAxis[1].name, '存量（万亿元）');
  assert.equal(option.yAxis[0].position, 'right');
  assert.equal(option.series[1].yAxisIndex, 1);
  assert.equal(option.series[1].data.at(-1), 463.27);
  const tooltip = option.tooltip.formatter([{ dataIndex: 30 }]);
  assert.match(tooltip, /463.27 万亿元/);
  assert.match(tooltip, /7.4%/);
});

test('social financing stock validation rejects invalid units, negative values and unmatched dates', () => {
  const original = getIndicatorData('social-financing');
  for (const mutate of [
    data => { data.balance.unit = '亿元'; },
    data => { data.balance.data[0].value = -1; },
    data => { data.balance.data.at(-1).date = '2026-08'; },
  ]) {
    const data = structuredClone(original); mutate(data);
    assert.throws(() => validatePBOCFinancialDataset(data, 'social-financing'));
  }
});
