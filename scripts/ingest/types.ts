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
