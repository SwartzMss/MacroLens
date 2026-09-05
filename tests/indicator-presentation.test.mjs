import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('indicator metadata presents calculation method changes at their effective date', () => {
  const metadata = fs.readFileSync(path.join(root, 'src', 'components', 'IndicatorMetadata.astro'), 'utf8');
  const adapter = fs.readFileSync(path.join(root, 'src', 'data', 'indicatorPresentationAdapter.ts'), 'utf8');
  const registry = fs.readFileSync(path.join(root, 'src', 'data', 'indicatorRegistry.ts'), 'utf8');
  assert.match(registry, /calculationEffectiveFrom\?: string/);
  assert.match(adapter, /previousMonth\(value: string\)/);
  assert.match(adapter, /及以前：由官方余额计算；\$\{indicator\.calculationEffectiveFrom\} 起：央行官方公布值/);
  assert.match(adapter, /calculationDescription/);
  assert.match(metadata, /presentation\.calculationDescription/);
});

test('indicator detail provides structured user-facing metadata', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'components', 'IndicatorMetadata.astro'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'src', 'pages', 'concepts', '[id].astro'), 'utf8');

  for (const label of ['如何阅读', '指标定义', '统计频率', '变化口径', '数据来源', '数据更新', '覆盖期间']) {
    assert.match(source, new RegExp(label));
  }
  assert.match(page, /IndicatorMetadata/);
  assert.match(page, /getIndicatorPresentation/);
  assert.match(page, /presentation=\{presentation\}/);
  assert.doesNotMatch(source, /IndicatorDataset/);
  assert.doesNotMatch(source, /getIndicatorPresentation/);
  assert.match(source, /presentation\.comparisonMethod/);
  assert.match(page, /!indicator.*entry\.data\.source/);
  assert.match(source, /<details/);
  assert.match(source, /来源详情/);
  assert.match(source, /MacroLens 于/);
  assert.match(source, /发布于/);
  assert.doesNotMatch(source, /数据集更新时间/);
  assert.doesNotMatch(source, /open>/);
  assert.doesNotMatch(source, /methodologyFingerprint/);
  assert.doesNotMatch(source, /runtime/);
  assert.doesNotMatch(source, /静态生成/);
  assert.doesNotMatch(source, /规则版本/);
});
