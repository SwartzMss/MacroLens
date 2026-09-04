import { IngestionContractError, MethodologyMismatchError } from '../types.ts';
import {
  REAL_ECONOMY_METHODOLOGY_FINGERPRINTS,
} from '../types.ts';
import type {
  IndicatorSource,
  NbsRealEconomyPublication,
  Observation,
  RawNbsRealEconomySeries,
  RealEconomyContract,
  RealEconomyDatasetId,
  RealEconomySeriesRule,
} from '../types.ts';
import { fetchText } from '../fetch-text.ts';
import type { FetchTextOptions } from '../fetch-text.ts';
import { validateRealEconomyObservations } from '../validate/real-economy.ts';

const NBS_INDEX = 'https://www.stats.gov.cn/sj/zxfb/';
const NBS_ORIGIN = 'https://www.stats.gov.cn';
const NBS_DATA_ORIGIN = 'https://data.stats.gov.cn';
const NBS_STRUCTURED_DATA_ENDPOINT = `${NBS_DATA_ORIGIN}/dg/website/publicrelease/web/external/stream/esData`;
const NBS_MONTHLY_ROOT_ID = 'fc982599aa684be7969d7b90b1bd0e84';
const NBS_NATIONAL_AREA = { text: '全国', value: '000000000000' };
const NBS_FIRST_MONTH = '201101';
type TextFetcher = (url: string, options?: FetchTextOptions) => Promise<string>;

type NbsStructuredValue = {
  _id?: string;
  value?: string | number | null;
  _name?: string;
  i_showname?: string;
  du_name?: string;
};

type NbsStructuredRow = {
  code?: string;
  name?: string;
  values?: NbsStructuredValue[];
};

type NbsStructuredPayload = {
  success?: boolean;
  state?: number;
  message?: string;
  data?: NbsStructuredRow[];
};

type StructuredSeriesMapping = {
  cid: string;
  indicators: Record<string, { id: string; title: string }>;
};

const NBS_STRUCTURED_MAPPINGS: Partial<Record<RealEconomyDatasetId, StructuredSeriesMapping>> = {
  'industrial-production': {
    cid: '3f2e14f0542348ed9fe02476eca3450b',
    indicators: {
      A020101: { id: 'ef1b1765960d45a29b4d7c4ca91be916', title: '规上工业增加值同比增长 (%)' },
      A020102: { id: '21e7072e9f384209aedb56e69a18216e', title: '规上工业增加值累计增长 (%)' },
    },
  },
  'retail-sales': {
    cid: 'd0cb882c7f27443ab6b3ef9421901961',
    indicators: {
      A070103: { id: 'aaac57d54d2e465d91bc9f3ea1a8618e', title: '社会消费品零售总额同比增长 (%)' },
      A070104: { id: 'e3ca151b53d347b78d1e179e5ebf1d33', title: '社会消费品零售总额累计增长 (%)' },
    },
  },
  'fixed-asset-investment': {
    cid: '5129067b149d4ddfbec1ffc478d35bfb',
    indicators: {
      A040102: { id: '7e570cf8071c4734a7d78d9f0a70fbe1', title: '固定资产投资额累计增长 (%)' },
    },
  },
};

type NbsDataNode = {
  wds?: Array<{ wdcode?: string; valuecode?: string; value?: string }>;
  data?: { hasdata?: boolean; data?: string | number };
};

type NbsDimensionNode = {
  code?: string;
  valuecode?: string;
  name?: string;
  value?: string;
};

type NbsDimension = {
  wdcode?: string;
  wdname?: string;
  nodes?: NbsDimensionNode[];
};

type NbsPayload = {
  series?: {
    title?: string;
    code?: string;
    unit?: string;
    frequency?: string;
  };
  returndata?: { datanodes?: NbsDataNode[]; wdnodes?: NbsDimension[] };
};

function fail(message: string): never {
  throw new IngestionContractError(message);
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function cellsOf(rowHtml: string): string[] {
  return [...rowHtml.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((match) => canonical(textOf(match[1])));
}

function canonical(value: string): string {
  return value.replace(/\s+/g, '').replace(/[—－]/g, '-');
}

function publicationTitlePattern(id: RealEconomyDatasetId): RegExp {
  if (id === 'gdp') return /国内生产总值.*初步核算结果/;
  if (id === 'industrial-production') return /规模以上工业增加值/;
  if (id === 'retail-sales') return /社会消费品零售总额/;
  return /固定资产投资/;
}

const REAL_ECONOMY_DATASET_IDS: RealEconomyDatasetId[] = [
  'gdp',
  'industrial-production',
  'retail-sales',
  'fixed-asset-investment',
];

function discoverRealEconomyPublicationCandidates(
  indexHtml: string,
  id: RealEconomyDatasetId,
): NbsRealEconomyPublication[] {
  const candidates: NbsRealEconomyPublication[] = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of indexHtml.matchAll(anchorPattern)) {
    const title = textOf(match[2]);
    if (!publicationTitlePattern(id).test(title) || title.includes('解读')) continue;
    const afterAnchor = indexHtml.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 500);
    const dateMatch = afterAnchor.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (!dateMatch || !validIsoDate(dateMatch[1])) fail(`Publication date missing or invalid for: ${title}`);
    const url = new URL(match[1], NBS_INDEX).toString();
    if (new URL(url).origin !== NBS_ORIGIN) fail(`NBS publication is not hosted by stats.gov.cn: ${url}`);
    candidates.push({ title, url, sourceDate: dateMatch[1], coverage: publicationCoverageFromTitle(title, id) });
  }
  return candidates;
}

export function discoverLatestRealEconomyPublication(
  indexHtml: string,
  id: RealEconomyDatasetId,
): NbsRealEconomyPublication {
  const candidates = discoverRealEconomyPublicationCandidates(indexHtml, id);
  if (candidates.length === 0) fail(`No NBS publication matching ${id}`);
  return candidates.sort((left, right) => right.sourceDate.localeCompare(left.sourceDate))[0];
}

function buildNbsQueryUrlForCode(code: string): string {
  const query = new URL('https://data.stats.gov.cn/easyquery.htm');
  query.searchParams.set('m', 'QueryData');
  query.searchParams.set('dbcode', 'hgyd');
  query.searchParams.set('rowcode', 'sj');
  query.searchParams.set('colcode', 'zb');
  query.searchParams.set('wds', '[]');
  query.searchParams.set('dfwds', JSON.stringify([{ wdcode: 'zb', valuecode: code }]));
  query.searchParams.set('h', '1');
  return query.toString();
}

export function buildNbsQueryUrls(contract: RealEconomyContract): Record<string, string> {
  if (contract.sourceKind !== 'national-data') fail(`National Data URL requested for ${contract.id}`);
  return Object.fromEntries(contract.sourceCodes.map((code) => [code, buildNbsQueryUrlForCode(code)]));
}

function structuredMappingFor(contract: RealEconomyContract): StructuredSeriesMapping {
  if (contract.sourceKind !== 'national-data') fail(`Structured National Data requested for ${contract.id}`);
  const mapping = NBS_STRUCTURED_MAPPINGS[contract.id];
  if (!mapping) fail(`No official structured National Data mapping for ${contract.id}`);
  for (const code of contract.sourceCodes) {
    if (!mapping.indicators[code]) fail(`Official structured National Data mapping is missing ${code}`);
  }
  return mapping;
}

function structuredPeriodRange(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${NBS_FIRST_MONTH}MM-${year}${month}MM`;
}

function buildStructuredPageUrl(
  mapping: StructuredSeriesMapping,
  code: string,
  periodRange: string,
): string {
  const indicator = mapping.indicators[code];
  if (!indicator) fail(`Official structured National Data mapping is missing ${code}`);
  const url = new URL(`${NBS_DATA_ORIGIN}/dg/website/page.html`);
  url.searchParams.set('cid', mapping.cid);
  url.searchParams.set('indicatorId', indicator.id);
  url.searchParams.set('dts', periodRange);
  url.hash = '/pc/national/monthData';
  return url.toString();
}

type StructuredDataRequest = {
  url: string;
  options: FetchTextOptions;
  dataUrls: Record<string, string>;
  requests: Record<string, NonNullable<IndicatorSource['request']>>;
  mapping: StructuredSeriesMapping;
};

function buildStructuredDataRequest(contract: RealEconomyContract, now = new Date()): StructuredDataRequest {
  const mapping = structuredMappingFor(contract);
  const periodRange = structuredPeriodRange(now);
  const dataUrls = Object.fromEntries(contract.sourceCodes.map((code) => [
    code,
    buildStructuredPageUrl(mapping, code, periodRange),
  ]));
  const body = {
    cid: mapping.cid,
    indicatorIds: contract.sourceCodes.map((code) => mapping.indicators[code].id),
    daCatalogId: '',
    das: [NBS_NATIONAL_AREA],
    showType: '1',
    dts: [periodRange],
    rootId: NBS_MONTHLY_ROOT_ID,
  };
  const bodyText = JSON.stringify(body);
  const requests = Object.fromEntries(contract.sourceCodes.map((code) => [
    code,
    { url: NBS_STRUCTURED_DATA_ENDPOINT, method: 'POST' as const, body: bodyText },
  ]));
  return {
    url: NBS_STRUCTURED_DATA_ENDPOINT,
    options: {
      method: 'POST',
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json',
        referer: `${NBS_DATA_ORIGIN}/dg/website/page.html`,
      },
      body: bodyText,
    },
    dataUrls,
    requests,
    mapping,
  };
}

function publicationCoverageFromTitle(title: string, id: RealEconomyDatasetId): string {
  if (id === 'gdp') return '';
  const canonicalTitle = canonical(title);
  const annualFixedAssetMatch = canonicalTitle.match(/^(\d{4})年全国固定资产投资基本情况/);
  if (id === 'fixed-asset-investment' && annualFixedAssetMatch) {
    const period = `${annualFixedAssetMatch[1]}-01–12`;
    return `${period} to ${period}`;
  }
  const halfYearMatch = canonicalTitle.match(/^(\d{4})年上半年/);
  if (id === 'retail-sales' && halfYearMatch) {
    return `${halfYearMatch[1]}-06 to ${halfYearMatch[1]}-06`;
  }
  const match = canonicalTitle.match(/^(\d{4})年(\d{1,2})(?:-(\d{1,2}))?月份/);
  if (!match) fail(`NBS publication title has no period: ${title}`);
  const year = match[1];
  const startMonth = Number(match[2]);
  const endMonth = Number(match[3] ?? match[2]);
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12 || !Number.isInteger(endMonth) || endMonth < startMonth || endMonth > 12) {
    fail(`NBS publication title has invalid period: ${title}`);
  }
  const period = startMonth === 1 && endMonth === 2
    ? `${year}-01–02`
    : id === 'fixed-asset-investment'
      ? `${year}-01–${String(endMonth).padStart(2, '0')}`
      : `${year}-${String(endMonth).padStart(2, '0')}`;
  return `${period} to ${period}`;
}

function metadataText(payload: NbsPayload, officialMethodologyText: string): string {
  return canonical(JSON.stringify({ series: payload.series, wdnodes: payload.returndata?.wdnodes }) + officialMethodologyText);
}

function requireNationalDataMethodology(payload: NbsPayload, contract: RealEconomyContract, officialMethodologyText: string): void {
  const text = metadataText(payload, officialMethodologyText);
  const checks: Array<[string, boolean]> = contract.id === 'industrial-production'
    ? [
      ['industrial series title', text.includes('规模以上工业增加值')],
      ['industrial YoY metric', text.includes('同比')],
      ['industrial real treatment', /扣除价格因素|实际|不变价格/.test(text)],
    ]
    : contract.id === 'retail-sales'
      ? [
        ['retail series title', text.includes('社会消费品零售总额')],
        ['retail YoY metric', text.includes('同比')],
        ['retail nominal treatment', /现价|名义/.test(text)],
      ]
      : [
        ['investment series title', text.includes('固定资产投资')],
        ['investment non-rural scope', text.includes('不含农户')],
        ['investment cumulative metric', text.includes('累计')],
        ['investment comparable treatment', /可比口径|不变价/.test(text)],
      ];
  const missing = checks.find((entry) => !entry[1]);
  if (missing) throw new MethodologyMismatchError('NBS methodology contract missing or changed: ' + missing[0]);
}

function nodeValue(node: NbsDataNode, code: string): string | undefined {
  return node.wds?.find((wd) => wd.wdcode === code)?.valuecode;
}

function nodeDisplayValue(node: NbsDataNode, code: string): string {
  return node.wds?.find((wd) => wd.wdcode === code)?.value ?? '';
}

function normalizeMonthlyWirePeriod(valuecode: string, display: string, rule: RealEconomySeriesRule): string | undefined {
  const compactCode = canonical(valuecode);
  const yearMatch = compactCode.match(/^(\d{4})/);
  const monthMatch = compactCode.match(/^(\d{4})(0[1-9]|1[0-2])$/);
  const displayMatch = canonical(display).match(/^(\d{4})年(\d{1,2})(?:-?(\d{1,2}))?月/);
  const year = yearMatch?.[1] ?? displayMatch?.[1];
  const month = monthMatch ? Number(monthMatch[2]) : displayMatch ? Number(displayMatch[2]) : undefined;
  const lastMonth = displayMatch?.[3] ? Number(displayMatch[3]) : month;
  if (!year || month === undefined) fail('Invalid NBS month wire value: ' + valuecode);
  const combinedDisplay = displayMatch?.[3] !== undefined && lastMonth === 2;
  if (rule === 'combined') {
    if (month !== 2 && !combinedDisplay) return undefined;
    return year + '-01–02';
  }
  if (rule === 'monthly') {
    if (month < 3 || combinedDisplay) return undefined;
    return year + '-' + String(month).padStart(2, '0');
  }
  const cumulativeEnd = lastMonth ?? month;
  if (cumulativeEnd < 2) fail('Cumulative NBS series returned an invalid period: ' + valuecode);
  return year + '-01–' + String(cumulativeEnd).padStart(2, '0');
}

function metadataCodeSet(code: string): Set<string> {
  return new Set(code.split(',').map((value) => value.trim()).filter(Boolean));
}

function parseNbsStructuredDataPayload(
  payload: unknown,
  contract: RealEconomyContract,
  mapping: StructuredSeriesMapping,
): NbsPayload {
  if (!payload || typeof payload !== 'object') fail('NBS structured response must be an object');
  const candidate = payload as NbsStructuredPayload;
  if (candidate.success !== true || candidate.state !== 20000) {
    fail(`NBS structured response was not successful: ${candidate.message ?? 'unknown response state'}`);
  }
  if (!Array.isArray(candidate.data) || candidate.data.length === 0) {
    fail('NBS structured response is missing data rows');
  }

  const indicatorById = new Map<string, { code: string; title: string }>();
  for (const code of contract.sourceCodes) {
    const indicator = mapping.indicators[code];
    if (!indicator) fail(`Official structured National Data mapping is missing ${code}`);
    indicatorById.set(indicator.id, { code, title: indicator.title });
  }
  const observedIndicatorIds = new Set<string>();
  const indicatorNames = new Map<string, string>();
  const timeNodes: NbsDimensionNode[] = [];
  const datanodes: NbsDataNode[] = [];
  for (const row of candidate.data) {
    const periodWireCode = row?.code;
    if (!row || typeof row !== 'object' || typeof periodWireCode !== 'string' || !/^\d{6}MM$/.test(periodWireCode) || !row.name || !Array.isArray(row.values)) {
      fail('NBS structured response contains an invalid time row');
    }
    const periodCode = periodWireCode.slice(0, -2);
    timeNodes.push({ code: periodCode, valuecode: periodCode, name: row.name });
    for (const value of row.values) {
      if (!value || typeof value !== 'object' || typeof value._id !== 'string') fail('NBS structured response contains an invalid indicator value');
      const indicator = indicatorById.get(value._id);
      if (!indicator) continue;
      if (typeof value.i_showname !== 'string' || !value.i_showname.includes(indicator.title.replace(/\s*\(%\)$/, ''))) {
        fail(`NBS structured indicator metadata changed for ${indicator.code}`);
      }
      if (value.du_name !== '%') fail(`NBS structured indicator unit changed for ${indicator.code}`);
      indicatorNames.set(indicator.code, value.i_showname.trim());
      const valueText = String(value.value ?? '').trim();
      if (!valueText) continue;
      if (!/^-?\d+(?:\.\d+)?$/.test(valueText)) fail(`Invalid numeric NBS structured value for ${periodWireCode}: ${valueText}`);
      observedIndicatorIds.add(value._id);
      datanodes.push({
        wds: [
          { wdcode: 'zb', valuecode: indicator.code },
          { wdcode: 'sj', valuecode: periodCode, value: row.name },
        ],
        data: { hasdata: true, data: valueText },
      });
    }
  }
  const missing = contract.sourceCodes
    .filter((code) => !observedIndicatorIds.has(mapping.indicators[code].id));
  if (missing.length > 0) fail(`NBS structured response is missing selected indicators: ${missing.join(',')}`);
  if (datanodes.length === 0) fail('NBS structured response contains no selected observations');
  return {
    series: {
      title: contract.sourceTitle,
      code: contract.sourceCodes.join(','),
      unit: contract.unit,
      frequency: contract.frequency,
    },
    returndata: {
      wdnodes: [
        {
          wdcode: 'zb',
          wdname: '指标',
          nodes: contract.sourceCodes.map((code) => ({
            code,
            valuecode: code,
            name: indicatorNames.get(code) ?? mapping.indicators[code].title,
          })),
        },
        { wdcode: 'sj', wdname: '时间', nodes: timeNodes },
      ],
      datanodes,
    },
  };
}

export function parseNbsRealEconomyResponse(
  payload: unknown,
  publication: NbsRealEconomyPublication,
  contract: RealEconomyContract,
  officialMethodologyText = '',
  dataUrls: Record<string, string> = buildNbsQueryUrls(contract),
  requests: Record<string, NonNullable<IndicatorSource['request']>> = {},
): RawNbsRealEconomySeries {
  if (!validIsoDate(publication.sourceDate)) fail('Invalid NBS publication date: ' + publication.sourceDate);
  const parsedUrl = new URL(publication.url);
  if (!['data.stats.gov.cn', 'www.stats.gov.cn'].includes(parsedUrl.hostname)) {
    fail('NBS publication is not hosted by an official NBS origin: ' + publication.url);
  }
  if (contract.sourceKind !== 'national-data') fail('National Data parser cannot parse ' + contract.id);
  const payloads = Array.isArray(payload) ? payload : [payload];
  const observations: Observation[] = [];
  const seen = new Set<string>();
  const codes = new Set<string>();
  const sourcePeriods = new Map<string, Set<string>>();
  let firstSeries: NbsPayload['series'];
  for (const rawPayload of payloads) {
    if (!rawPayload || typeof rawPayload !== 'object') fail('NBS response must be an object');
    const candidate = rawPayload as NbsPayload;
    const nodes = candidate.returndata?.datanodes;
    if (!Array.isArray(nodes) || nodes.length === 0) fail('NBS response is missing data nodes');
    requireNationalDataMethodology(candidate, contract, officialMethodologyText);
    firstSeries ??= candidate.series;
    const declaredCodes = candidate.series?.code ? metadataCodeSet(candidate.series.code) : new Set(contract.sourceCodes);
    if (![...declaredCodes].every((code) => contract.sourceCodes.includes(code))) {
      fail('NBS series declares unsupported code: ' + [...declaredCodes].join(','));
    }
    for (const node of nodes) {
      const periodValue = nodeValue(node, 'sj');
      const seriesCode = nodeValue(node, 'zb');
      if (!periodValue || !seriesCode || !contract.sourceCodes.includes(seriesCode)) {
        fail('NBS data node does not match the ' + contract.id + ' series contract');
      }
      const rule = contract.sourceCodeRules[seriesCode];
      if (!rule) fail('NBS series code has no period rule: ' + seriesCode);
      const date = normalizeMonthlyWirePeriod(periodValue, nodeDisplayValue(node, 'sj'), rule);
      if (!date) continue;
      if (!node.data?.hasdata) fail('NBS value is missing for ' + periodValue);
      const rawValue = node.data.data;
      const valueText = String(rawValue ?? '').trim();
      if (!/^-?\d+(?:\.\d+)?$/.test(valueText)) fail('Invalid numeric NBS value for ' + periodValue + ': ' + valueText);
      if (seen.has(date)) fail('Duplicate NBS period: ' + date);
      seen.add(date);
      codes.add(seriesCode);
      const periods = sourcePeriods.get(seriesCode) ?? new Set<string>();
      periods.add(date);
      sourcePeriods.set(seriesCode, periods);
      observations.push({ date, value: Number(valueText) });
    }
  }
  if (observations.length === 0) fail('NBS response contains no selected observations');
  observations.sort((left, right) => left.date.localeCompare(right.date));
  validateRealEconomyObservations(observations, contract.id, { requireYearStart: false });
  const first = observations[0];
  const last = observations.at(-1);
  if (!first || !last) fail('NBS response contains no observations');
  const dataSources: IndicatorSource[] = [...sourcePeriods.entries()].map(([code, periods]) => ({
    title: `国家统计局：国家数据（${code}）`,
    url: dataUrls[code] ?? buildNbsQueryUrlForCode(code),
    sourceDate: publication.sourceDate,
    coverage: [...periods].sort().map((date) => `${date} to ${date}`).join('; '),
    role: 'data',
    request: requests[code],
  }));
  return {
    publication,
    id: contract.id,
    seriesCode: [...codes].join(','),
    seriesTitle: firstSeries?.title ?? contract.sourceTitle,
    unit: firstSeries?.unit ?? contract.unit,
    frequency: firstSeries?.frequency ?? contract.frequency,
    methodologyFingerprint: REAL_ECONOMY_METHODOLOGY_FINGERPRINTS[contract.id],
    dataSources,
    observations,
  };
}

export function parseNbsGdpPublication(
  publication: NbsRealEconomyPublication,
  html: string,
): RawNbsRealEconomySeries {
  if (!validIsoDate(publication.sourceDate)) fail('Invalid NBS publication date: ' + publication.sourceDate);
  const parsedUrl = new URL(publication.url);
  if (parsedUrl.origin !== NBS_ORIGIN) fail('GDP publication is not hosted by stats.gov.cn: ' + publication.url);
  const compact = canonical(textOf(html));
  const methodologyChecks: Array<[string, boolean]> = [
    ['GDP release title', compact.includes('国内生产总值') && compact.includes('初步核算结果')],
    ['GDP YoY table', compact.includes('GDP同比增长速度')],
    ['GDP percent unit', /单位[:：]%/.test(compact)],
    ['GDP constant-price treatment', compact.includes('增长速度按不变价计算')],
    ['GDP YoY definition', compact.includes('同比增长速度为与上年同期对比')],
  ];
  const missing = methodologyChecks.find((entry) => !entry[1]);
  if (missing) throw new MethodologyMismatchError('GDP methodology contract missing or changed: ' + missing[0]);

  const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)];
  const table = tables.find((match) => {
    const tableText = canonical(textOf(match[0]));
    const beforeTable = canonical(textOf(html.slice(Math.max(0, (match.index ?? 0) - 1200), match.index ?? 0)));
    return (beforeTable + tableText).includes('GDP同比增长速度') && tableText.includes('年份') && tableText.includes('1季度');
  });
  if (!table) fail('GDP release is missing the GDP同比增长速度 table');
  const rows = [...table[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => cellsOf(match[1]));
  const header = rows.find((row) => row.includes('年份') && row.includes('1季度'));
  if (!header) fail('GDP YoY table is missing quarter headers');
  const yearColumn = header.indexOf('年份');
  const quarterColumns = [1, 2, 3, 4].map((quarter) => header.findIndex((cell) => cell.includes(`${quarter}季度`)));
  if (yearColumn < 0 || quarterColumns.some((column) => column < 0)) fail('GDP YoY table has an unexpected column layout');
  const observations: Observation[] = [];
  for (const row of rows) {
    const year = row[yearColumn];
    if (!year || !/^\d{4}$/.test(year)) continue;
    for (const [index, column] of quarterColumns.entries()) {
      const valueText = row[column]?.replace(/,/g, '').trim() ?? '';
      if (!valueText || !/^-?\d+(?:\.\d+)?$/.test(valueText)) continue;
      observations.push({ date: `${year}-Q${index + 1}`, value: Number(valueText) });
    }
  }
  if (observations.length === 0) fail('GDP release contains no GDP YoY observations');
  observations.sort((left, right) => left.date.localeCompare(right.date));
  validateRealEconomyObservations(observations, 'gdp', { requireYearStart: false });
  const first = observations[0];
  const last = observations.at(-1);
  if (!first || !last) fail('GDP release contains no observations');
  return {
    publication: { ...publication, coverage: `${first.date} to ${last.date}` },
    id: 'gdp',
    seriesCode: 'gdp-release-table-2',
    seriesTitle: 'GDP同比增长速度',
    unit: '%',
    frequency: 'quarterly',
    methodologyFingerprint: REAL_ECONOMY_METHODOLOGY_FINGERPRINTS.gdp,
    dataSources: [{
      title: '国家统计局：' + publication.title,
      url: publication.url,
      sourceDate: publication.sourceDate,
      coverage: `${first.date} to ${last.date}`,
      role: 'data',
    }],
    observations,
  };
}

async function fetchJson(url: string, fetcher: TextFetcher, options?: FetchTextOptions): Promise<unknown> {
  return JSON.parse(await fetcher(url, options));
}

const DEFAULT_MAX_PUBLICATION_INDEX_PAGES = 8;

export async function fetchNbsPublicationIndex(fetcher: TextFetcher = fetchText): Promise<string> {
  return fetcher(NBS_INDEX);
}

function publicationIndexPageUrl(page: number): string {
  return page === 0 ? NBS_INDEX : new URL(`index_${page}.html`, NBS_INDEX).toString();
}

export async function fetchNbsRealEconomyPublications(
  fetcher: TextFetcher = fetchText,
  maxPages = DEFAULT_MAX_PUBLICATION_INDEX_PAGES,
): Promise<Record<RealEconomyDatasetId, NbsRealEconomyPublication>> {
  if (!Number.isInteger(maxPages) || maxPages < 1) fail('NBS publication index page limit must be a positive integer');
  const latest = new Map<RealEconomyDatasetId, NbsRealEconomyPublication>();
  for (let page = 0; page < maxPages; page += 1) {
    const indexHtml = await fetcher(publicationIndexPageUrl(page));
    const candidatesByDataset = REAL_ECONOMY_DATASET_IDS.map((id) => [
      id,
      discoverRealEconomyPublicationCandidates(indexHtml, id),
    ] as const);
    for (const [id, candidates] of candidatesByDataset) {
      for (const candidate of candidates) {
        const current = latest.get(id);
        if (!current || candidate.sourceDate > current.sourceDate) latest.set(id, candidate);
      }
    }
    if (latest.size === REAL_ECONOMY_DATASET_IDS.length) {
      return Object.fromEntries(REAL_ECONOMY_DATASET_IDS.map((id) => [id, latest.get(id)])) as Record<RealEconomyDatasetId, NbsRealEconomyPublication>;
    }
  }
  const missing = REAL_ECONOMY_DATASET_IDS.filter((id) => !latest.has(id));
  fail(`No NBS publication matching ${missing.join(', ')} after scanning ${maxPages} pages`);
}

export async function fetchNbsRealEconomySeries(
  publication: NbsRealEconomyPublication,
  contract: RealEconomyContract,
  fetcher: TextFetcher = fetchText,
): Promise<RawNbsRealEconomySeries> {
  const request = buildStructuredDataRequest(contract);
  const [payload, officialMethodologyText] = await Promise.all([
    fetchJson(request.url, fetcher, request.options),
    fetcher(publication.url),
  ]);
  const adaptedPayload = parseNbsStructuredDataPayload(payload, contract, request.mapping);
  return parseNbsRealEconomyResponse(adaptedPayload, publication, contract, officialMethodologyText, request.dataUrls, request.requests);
}

export async function fetchNbsGdpPublication(
  publication: NbsRealEconomyPublication,
  fetcher: TextFetcher = fetchText,
): Promise<RawNbsRealEconomySeries> {
  return parseNbsGdpPublication(publication, await fetcher(publication.url));
}

export const nbsPublicationIndex = NBS_INDEX;
