export const INDICATOR_FREQUENCIES = ['monthly', 'quarterly', 'event'] as const;
export type IndicatorFrequency = typeof INDICATOR_FREQUENCIES[number];

export const INDICATOR_CHART_TYPES = ['step'] as const;
export type IndicatorChartType = typeof INDICATOR_CHART_TYPES[number];

export const INDICATOR_COMPARISON_TYPES = [
  'previous_event_level',
  'previous_month_same_metric',
  'previous_month_level',
  'previous_month_rate',
  'previous_quarter_same_metric',
  'previous_quarter_level',
  'previous_quarter_rate',
  'previous_cumulative_period',
] as const;
export type IndicatorComparisonType = typeof INDICATOR_COMPARISON_TYPES[number];

export type IndicatorSourceRole = 'data' | 'methodology';

export type IndicatorSource = {
  title: string;
  url: string;
  sourceDate: string;
  coverage: string;
  role?: IndicatorSourceRole;
  request?: {
    url: string;
    method: 'GET' | 'POST';
    body?: string;
  };
};

export type Observation = { date: string; value: number };

export type IndicatorSeries = {
  id: string;
  label: string;
  data: Observation[];
};

export type IndicatorDataset = {
  id: string;
  country: string;
  frequency: IndicatorFrequency;
  chartType?: IndicatorChartType;
  verifiedThrough?: string;
  unit: string;
  metric: string;
  comparisonType?: IndicatorComparisonType;
  label: string;
  chartTitle: string;
  definitionEffectiveFrom?: string;
  definitionAsOf?: string;
  source: string;
  calculation: string;
  calculationEffectiveFrom?: string;
  updatedAt: string;
  comparabilityNote: string;
  methodologyFingerprint: string;
  methodologyEffectiveFrom?: string;
  sources: IndicatorSource[];
  referenceValue?: number;
  referenceLabel?: string;
  data: Observation[];
  series?: IndicatorSeries[];
};

export type IndicatorDatasetValidationIssue = {
  path: Array<string | number>;
  message: string;
};

function formatPath(path: Array<string | number>): string {
  return path.reduce<string>((result, segment) => (
    typeof segment === 'number'
      ? `${result}[${segment}]`
      : result ? `${result}.${segment}` : segment
  ), '');
}

export class IndicatorDatasetValidationError extends Error {
  readonly issues: IndicatorDatasetValidationIssue[];

  constructor(indicatorId: string | undefined, issues: IndicatorDatasetValidationIssue[]) {
    const prefix = indicatorId ? `indicator "${indicatorId}": ` : 'indicator: ';
    super(issues.map(({ path, message }) => `${prefix}${formatPath(path)} ${message}`).join('\n'));
    this.name = 'IndicatorDatasetValidationError';
    this.issues = issues;
  }
}

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOneOf<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

function validateObservationArray(
  input: unknown,
  path: Array<string | number>,
  issues: IndicatorDatasetValidationIssue[],
): void {
  if (!Array.isArray(input)) {
    issues.push({ path, message: 'must be an array' });
    return;
  }
  for (let index = 0; index < input.length; index += 1) {
    const observationPath = [...path, index];
    const observation = input[index];
    if (!isRecord(observation)) {
      issues.push({ path: observationPath, message: 'must be an object' });
      continue;
    }
    if (!isNonEmptyString(observation.date)) {
      issues.push({ path: [...observationPath, 'date'], message: 'must be a non-empty string' });
    }
    if (typeof observation.value !== 'number' || !Number.isFinite(observation.value)) {
      issues.push({ path: [...observationPath, 'value'], message: 'must be a finite number' });
    }
  }
}

function validateSource(
  input: unknown,
  path: Array<string | number>,
  issues: IndicatorDatasetValidationIssue[],
): void {
  if (!isRecord(input)) {
    issues.push({ path, message: 'must be an object' });
    return;
  }
  for (const field of ['title', 'sourceDate', 'coverage'] as const) {
    if (!isNonEmptyString(input[field])) {
      issues.push({ path: [...path, field], message: 'must be a non-empty string' });
    }
  }
  if (!isNonEmptyString(input.url) || !input.url.startsWith('https://')) {
    issues.push({ path: [...path, 'url'], message: 'must be an https URL' });
  }
  if (input.role !== undefined && !isOneOf(input.role, ['data', 'methodology'] as const)) {
    issues.push({ path: [...path, 'role'], message: 'must be one of data, methodology' });
  }
  if (input.request !== undefined) {
    const requestPath = [...path, 'request'];
    if (!isRecord(input.request)) {
      issues.push({ path: requestPath, message: 'must be an object' });
    } else {
      if (!isNonEmptyString(input.request.url)) {
        issues.push({ path: [...requestPath, 'url'], message: 'must be a non-empty string' });
      }
      if (!isOneOf(input.request.method, ['GET', 'POST'] as const)) {
        issues.push({ path: [...requestPath, 'method'], message: 'must be one of GET, POST' });
      }
      if (input.request.body !== undefined && typeof input.request.body !== 'string') {
        issues.push({ path: [...requestPath, 'body'], message: 'must be a string' });
      }
    }
  }
}

function validateSeries(
  input: unknown,
  path: Array<string | number>,
  issues: IndicatorDatasetValidationIssue[],
): void {
  if (!isRecord(input)) {
    issues.push({ path, message: 'must be an object' });
    return;
  }
  for (const field of ['id', 'label'] as const) {
    if (!isNonEmptyString(input[field])) {
      issues.push({ path: [...path, field], message: 'must be a non-empty string' });
    }
  }
  validateObservationArray(input.data, [...path, 'data'], issues);
}

export function validateIndicatorDataset(input: unknown): IndicatorDataset {
  if (!isRecord(input)) {
    throw new IndicatorDatasetValidationError(undefined, [{ path: [], message: 'must be an object' }]);
  }

  const issues: IndicatorDatasetValidationIssue[] = [];
  const indicatorId = typeof input.id === 'string' ? input.id : undefined;
  const requiredStrings = [
    'id', 'country', 'unit', 'metric', 'label', 'chartTitle', 'source', 'calculation',
    'updatedAt', 'comparabilityNote', 'methodologyFingerprint',
  ] as const;
  for (const field of requiredStrings) {
    if (!isNonEmptyString(input[field])) {
      issues.push({ path: [field], message: 'must be a non-empty string' });
    }
  }

  if (!isOneOf(input.frequency, INDICATOR_FREQUENCIES)) {
    issues.push({ path: ['frequency'], message: `must be one of ${INDICATOR_FREQUENCIES.join(', ')}` });
  }
  if (input.chartType !== undefined && !isOneOf(input.chartType, INDICATOR_CHART_TYPES)) {
    issues.push({ path: ['chartType'], message: `must be one of ${INDICATOR_CHART_TYPES.join(', ')}` });
  }
  if (input.comparisonType !== undefined && !isOneOf(input.comparisonType, INDICATOR_COMPARISON_TYPES)) {
    issues.push({ path: ['comparisonType'], message: `must be one of ${INDICATOR_COMPARISON_TYPES.join(', ')}` });
  }

  for (const field of [
    'verifiedThrough', 'definitionEffectiveFrom', 'definitionAsOf',
    'calculationEffectiveFrom', 'methodologyEffectiveFrom', 'referenceLabel',
  ] as const) {
    if (input[field] !== undefined && !isNonEmptyString(input[field])) {
      issues.push({ path: [field], message: 'must be a non-empty string' });
    }
  }
  if (input.referenceValue !== undefined && (typeof input.referenceValue !== 'number' || !Number.isFinite(input.referenceValue))) {
    issues.push({ path: ['referenceValue'], message: 'must be a finite number' });
  }

  if (!Array.isArray(input.sources)) {
    issues.push({ path: ['sources'], message: 'must be an array' });
  } else {
    for (let index = 0; index < input.sources.length; index += 1) {
      validateSource(input.sources[index], ['sources', index], issues);
    }
  }
  validateObservationArray(input.data, ['data'], issues);
  if (input.series !== undefined) {
    if (!Array.isArray(input.series)) {
      issues.push({ path: ['series'], message: 'must be an array' });
    } else {
      for (let index = 0; index < input.series.length; index += 1) {
        validateSeries(input.series[index], ['series', index], issues);
      }
    }
  }

  if (issues.length > 0) throw new IndicatorDatasetValidationError(indicatorId, issues);
  return input as IndicatorDataset;
}
