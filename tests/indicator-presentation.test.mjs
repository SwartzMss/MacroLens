import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('indicator metadata presents calculation method changes at their effective date', () => {
  const metadata = fs.readFileSync(path.join(root, 'src', 'components', 'IndicatorMetadata.astro'), 'utf8');
  const registry = fs.readFileSync(path.join(root, 'src', 'data', 'indicatorRegistry.ts'), 'utf8');
  assert.match(registry, /calculationEffectiveFrom\?: string/);
  assert.match(metadata, /previousMonth\(indicator\.calculationEffectiveFrom\)/);
  assert.match(metadata, /及以前：由官方余额计算；\$\{indicator\.calculationEffectiveFrom\} 起：央行官方公布值/);
});

test('indicator detail provides structured user-facing metadata', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'components', 'IndicatorMetadata.astro'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'src', 'pages', 'concepts', '[id].astro'), 'utf8');

  for (const label of ['如何阅读', '指标定义', '统计频率', '变化口径', '数据来源', '数据集更新时间', '覆盖期间']) {
    assert.match(source, new RegExp(label));
  }
  assert.match(page, /IndicatorMetadata/);
  assert.doesNotMatch(source, /methodologyFingerprint/);
  assert.doesNotMatch(source, /runtime/);
  assert.doesNotMatch(source, /静态生成/);
  assert.doesNotMatch(source, /规则版本/);
});
