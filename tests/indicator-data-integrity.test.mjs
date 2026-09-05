import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', 'data', 'indicators');

const contracts = {
  m0: { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  m1: { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  m2: { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  pmi: { frequency: 'monthly', unit: 'index', metric: 'index', calculation: 'published' },
  gdp: { frequency: 'quarterly', unit: '%', metric: 'yoy', calculation: 'published' },
  'industrial-production': { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  'retail-sales': { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  'fixed-asset-investment': { frequency: 'monthly', unit: '%', metric: 'cumulative_yoy', calculation: 'published' },
  cpi: { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  'core-cpi': { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
  ppi: { frequency: 'monthly', unit: '%', metric: 'yoy', calculation: 'published' },
};

const officialPriceSources = {
  cpi: {
    '2026-01': 'https://www.stats.gov.cn/xxgk/sjfb/zxfb2020/202602/t20260211_1962588.html',
    '2026-02': 'https://www.stats.gov.cn/sj/zxfbhjd/202603/t20260309_1962732.html',
    '2026-03': 'https://www.stats.gov.cn/sj/zxfbhjd/202604/t20260410_1963264.html',
    '2026-04': 'https://www.stats.gov.cn/sj/zxfbhjd/202605/t20260511_1963659.html',
    '2026-05': 'https://www.stats.gov.cn/sj/zxfb/202606/t20260610_1963923.html',
    '2026-06': 'https://www.stats.gov.cn/sj/zxfb/202607/t20260709_1964084.html',
    '2026-07': 'https://www.stats.gov.cn/sj/zxfbhjd/202608/t20260809_1965008.html',
  },
  'core-cpi': {
    '2026-01': 'https://www.stats.gov.cn/xxgk/sjfb/zxfb2020/202602/t20260211_1962588.html',
    '2026-02': 'https://www.stats.gov.cn/sj/zxfbhjd/202603/t20260309_1962732.html',
    '2026-03': 'https://www.stats.gov.cn/sj/zxfbhjd/202604/t20260410_1963264.html',
    '2026-04': 'https://www.stats.gov.cn/sj/zxfbhjd/202605/t20260511_1963659.html',
    '2026-05': 'https://www.stats.gov.cn/sj/zxfb/202606/t20260610_1963923.html',
    '2026-06': 'https://www.stats.gov.cn/sj/zxfb/202607/t20260709_1964084.html',
    '2026-07': 'https://www.stats.gov.cn/sj/zxfbhjd/202608/t20260809_1965008.html',
  },
  ppi: {
    '2026-01': 'https://www.stats.gov.cn/sj/zxfbhjd/202602/t20260211_1962587.html',
    '2026-02': 'https://www.stats.gov.cn/xxgk/sjfb/zxfb2020/202603/t20260309_1962729.html',
    '2026-03': 'https://www.stats.gov.cn/sj/zxfbhjd/202604/t20260410_1963263.html',
    '2026-04': 'https://www.stats.gov.cn/sj/zxfbhjd/202605/t20260511_1963658.html',
    '2026-05': 'https://www.stats.gov.cn/sj/zxfb/202606/t20260610_1963922.html',
    '2026-06': 'https://www.stats.gov.cn/sj/zxfb/202607/t20260709_1964083.html',
    '2026-07': 'https://www.stats.gov.cn/sj/zxfbhjd/202608/t20260809_1965007.html',
  },
};

function readDataset(id) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, `${id}.json`), 'utf8'));
}

function dateKey(value, frequency) {
  if (frequency === 'quarterly') {
    const match = value.match(/^(\d{4})-Q([1-4])$/);
    assert.ok(match, `invalid quarterly period: ${value}`);
    return Number(match[1]) * 10 + Number(match[2]);
  }

  const month = value.match(/^(\d{4})-(\d{2})$/);
  if (month) return Number(month[1]) * 100 + Number(month[2]);

  const combined = value.match(/^(\d{4})-(\d{2})–(\d{2})$/);
  assert.ok(combined, `invalid monthly period: ${value}`);
  assert.ok(Number(combined[3]) >= Number(combined[2]), `invalid combined period: ${value}`);
  return Number(combined[1]) * 100 + Number(combined[3]);
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isOfficialHost(value) {
  const { protocol, hostname } = new URL(value);
  return protocol === 'https:' && (hostname === 'stats.gov.cn'
    || hostname.endsWith('.stats.gov.cn')
    || hostname === 'pbc.gov.cn'
    || hostname.endsWith('.pbc.gov.cn'));
}

test('all V1 indicator datasets satisfy the explicit data contract', () => {
  assert.deepEqual(Object.keys(contracts).sort(), fs.readdirSync(dataDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -5))
    .sort());

  for (const [id, contract] of Object.entries(contracts)) {
    const dataset = readDataset(id);
    assert.equal(dataset.id, id);
    assert.equal(dataset.country, 'CN');
    for (const [field, value] of Object.entries(contract)) assert.equal(dataset[field], value, `${id}.${field}`);
    assert.ok(isIsoDate(dataset.updatedAt), `${id}.updatedAt`);
    assert.ok(dataset.comparabilityNote.length > 0, `${id}.comparabilityNote`);
    assert.ok(dataset.methodologyFingerprint.length > 0, `${id}.methodologyFingerprint`);
    assert.ok(dataset.data.length >= 2, `${id}.data must contain history`);

    const keys = dataset.data.map(({ date }) => dateKey(date, dataset.frequency));
    assert.deepEqual([...keys].sort((a, b) => a - b), keys, `${id}.data must be ordered`);
    assert.equal(new Set(keys).size, keys.length, `${id}.data must not duplicate periods`);
    assert.ok(dataset.data.every(({ value }) => Number.isFinite(value)), `${id}.data values must be finite`);

    const sourceKeys = new Set();
    for (const source of dataset.sources) {
      assert.ok(source.title.length > 0, `${id} source title`);
      assert.ok(isOfficialHost(source.url), `${id} source host: ${source.url}`);
      assert.ok(isIsoDate(source.sourceDate), `${id} source date: ${source.url}`);
      assert.ok(source.coverage.length > 0, `${id} source coverage: ${source.url}`);
      assert.ok(!source.role || ['data', 'methodology'].includes(source.role), `${id} source role`);
      const key = `${source.role ?? 'data'}|${source.coverage}`;
      assert.ok(!sourceKeys.has(key), `${id} duplicate source coverage: ${key}`);
      sourceKeys.add(key);
    }
    assert.ok(dataset.sources.some((source) => source.coverage.includes(dataset.data.at(-1).date)), `${id} latest data lacks provenance`);
  }
});

test('price datasets use the formal monthly release as data provenance', () => {
  for (const [id, expectedByMonth] of Object.entries(officialPriceSources)) {
    const dataset = readDataset(id);
    for (const [month, url] of Object.entries(expectedByMonth)) {
      const source = dataset.sources.find(({ coverage }) => coverage === `${month} to ${month}`);
      assert.ok(source, `${id} missing source for ${month}`);
      assert.equal(source.role, 'data', `${id} ${month} source role`);
      assert.equal(source.url, url, `${id} ${month} source URL`);
      assert.doesNotMatch(source.title, /解读|国民经济运行总体平稳/, `${id} ${month} source title`);
    }
  }
});
