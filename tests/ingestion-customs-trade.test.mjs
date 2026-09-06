import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  discoverCustomsTradePublications,
  discoverLatestCustomsTradePublication,
  fetchCustomsTradeIndex,
  parseCustomsTradePublication,
} from '../scripts/ingest/fetch/customs-trade.ts';
import { normalizeCustomsTradeDataset } from '../scripts/ingest/normalize/customs-trade.ts';
import { validateCustomsTradeDataset } from '../scripts/ingest/validate/customs-trade.ts';
import { runCustomsTrade } from '../scripts/ingest/customs-trade-cli.ts';
import { getIndicatorData } from '../src/data/indicatorRegistry.ts';
import {
  CUSTOMS_TRADE_CONTRACTS,
  CUSTOMS_TRADE_METHODOLOGY_FINGERPRINT,
  HistoricalMismatchError,
  IngestionContractError,
} from '../scripts/ingest/types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(here, 'fixtures', 'customs-trade');
const publication = {
  title: "(1) China's Total Export & Import Values, Jul 2026(in CNY)",
  url: 'https://english.customs.gov.cn/Statics/5c578c33-7560-476b-a6af-9431fb3d41aa.html',
  sourceDate: '2026-08-10',
  coverage: '2026-07 to 2026-07',
};
const publicationHtml = fs.readFileSync(path.join(fixtureDir, 'publication-2026-07.html'), 'utf8');

function source(id, date, value) {
  const details = {
    '2026-02': ['d11e30df-faa3-4a4d-9816-bada832cafe8', '2026-03-08'],
    '2026-03': ['78463b33-7b5e-4e29-aee5-c65e42a69727', '2026-04-08'],
    '2026-04': ['d90956e5-f66c-46b5-80d7-a62e5097a073', '2026-05-08'],
    '2026-05': ['135af06e-2fd2-4ee9-8f7c-3978077e90a1', '2026-06-10'],
    '2026-06': ['142befa2-8638-4657-89d1-40209514b007', '2026-07-15'],
  }[date];
  return {
    title: `海关总署：China's Total Export & Import Values, ${date.slice(0, 7)} (in CNY)`,
    url: `https://english.customs.gov.cn/Statics/${details?.[0] ?? '5c578c33-7560-476b-a6af-9431fb3d41aa'}.html`,
    sourceDate: details?.[1] ?? '2026-08-10',
    coverage: `${date} to ${date}`,
    role: 'data',
    value,
    id,
  };
}

function dataset(id, dates = ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06']) {
  const values = id === 'exports' ? [36.1, -0.7, 9.8, 13.8, 20.8] : [10.9, 23.8, 20.6, 21.5, 29.4];
  const sources = dates.map((date) => {
    const index = ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06'].indexOf(date);
    return source(id, date, values[index]);
  });
  return {
    id,
    country: 'CN',
    frequency: 'monthly',
    unit: '%',
    metric: 'yoy',
    label: CUSTOMS_TRADE_CONTRACTS[id].sourceTitle,
    chartTitle: CUSTOMS_TRADE_CONTRACTS[id].sourceTitle,
    source: 'GACC',
    calculation: 'published',
    updatedAt: sources.at(-1).sourceDate,
    comparabilityNote: '海关总署人民币计价的全国货物贸易月度同比，不是美元、累计同比、服务贸易或国际收支口径。',
    methodologyFingerprint: CUSTOMS_TRADE_METHODOLOGY_FINGERPRINT,
    sources,
    data: dates.map((date, index) => ({ date, value: values[index] })),
  };
}

test('Customs contracts are separate national goods-trade RMB monthly YoY series', () => {
  assert.deepEqual(Object.keys(CUSTOMS_TRADE_CONTRACTS), ['exports', 'imports']);
  for (const contract of Object.values(CUSTOMS_TRADE_CONTRACTS)) {
    assert.equal(contract.frequency, 'monthly');
    assert.equal(contract.unit, '%');
    assert.equal(contract.metric, 'yoy');
    assert.equal(contract.calculation, 'published');
  }
  assert.match(CUSTOMS_TRADE_CONTRACTS.exports.sourceTitle, /出口/);
  assert.match(CUSTOMS_TRADE_CONTRACTS.imports.sourceTitle, /进口/);
});

test('discovers only the exact national RMB total publication', () => {
  const index = [
    '<a href="/Statics/jul-usd.html">China\'s Total Export &amp; Import Values, Jul 2026 (in USD)</a> 2026-08-07',
    '<a href="/Statics/jul-country.html">China\'s Total Export &amp; Import Values by Country/Region, Jul 2026 (in CNY)</a> 2026-08-07',
    '<a href="/Statics/jul-cny.html">China\'s Total Export &amp; Import Values, Jul 2026 (in CNY)</a> 2026-08-07',
    '<a href="/Statics/jun-cny.html">China\'s Total Export &amp; Import Values, Jun 2026 (in CNY)</a> 2026-07-14',
  ].join(' ');
  const publications = discoverCustomsTradePublications(index);
  assert.deepEqual(publications.map(({ coverage }) => coverage), ['2026-06 to 2026-06', '2026-07 to 2026-07']);
  assert.equal(discoverLatestCustomsTradePublication(index).url, 'https://english.customs.gov.cn/Statics/jul-cny.html');
  assert.equal(discoverLatestCustomsTradePublication(index.replaceAll('2026-08-07', '2026/08/07')).sourceDate, '2026-08-07');
  assert.throws(
    () => discoverCustomsTradePublications(`${index} <a href="/Statics/jun-other-cny.html">China's Total Export &amp; Import Values, Jun 2026 (in CNY)</a> 2026-07-14`),
    IngestionContractError,
  );
});

test('hydrates the release date from the linked Preliminary Release page', () => {
  const discovered = discoverLatestCustomsTradePublication(fs.readFileSync(path.join(fixtureDir, 'publication-index.html'), 'utf8'));
  assert.equal(discovered.url, publication.url);
  assert.equal(discovered.sourceDate, '');
  const raw = parseCustomsTradePublication(discovered, publicationHtml);
  assert.equal(raw.publication.sourceDate, '2026-08-10');
  assert.equal(raw.dataSources[0].url, publication.url);
  assert.throws(
    () => parseCustomsTradePublication({ ...discovered, sourceDate: '2026-08-11' }, publicationHtml),
    /disagrees with its page/,
  );
});

test('keeps the HTTPS listing primary and supports the official legacy HTTP endpoint', async () => {
  const calls = [];
  const html = fs.readFileSync(path.join(fixtureDir, 'publication-index.html'), 'utf8');
  const fetched = await fetchCustomsTradeIndex(async (url) => {
    calls.push(url);
    if (url.startsWith('https://')) throw new Error('simulated TLS failure');
    return html;
  });
  assert.equal(fetched, html);
  assert.deepEqual(calls, [
    'https://english.customs.gov.cn/Statistics/Statistics?ColumnId=1&page=1',
    'http://english.customs.gov.cn/Statistics/Statistics?ColumnId=1&page=1',
  ]);
});

test('parses exact national export and import monthly YoY values and ignores cumulative YoY', () => {
  const raw = parseCustomsTradePublication(publication, publicationHtml);
  assert.deepEqual(raw.values, { exports: 17.8, imports: 21.2 });
  assert.deepEqual(raw.observations, {
    exports: { date: '2026-07', value: 17.8 },
    imports: { date: '2026-07', value: 21.2 },
  });
  assert.equal(raw.methodologyFingerprint, CUSTOMS_TRADE_METHODOLOGY_FINGERPRINT);
  assert.equal(raw.dataSources[0].role, 'data');
  assert.equal(raw.dataSources[0].sourceDate, '2026-08-10');
});

test('fails closed for USD, cumulative-only, regional, duplicate, malformed, and wrong-month tables', () => {
  assert.throws(
    () => parseCustomsTradePublication(publication, publicationHtml.replaceAll('CNY', 'USD')),
    /RMB table/,
  );
  assert.throws(
    () => parseCustomsTradePublication(publication, publicationHtml.replace('Month-on-Month %', 'Cumulative Year-on-Year %')),
    /monthly YoY and a cumulative YoY/,
  );
  assert.throws(
    () => parseCustomsTradePublication(publication, publicationHtml.replace('Total Import', 'Regional Import')),
    /national export\/import total table/,
  );
  assert.throws(
    () => parseCustomsTradePublication(publication, publicationHtml.replace('</table>', '<tr><td>Total Export</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr></table>')),
    /duplicate national export/,
  );
  assert.throws(
    () => parseCustomsTradePublication(publication, publicationHtml.replace('17.8', 'n/a')),
    /unambiguous monthly export YoY/,
  );
  assert.throws(
    () => parseCustomsTradePublication(publication, publicationHtml.replace('<th>7</th>', '<th>6</th>')),
    /table month does not match/,
  );
});

test('validates dataset identity, official provenance, source coverage, and continuity', () => {
  const exports = dataset('exports');
  assert.doesNotThrow(() => validateCustomsTradeDataset(exports, 'exports'));
  assert.throws(() => validateCustomsTradeDataset({ ...exports, source: 'SAFE' }, 'exports'), /source must be GACC/);
  assert.throws(() => validateCustomsTradeDataset({ ...exports, unit: 'USD' }, 'exports'), /unit must be %/);
  assert.throws(() => validateCustomsTradeDataset({ ...exports, data: [exports.data[0], exports.data[2]] }, 'exports'), /continuous/);
  assert.throws(() => validateCustomsTradeDataset({ ...exports, sources: exports.sources.map((item) => ({ ...item, url: 'https://example.com/data' })) }, 'exports'), /official GACC source/);
  assert.throws(() => validateCustomsTradeDataset({ ...exports, comparabilityNote: '官方月度同比。' }, 'exports'), /goods trade/);
});

test('normalizes both directions, preserves provenance, protects overlap, and is idempotent', () => {
  const raw = parseCustomsTradePublication(publication, publicationHtml);
  const normalized = normalizeCustomsTradeDataset(raw, dataset('exports'), 'exports');
  assert.deepEqual(normalized.data.at(-1), { date: '2026-07', value: 17.8 });
  assert.equal(normalized.updatedAt, '2026-08-10');
  assert.equal(normalized.sources.at(-1).coverage, '2026-07 to 2026-07');
  assert.deepEqual(normalizeCustomsTradeDataset(raw, normalized, 'exports'), normalized);
  const changed = parseCustomsTradePublication(publication, publicationHtml.replace('17.8', '18.8'));
  assert.throws(
    () => normalizeCustomsTradeDataset(changed, normalized, 'exports'),
    HistoricalMismatchError,
  );
  assert.throws(
    () => normalizeCustomsTradeDataset(raw, dataset('imports'), 'exports'),
    /id mismatch|exports/,
  );
});

test('fixture CLI fetches one shared publication and atomically writes both datasets idempotently', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'macrolens-customs-'));
  const targetDir = path.join(directory, 'indicators');
  fs.mkdirSync(targetDir);
  fs.writeFileSync(path.join(targetDir, 'exports.json'), `${JSON.stringify(dataset('exports'), null, 2)}\n`);
  fs.writeFileSync(path.join(targetDir, 'imports.json'), `${JSON.stringify(dataset('imports'), null, 2)}\n`);
  const first = await runCustomsTrade([
    '--fixture-index', path.join(fixtureDir, 'fixture-index.json'),
    '--fixture-dir', fixtureDir,
    '--target-dir', targetDir,
  ]);
  assert.equal(first.changed, true);
  const firstExports = fs.readFileSync(path.join(targetDir, 'exports.json'), 'utf8');
  const firstImports = fs.readFileSync(path.join(targetDir, 'imports.json'), 'utf8');
  assert.equal(JSON.parse(firstExports).data.at(-1).value, 17.8);
  assert.equal(JSON.parse(firstImports).data.at(-1).value, 21.2);
  const second = await runCustomsTrade([
    '--fixture-index', path.join(fixtureDir, 'fixture-index.json'),
    '--fixture-dir', fixtureDir,
    '--target-dir', targetDir,
  ]);
  assert.equal(second.changed, false);
  assert.equal(fs.readFileSync(path.join(targetDir, 'exports.json'), 'utf8'), firstExports);
  assert.equal(fs.readFileSync(path.join(targetDir, 'imports.json'), 'utf8'), firstImports);
});

test('registers both indicators, attaches concept charts, and schedules the GACC updater', () => {
  for (const id of ['exports', 'imports']) {
    const indicator = getIndicatorData(id);
    assert.equal(indicator.id, id);
    assert.equal(indicator.source, 'GACC');
    assert.equal(indicator.data.at(-1).date, '2026-07');
    const concept = fs.readFileSync(path.join(here, '..', 'src', 'content', 'concepts', `${id}.md`), 'utf8');
    assert.match(concept, new RegExp(`^chart: ${id}$`, 'm'));
  }
  const workflow = fs.readFileSync(path.join(here, '..', '.github', 'workflows', 'update-macro-data.yml'), 'utf8');
  assert.match(workflow, /npm run ingest:customs-trade/);
  assert.match(workflow, /data\/indicators\/exports\.json/);
  assert.match(workflow, /data\/indicators\/imports\.json/);
});
