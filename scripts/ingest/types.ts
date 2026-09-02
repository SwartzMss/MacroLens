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
  sources: IndicatorSource[];
  referenceValue?: number;
  referenceLabel?: string;
  data: Observation[];
};

export type PmiPublication = { title: string; url: string; sourceDate: string };
export type RawPmiPublication = { publication: PmiPublication; observations: Observation[] };

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
