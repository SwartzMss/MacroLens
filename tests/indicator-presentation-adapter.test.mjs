import assert from 'node:assert/strict';
import test from 'node:test';
import { getIndicatorData } from '../src/data/indicatorRegistry.ts';
import { getIndicatorPresentation } from '../src/data/indicatorPresentationAdapter.ts';

test('derives user-facing frequency and value labels', () => {
  assert.equal(getIndicatorPresentation(getIndicatorData('gdp')).frequencyLabel, '季度');
  assert.equal(getIndicatorPresentation(getIndicatorData('gdp')).valueLabel, '同比');
  assert.equal(getIndicatorPresentation(getIndicatorData('cpi')).frequencyLabel, '月度');
  assert.equal(getIndicatorPresentation(getIndicatorData('cpi')).valueLabel, '同比');
  assert.equal(getIndicatorPresentation(getIndicatorData('fixed-asset-investment')).valueLabel, '累计同比');
  assert.equal(getIndicatorPresentation(getIndicatorData('pmi')).valueLabel, '指数');
});

test('derives comparable recent-change labels without flattening indicator semantics', () => {
  assert.equal(getIndicatorPresentation(getIndicatorData('gdp')).changeLabel, '较上一季度');
  assert.equal(getIndicatorPresentation(getIndicatorData('cpi')).changeLabel, '较上月变化');
  assert.equal(getIndicatorPresentation(getIndicatorData('pmi')).changeLabel, '较上月变化');
  assert.equal(getIndicatorPresentation(getIndicatorData('fixed-asset-investment')).changeLabel, '较上一个累计期');
});

test('derives comparison method, source name, and actual series coverage', () => {
  const gdp = getIndicatorPresentation(getIndicatorData('gdp'));
  assert.match(gdp.comparisonMethod, /上年同期/);
  assert.match(gdp.comparisonMethod, /上一季度/);
  assert.equal(gdp.sourceLabel, '国家统计局');
  assert.equal(gdp.coverage, '2021-Q1 至 2026-Q2');
  assert.ok(gdp.sources.every((source) => source.title && source.url && source.sourceDate && source.coverage));
});

test('keeps source fallback and missing observations explicit', () => {
  const dataset = { ...getIndicatorData('gdp'), source: 'Other agency', data: [] };
  assert.throws(() => getIndicatorPresentation(dataset), /at least one observation/);
  assert.equal(getIndicatorPresentation({ ...getIndicatorData('gdp'), source: 'Other agency' }).sourceLabel, 'Other agency');
});
