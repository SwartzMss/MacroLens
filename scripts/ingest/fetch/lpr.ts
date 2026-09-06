import { IngestionContractError } from '../types.ts';
import type { LprPublication, RawLprPublication } from '../types.ts';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_PATTERN = /^\d+(?:\.\d+)?$/;

function csvRows(csv: string): string[][] {
  return csv.split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    const fields: string[] = [];
    let field = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"') {
        if (quoted && line[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = !quoted;
      } else if (character === ',' && !quoted) {
        fields.push(field.trim());
        field = '';
      } else field += character;
    }
    fields.push(field.trim());
    return fields;
  });
}

function parseDate(value: string): string {
  if (!DATE_PATTERN.test(value) || Number.isNaN(new Date(`${value}T00:00:00Z`).valueOf())) {
    throw new IngestionContractError(`Invalid LPR publication date: ${value}`);
  }
  return value;
}

function parseValue(value: string, label: string, date: string): number {
  if (!NUMBER_PATTERN.test(value)) throw new IngestionContractError(`Invalid ${label} LPR value for ${date}: ${value}`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 20) throw new IngestionContractError(`Invalid ${label} LPR value for ${date}: ${value}`);
  return parsed;
}

function unwrapCsv(payload: string | { data?: { csv?: string } }): string {
  const parsed = typeof payload === 'string' ? JSON.parse(payload) as { data?: { csv?: string } } : payload;
  const csv = parsed.data?.csv;
  if (typeof csv !== 'string' || csv.trim() === '') throw new IngestionContractError('LPR response does not contain data.csv');
  return csv;
}

export function parseLprHistoryResponse(
  payload: string | { data?: { csv?: string } },
  url: string,
): RawLprPublication[] {
  if (!/^https:\/\/(?:www\.)?chinamoney\.com\.cn\//.test(url)) {
    throw new IngestionContractError(`LPR source must be the official ChinaMoney host: ${url}`);
  }
  const rows = csvRows(unwrapCsv(payload));
  let firstDataRow = 0;
  if (rows[0] && !DATE_PATTERN.test(rows[0][0])) {
    const header = rows[0].map((value) => value.toLowerCase());
    const oneYearHeader = header[6] ?? '';
    const fiveYearHeader = header[7] ?? '';
    if (!['date', '日期'].includes(header[0]) || !/(lpr1y|1年期|1y)/i.test(oneYearHeader) || !/(lpr5y|5年期|5y)/i.test(fiveYearHeader)) {
      throw new IngestionContractError('LPR response tenor columns are missing or renamed');
    }
    firstDataRow = 1;
  }
  const publications: RawLprPublication[] = [];
  const seenMonths = new Set<string>();
  for (const row of rows.slice(firstDataRow)) {
    if (row.length < 8) throw new IngestionContractError(`Malformed LPR row: expected 8 columns, got ${row.length}`);
    const sourceDate = parseDate(row[0]);
    const month = sourceDate.slice(0, 7);
    if (seenMonths.has(month)) throw new IngestionContractError(`Duplicate LPR publication month: ${month}`);
    const values = { '1y': parseValue(row[6], '1Y', sourceDate), '5y-plus': parseValue(row[7], '5Y+', sourceDate) } as const;
    if (values['1y'] > values['5y-plus']) throw new IngestionContractError(`LPR 1Y exceeds 5Y+ for ${sourceDate}`);
    seenMonths.add(month);
    const publication: LprPublication = {
      title: '中国货币网 LPR 历史数据',
      url,
      sourceDate,
      month,
    };
    publications.push({ publication, values });
  }
  if (publications.length === 0) throw new IngestionContractError('LPR response contains no publications');
  publications.sort((left, right) => left.publication.month.localeCompare(right.publication.month));
  return publications;
}
