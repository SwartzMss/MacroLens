import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  discoverPBOCMoneySupplyPublications,
  parsePBOCMoneySupplyReport,
} from '../scripts/ingest/fetch/pboc-money-supply.ts';
import { IngestionContractError, MethodologyMismatchError } from '../scripts/ingest/types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => fs.readFileSync(path.join(here, 'fixtures', 'pboc', name), 'utf8');
const publications = discoverPBOCMoneySupplyPublications(fixture('publication-index.html'));

test('discovers only monthly PBOC financial-statistics reports', () => {
  assert.deepEqual(publications.map(({ month }) => month), ['2025-11', '2025-12', '2026-01']);
  assert.equal(publications[1].url, 'https://www.pbc.gov.cn/diaochatongjisi/116219/116225/2025121216000000002/index.html');
});

test('parses M0 M1 and M2 from one official report', () => {
  assert.deepEqual(
    parsePBOCMoneySupplyReport(publications[0], fixture('report-2025-11.html')).values,
    { m0: 10.8, m1: -0.7, m2: 8.0 },
  );
});

test('parses a positive and negative published growth rate', () => {
  const parsed = parsePBOCMoneySupplyReport(publications[1], fixture('report-2025-12.html'));
  assert.equal(parsed.values.m0, 10.0);
  assert.equal(parsed.values.m1, -1.2);
});

test('rejects missing, malformed, duplicate, and methodology-changed series', () => {
  const html = fixture('report-2025-11.html');
  assert.throws(() => parsePBOCMoneySupplyReport(publications[0], html.replace('流通中货币（M0）余额', '现金余额')), /M0|series/i);
  assert.throws(() => parsePBOCMoneySupplyReport(publications[0], html.replace('同比增长8.0%', '同比增长待定%')), /numeric|数值/i);
  assert.throws(() => parsePBOCMoneySupplyReport(publications[0], `${html}<p>广义货币（M2）余额335.13万亿元，同比增长8.0%。</p>`), /duplicate|重复|M2/i);
  assert.throws(() => parsePBOCMoneySupplyReport(publications[0], html.replace('单位活期存款', '单位活期及结构性存款')), MethodologyMismatchError);
});

test('rejects invalid publication metadata', () => {
  assert.throws(() => discoverPBOCMoneySupplyPublications('<a href="/report.html">2025年11月金融统计数据报告</a><span>待定</span>'), /date|日期/i);
  assert.throws(() => discoverPBOCMoneySupplyPublications('<a href="https://example.com/report.html">2025年11月金融统计数据报告</a><span>2025-12-12</span>'), /PBOC|official|官方/i);
  assert.throws(() => discoverPBOCMoneySupplyPublications('<a href="/report.html">2025年金融统计数据报告</a><span>2025-12-12</span>'), /monthly|月份|报告/i);
  assert.throws(() => parsePBOCMoneySupplyReport(publications[0], fixture('report-2025-11.html').replace('2025年11月金融统计数据报告', '2025年12月金融统计数据报告')), /month|月份|title|标题/i);
  assert.throws(() => parsePBOCMoneySupplyReport(publications[0], fixture('report-2025-11.html').replace('流通中货币（M0）余额13.74万亿元，同比增长10.8%', '流通中货币（M0）余额13.74万亿元')), IngestionContractError);
});
