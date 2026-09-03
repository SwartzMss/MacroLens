import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('indicator chart presents calculation method changes at their effective date', () => {
  const chart = fs.readFileSync(path.join(root, 'src', 'components', 'IndicatorChart.astro'), 'utf8');
  const registry = fs.readFileSync(path.join(root, 'src', 'data', 'indicatorRegistry.ts'), 'utf8');
  assert.match(registry, /calculationEffectiveFrom\?: string/);
  assert.match(chart, /previousMonth\(indicator\.calculationEffectiveFrom\)/);
  assert.match(chart, /及以前：由官方余额计算；\$\{indicator\.calculationEffectiveFrom\} 起：央行官方公布值/);
});
