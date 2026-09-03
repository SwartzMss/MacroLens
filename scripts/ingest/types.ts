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
  m0: 'pboc-m0|currency-in-circulation|month-end-balance-yoy|e-cny-included-from-2022-12',
  m1: 'pboc-m1|revised-from-2025-01|m0+corporate-demand+personal-demand+nonbank-payment-reserves|month-end-balance-yoy',
  m2: 'pboc-m2|money-and-quasi-money|m1+time-and-other-deposits|month-end-balance-yoy',
} as const;

export type MoneySupplyDatasetId = keyof typeof MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS;
