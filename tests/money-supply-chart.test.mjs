import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildIndicatorChartOption } from '../src/data/indicatorChartOption.ts';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8').replace(/^\uFEFF/, ''));

for (const id of ['m0', 'm1', 'm2']) {
  test(`${id} balance and growth cover the same months with traceable published balances`, () => {
    const balance = read(`../data/chart-overlays/${id}-balance.json`);
    const growth = read(`../data/indicators/${id}.json`);
    assert.deepEqual(balance.data.map(row => row.date), growth.data.map(row => row.date));
    assert.equal(balance.unit, '万亿元');
    for (const row of balance.data) {
      assert.ok(Number.isFinite(row.value) && row.value > 0);
      if (row.date < '2025-11') continue;
      const report = readFileSync(new URL(`fixtures/pboc/report-${row.date}.html`, import.meta.url), 'utf8');
      const match = report.match(new RegExp(`[（(]${id.toUpperCase()}[）)]余额([\\d.]+)万亿元`));
      assert.equal(row.value, Number(match[1]));
    }
  });
}

test('M1 uses retrospective comparable balances and keeps negative growth on the independent right axis', () => {
  const balance = read('../data/chart-overlays/m1-balance.json');
  const growth = read('../data/indicators/m1.json');
  assert.equal(balance.data[0].value, 112.012);
  assert.equal(balance.data[11].value, 111.3069);
  const option = buildIndicatorChartOption({
    unit: '%', dualAxis: true, series: [
      { id: 'balance', label: '余额', unit: '万亿元', yAxisIndex: 0, data: balance.data },
      { id: 'yoy', label: '同比增速', unit: '%', yAxisIndex: 1, data: growth.data },
    ],
  });
  assert.equal(option.yAxis[0].min, 0);
  assert.equal(option.yAxis[1].min, undefined);
  assert.equal(option.series[1].yAxisIndex, 1);
  assert.ok(option.series[1].data.some(value => value < 0));
  assert.equal(option.series[1].lineStyle.type, 'dashed');
});
