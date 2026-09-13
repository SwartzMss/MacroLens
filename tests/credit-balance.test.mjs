import assert from 'node:assert/strict';
import test from 'node:test';
import { getIndicatorData } from '../src/data/indicatorRegistry.ts';
import { buildIndicatorChartOption } from '../src/data/indicatorChartOption.ts';
import { validateIndicatorDataset } from '../src/domain/indicatorDataset.ts';

test('credit tooltip joins balance by month and distinguishes unavailable history from zero', () => {
  const credit = getIndicatorData('credit');
  const option = buildIndicatorChartOption({
    series: [{ id: 'credit', label: credit.label, data: credit.data }],
    unit: credit.unit, balance: credit.balance,
  });
  const latest = option.tooltip.formatter([{ dataIndex: credit.data.length - 1 }]);
  assert.match(latest, /2026-07/);
  assert.match(latest, /282\.29 万亿元/);
  assert.match(latest, /5\.1%/);
  assert.match(option.tooltip.formatter([{ dataIndex: 0 }]), /人民币贷款余额：242.50 万亿元/);
  assert.deepEqual(credit.balance.data.map(item => item.date), credit.data.map(item => item.date));
  assert.equal(credit.balance.data.length, 31);
  assert.equal(option.yAxis.length, 2);
  assert.equal(option.yAxis[1].name, '余额（万亿元）');
  assert.equal(option.yAxis[1].position, 'left');
  assert.equal(option.yAxis[0].position, 'right');
  assert.equal(option.series[1].yAxisIndex, 1);
  assert.equal(option.series[1].data.at(-1), 282.29);
  assert.equal(option.series[1].data[0], 242.504789);
  assert.equal(option.series[1].connectNulls, false);
  const partial = buildIndicatorChartOption({
    series: [{ id: 'credit', label: credit.label, data: credit.data }],
    unit: credit.unit, balance: { ...credit.balance, data: credit.balance.data.slice(1) },
  });
  assert.equal(partial.series[1].data[0], null);
  assert.match(partial.tooltip.formatter([{ dataIndex: 0 }]), /人民币贷款余额：待补充/);
});

test('balance schema rejects invalid amounts', () => {
  const credit = structuredClone(getIndicatorData('credit'));
  credit.balance.data[0].value = NaN;
  assert.throws(() => validateIndicatorDataset(credit), /balance.data\[0\].value/);
});
