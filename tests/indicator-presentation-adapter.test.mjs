import assert from 'node:assert/strict';
import test from 'node:test';
import { getIndicatorData } from '../src/data/indicatorRegistry.ts';
import { getIndicatorPresentation } from '../src/data/indicatorPresentationAdapter.ts';
import { normalizeSourceLabel } from '../src/data/sourceLabelNormalizer.ts';

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
  const monthlyRate = { ...getIndicatorData('cpi'), metric: 'mom' };
  assert.equal(getIndicatorPresentation(monthlyRate).valueLabel, '环比');
  assert.equal(getIndicatorPresentation(monthlyRate).changeLabel, '较上月环比变化');
});

test('derives comparison method, source name, and actual series coverage', () => {
  const gdp = getIndicatorPresentation(getIndicatorData('gdp'), 'GDP definition');
  assert.equal(gdp.comparisonMethod, '同比增速用于比较与上年同季度的变化；近期变化相对于上一季度。');
  const cpi = getIndicatorPresentation(getIndicatorData('cpi'));
  assert.equal(cpi.comparisonMethod, '同比增速用于比较与上年同月的变化；近期变化相对于上月。');
  const pmi = getIndicatorPresentation(getIndicatorData('pmi'));
  assert.equal(pmi.comparisonMethod, '指数反映当月调查结果；近期变化相对于上月，50 为荣枯线参考。');
  assert.equal(gdp.sourceLabel, '国家统计局');
  assert.equal(gdp.coverage, '2021-Q1 至 2026-Q2');
  assert.ok(gdp.sources.every((source) => source.title && source.url && source.sourceDate && source.coverage));
  const detailed = getIndicatorPresentation(getIndicatorData('fixed-asset-investment'));
  assert.ok(detailed.sources.every((source) => !Object.prototype.hasOwnProperty.call(source, 'request')));
  assert.equal(gdp.definition, 'GDP definition');
  assert.equal(gdp.updatedAt, getIndicatorData('gdp').updatedAt);
  assert.equal(gdp.comparabilityNote, getIndicatorData('gdp').comparabilityNote);
  assert.equal(gdp.calculationDescription, '官方公布值');
});

test('keeps source fallback and missing observations explicit', () => {
  const dataset = { ...getIndicatorData('gdp'), source: 'Other agency', data: [] };
  assert.throws(() => getIndicatorPresentation(dataset), /at least one observation/);
  assert.equal(getIndicatorPresentation({ ...getIndicatorData('gdp'), source: 'Other agency' }).sourceLabel, 'Other agency');
});

test('derives labels from domain metadata rather than indicator ids', () => {
  const quarterlyYoy = getIndicatorPresentation({ ...getIndicatorData('gdp'), id: 'cpi' });
  const monthlyYoy = getIndicatorPresentation({ ...getIndicatorData('cpi'), id: 'gdp' });

  assert.equal(quarterlyYoy.frequencyLabel, '季度');
  assert.equal(quarterlyYoy.valueLabel, '同比');
  assert.equal(quarterlyYoy.changeLabel, '较上一季度');
  assert.equal(monthlyYoy.frequencyLabel, '月度');
  assert.equal(monthlyYoy.valueLabel, '同比');
  assert.equal(monthlyYoy.changeLabel, '较上月变化');
});

test('normalizes known source aliases and preserves unknown source strings', () => {
  assert.equal(normalizeSourceLabel('NBS'), '国家统计局');
  assert.equal(normalizeSourceLabel('National Bureau of Statistics'), '国家统计局');
  assert.equal(normalizeSourceLabel(' 国家统计局 '), '国家统计局');
  assert.equal(normalizeSourceLabel('PBOC'), '中国人民银行');
  assert.equal(normalizeSourceLabel('A future statistical agency'), 'A future statistical agency');
});
