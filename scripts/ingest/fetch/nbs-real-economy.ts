import { IngestionContractError, MethodologyMismatchError } from '../types.ts';
import { REAL_ECONOMY_METHODOLOGY_FINGERPRINTS } from '../types.ts';
import type {
  NbsRealEconomyPublication,
  Observation,
  RawNbsRealEconomySeries,
  RealEconomyContract,
} from '../types.ts';
import { validateRealEconomyObservations } from '../validate/real-economy.ts';

type NbsDataNode = {
  wds?: Array<{ wdcode?: string; valuecode?: string; value?: string }>;
  data?: { hasdata?: boolean; data?: string | number };
};

type NbsPayload = {
  series?: {
    title?: string;
    code?: string;
    unit?: string;
    frequency?: string;
    scope?: string;
    priceTreatment?: string;
    publicationPattern?: string;
  };
  returndata?: { datanodes?: NbsDataNode[] };
};

function fail(message: string): never {
  throw new IngestionContractError(message);
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function normalizePeriod(value: string, contract: RealEconomyContract): string {
  const compact = value.replace(/\s+/g, '');
  if (contract.periodKind === 'quarterly') {
    const canonical = compact.match(/^(\d{4})-Q([1-4])$/);
    if (canonical) return canonical[0];
    const chinese = compact.match(/^(\d{4})年([1-4])季度$/);
    if (chinese) return chinese[1] + '-Q' + chinese[2];
    fail('Invalid NBS quarter: ' + value);
  }

  const canonicalMonth = compact.match(/^(\d{4})-(\d{2})$/);
  if (canonicalMonth && Number(canonicalMonth[2]) >= 3) return canonicalMonth[0];
  const canonicalCombined = compact.match(/^(\d{4})-01–(\d{2})$/);
  if (canonicalCombined && Number(canonicalCombined[2]) >= 2) {
    return contract.periodKind === 'cumulative-yoy' ? canonicalCombined[0] : canonicalCombined[1] + '-01–02';
  }

  const chinese = compact.match(/^(\d{4})年(\d{1,2})(?:[—-](\d{1,2}))?月$/);
  if (!chinese) fail('Invalid NBS period: ' + value);
  const year = chinese[1];
  const firstMonth = Number(chinese[2]);
  const lastMonth = chinese[3] ? Number(chinese[3]) : firstMonth;
  if (firstMonth < 1 || firstMonth > 12 || lastMonth < firstMonth || lastMonth > 12) {
    fail('Invalid NBS month period: ' + value);
  }
  if (contract.periodKind === 'cumulative-yoy') {
    if (firstMonth !== 1 || lastMonth < 2) fail('Invalid cumulative NBS period: ' + value);
    return year + '-01–' + String(lastMonth).padStart(2, '0');
  }
  if (firstMonth === 1 && lastMonth === 2) return year + '-01–02';
  if (firstMonth < 3 || lastMonth !== firstMonth) fail('Invalid monthly NBS period: ' + value);
  return year + '-' + String(firstMonth).padStart(2, '0');
}

function requireObservableMethodology(series: NonNullable<NbsPayload['series']>, contract: RealEconomyContract): void {
  const title = series.title ?? '';
  const scope = series.scope ?? '';
  const priceTreatment = series.priceTreatment ?? '';
  const publicationPattern = series.publicationPattern ?? '';
  const checks = contract.id === 'gdp'
    ? [
      ['GDP title', title.includes('国内生产总值') && title.includes('同比')],
      ['GDP constant-price treatment', /不变价|不变价格/.test(priceTreatment)],
      ['GDP quarterly publication pattern', publicationPattern.includes('季度')],
    ]
    : contract.id === 'industrial-production'
      ? [
        ['industrial title', title.includes('规模以上工业增加值') && title.includes('同比')],
        ['industrial scope', scope.includes('规模以上工业')],
        ['industrial real treatment', /扣除价格因素|实际/.test(priceTreatment)],
        ['industrial Jan-Feb publication pattern', /1[—-]2月/.test(publicationPattern)],
      ]
      : contract.id === 'retail-sales'
        ? [
          ['retail title', title.includes('社会消费品零售总额') && title.includes('同比')],
          ['retail scope', scope.includes('社会消费品零售总额')],
          ['retail nominal treatment', priceTreatment.includes('现价')],
          ['retail Jan-Feb publication pattern', /1[—-]2月/.test(publicationPattern)],
        ]
        : [
          ['investment title', title.includes('固定资产投资') && title.includes('不含农户')],
          ['investment comparable treatment', /可比口径/.test(priceTreatment)],
          ['investment cumulative publication pattern', /累计/.test(publicationPattern)],
        ];
  const missing = checks.find((entry) => !entry[1]);
  if (missing) throw new MethodologyMismatchError('NBS methodology contract missing or changed: ' + missing[0]);
}

function metadataCodeSet(code: string): Set<string> {
  return new Set(code.split(',').map((value) => value.trim()).filter(Boolean));
}

export function parseNbsRealEconomyResponse(
  payload: unknown,
  publication: NbsRealEconomyPublication,
  contract: RealEconomyContract,
): RawNbsRealEconomySeries {
  if (!payload || typeof payload !== 'object') fail('NBS response must be an object');
  if (!validIsoDate(publication.sourceDate)) fail('Invalid NBS publication date: ' + publication.sourceDate);
  const parsedUrl = new URL(publication.url);
  if (!['data.stats.gov.cn', 'www.stats.gov.cn'].includes(parsedUrl.hostname)) {
    fail('NBS publication is not hosted by an official NBS origin: ' + publication.url);
  }
  const candidate = payload as NbsPayload;
  const series = candidate.series;
  const nodes = candidate.returndata?.datanodes;
  if (!series || !Array.isArray(nodes) || nodes.length === 0) fail('NBS response is missing series metadata or data nodes');
  if (!series.title || !series.code || series.unit !== contract.unit || series.frequency !== contract.frequency) {
    fail('NBS series metadata does not match the ' + contract.id + ' contract');
  }
  const declaredCodes = metadataCodeSet(series.code);
  if (![...declaredCodes].every((code) => contract.sourceCodes.includes(code))) {
    fail('NBS series declares unsupported code: ' + series.code);
  }
  requireObservableMethodology(series, contract);

  const observations: Observation[] = [];
  const seen = new Set<string>();
  const codes = new Set<string>();
  for (const node of nodes) {
    const periodValue = node.wds?.find((wd) => wd.wdcode === 'sj')?.valuecode;
    const seriesCode = node.wds?.find((wd) => wd.wdcode === 'zb')?.valuecode;
    if (!periodValue || !seriesCode || !contract.sourceCodes.includes(seriesCode)) {
      fail('NBS data node does not match the ' + contract.id + ' series contract');
    }
    if (!node.data?.hasdata) fail('NBS value is missing for ' + periodValue);
    const rawValue = node.data.data;
    const valueText = String(rawValue ?? '').trim();
    if (!/^-?\d+(?:\.\d+)?$/.test(valueText)) fail('Invalid numeric NBS value for ' + periodValue + ': ' + valueText);
    const date = normalizePeriod(periodValue, contract);
    if (seen.has(date)) fail('Duplicate NBS period: ' + date);
    seen.add(date);
    codes.add(seriesCode);
    observations.push({ date, value: Number(valueText) });
  }
  observations.sort((left, right) => left.date.localeCompare(right.date));
  validateRealEconomyObservations(observations, contract.id);
  return {
    publication,
    id: contract.id,
    seriesCode: [...codes].join(','),
    seriesTitle: series.title,
    unit: series.unit,
    frequency: series.frequency,
    methodologyFingerprint: REAL_ECONOMY_METHODOLOGY_FINGERPRINTS[contract.id],
    observations,
  };
}

export async function fetchNbsRealEconomySeries(
  publication: NbsRealEconomyPublication,
  contract: RealEconomyContract,
): Promise<RawNbsRealEconomySeries> {
  const response = await fetch(publication.url, {
    headers: { 'user-agent': 'MacroLens-data-ingestion/1.0' },
  });
  if (!response.ok) throw new Error('NBS request failed ' + response.status + ': ' + publication.url);
  return parseNbsRealEconomyResponse(await response.json(), publication, contract);
}
