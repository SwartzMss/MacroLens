export type IndicatorSource = {
  title: string;
  url: string;
  sourceDate: string;
  coverage: string;
};

export type Observation = { date: string; value: number };

export type IndicatorDataset = {
  id: string;
  country: string;
  frequency: string;
  unit: string;
  metric: string;
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
  sources: IndicatorSource[];
  referenceValue?: number;
  referenceLabel?: string;
  data: Observation[];
};

export type PmiPublication = { title: string; url: string; sourceDate: string };
export type RawPmiPublication = {
  publication: PmiPublication;
  observations: Observation[];
  methodologyFingerprint: string;
};

export type MoneySupplyPublication = {
  title: string;
  url: string;
  sourceDate: string;
  month: string;
};

export type MoneySupplyValues = { m0: number; m1: number; m2: number };

export type RawMoneySupplyPublication = {
  publication: MoneySupplyPublication;
  values: MoneySupplyValues;
  methodologyFingerprints: typeof MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS;
};

export type RealEconomyDatasetId = 'gdp' | 'industrial-production' | 'retail-sales' | 'fixed-asset-investment';
export type RealEconomyPeriodKind = 'quarterly' | 'monthly-yoy' | 'cumulative-yoy';
export type RealEconomyContract = {
  id: RealEconomyDatasetId;
  sourceCodes: string[];
  sourceTitle: string;
  frequency: 'quarterly' | 'monthly';
  unit: '%';
  metric: 'yoy' | 'cumulative_yoy';
  calculation: 'published';
  periodKind: RealEconomyPeriodKind;
  methodologyFingerprint: string;
};
export type NbsRealEconomyPublication = {
  title: string;
  url: string;
  sourceDate: string;
  coverage: string;
};
export type RawNbsRealEconomySeries = {
  publication: NbsRealEconomyPublication;
  id: RealEconomyDatasetId;
  seriesCode: string;
  seriesTitle: string;
  unit: string;
  frequency: string;
  methodologyFingerprint: string;
  observations: Observation[];
};

export const REAL_ECONOMY_METHODOLOGY_FINGERPRINTS = {
  gdp: 'nbs-gdp|quarterly-real-yoy',
  'industrial-production': 'nbs-industrial-production|above-designated-size|real-yoy',
  'retail-sales': 'nbs-retail-sales|total-retail-sales|nominal-yoy',
  'fixed-asset-investment': 'nbs-fixed-asset-investment|excluding-rural-households|cumulative-yoy',
} as const;

export const REAL_ECONOMY_CONTRACTS: Record<RealEconomyDatasetId, RealEconomyContract> = {
  gdp: {
    id: 'gdp',
    sourceCodes: ['A010101'],
    sourceTitle: '国内生产总值（GDP）同比增长',
    frequency: 'quarterly',
    unit: '%',
    metric: 'yoy',
    calculation: 'published',
    periodKind: 'quarterly',
    methodologyFingerprint: REAL_ECONOMY_METHODOLOGY_FINGERPRINTS.gdp,
  },
  'industrial-production': {
    id: 'industrial-production',
    sourceCodes: ['A020101', 'A020102'],
    sourceTitle: '规模以上工业增加值同比增长',
    frequency: 'monthly',
    unit: '%',
    metric: 'yoy',
    calculation: 'published',
    periodKind: 'monthly-yoy',
    methodologyFingerprint: REAL_ECONOMY_METHODOLOGY_FINGERPRINTS['industrial-production'],
  },
  'retail-sales': {
    id: 'retail-sales',
    sourceCodes: ['A070103', 'A070104'],
    sourceTitle: '社会消费品零售总额同比增长',
    frequency: 'monthly',
    unit: '%',
    metric: 'yoy',
    calculation: 'published',
    periodKind: 'monthly-yoy',
    methodologyFingerprint: REAL_ECONOMY_METHODOLOGY_FINGERPRINTS['retail-sales'],
  },
  'fixed-asset-investment': {
    id: 'fixed-asset-investment',
    sourceCodes: ['A040102'],
    sourceTitle: '固定资产投资（不含农户）累计增长',
    frequency: 'monthly',
    unit: '%',
    metric: 'cumulative_yoy',
    calculation: 'published',
    periodKind: 'cumulative-yoy',
    methodologyFingerprint: REAL_ECONOMY_METHODOLOGY_FINGERPRINTS['fixed-asset-investment'],
  },
};

export class HistoricalMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HistoricalMismatchError';
  }
}

export class IngestionContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IngestionContractError';
  }
}

export class MethodologyMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MethodologyMismatchError';
  }
}

export const PMI_METHODOLOGY_FINGERPRINT = [
  'nbs-pmi',
  'scope=31-industry-classes',
  'sample=3200-manufacturing-enterprises',
  'sampling=PPS',
  'weights=new-orders:30,production:25,employment:20,supplier-delivery:15-inverse,raw-materials-inventory:10',
  'seasonally-adjusted',
].join('|');

export const MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS = {
  // Only include anchors that parsePBOCMoneySupplyReport verifies in each monthly report.
  m0: 'pboc-m0|currency-in-circulation|published-yoy',
  m1: 'pboc-m1|revised-from-2025-01|m0+corporate-demand+personal-demand+nonbank-payment-reserves|month-end-balance-yoy',
  m2: 'pboc-m2|broad-money|published-yoy',
} as const;

export type MoneySupplyDatasetId = keyof typeof MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS;
