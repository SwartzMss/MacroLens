import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const homepage = resolve(root, 'dist/index.html');
const snapshot = resolve(root, 'dist/snapshot/index.html');
const pages = [
  homepage,
  snapshot,
  resolve(root, 'dist/concepts/gdp/index.html'),
  resolve(root, 'dist/concepts/credit/index.html'),
  resolve(root, 'dist/concepts/policy-rate/index.html'),
];
const engineeringMetadata = /rulesVersion|methodologyFingerprint|runtime|静态生成/;

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  assert.doesNotMatch(html, engineeringMetadata, `${page} exposes engineering metadata`);
}

const home = readFileSync(homepage, 'utf8');
const fullSnapshot = readFileSync(snapshot, 'utf8');
const gdp = readFileSync(pages[2], 'utf8');
const credit = readFileSync(pages[3], 'utf8');
assert.doesNotMatch(home, /数据集更新时间范围/);
assert.match(fullSnapshot, /数据集更新时间范围/);
assert.match(gdp, /如何阅读/);
assert.match(gdp, /来源详情/);
assert.match(gdp, /数据更新/);
assert.match(gdp, /MacroLens 于/);
assert.match(gdp, /发布于/);
assert.match(credit, /来源：中国人民银行/);
const policyRate = readFileSync(pages[4], 'utf8');
assert.match(policyRate, /中国人民银行7天期逆回购操作利率阶梯图/);
assert.match(policyRate, /当前水平（截至核验日）/);
assert.match(policyRate, /最近生效／操作日/);
assert.match(policyRate, /不定期（事件）/);
assert.match(policyRate, /不代表每日或每月新增观测/);
const chart = JSON.parse(policyRate.match(/data-chart="([^"]+)"/)[1].replaceAll('&#34;', '"').replaceAll('&quot;', '"').replaceAll('&amp;', '&'));
assert.equal(chart.chartType, 'step');
assert.ok(chart.verifiedThrough >= chart.series[0].data.at(-1).date);
assert.ok(chart.series[0].data.every(({ date }) => /^\d{4}-\d{2}-\d{2}$/.test(date)));
