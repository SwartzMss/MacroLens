import type { IndicatorDataset } from '../../domain/indicatorDataset';

export const macroIndicatorIds = [
  'gdp', 'pmi', 'industrial-production', 'retail-sales', 'fixed-asset-investment',
  'cpi', 'core-cpi', 'ppi',
  'm0', 'm1', 'm2', 'credit', 'social-financing',
  'policy-rate', 'lpr', 'unemployment-rate', 'exports', 'imports',
] as const;

export type MacroIndicatorId = typeof macroIndicatorIds[number];
export type MacroIndicatorMap = Record<MacroIndicatorId, IndicatorDataset>;
export type SnapshotChangeUnit = 'percentage-points' | 'points' | 'units';

export type SnapshotEvidence = {
  id: string;
  seriesId?: string;
  name: string;
  metric: string;
  frequency: string;
  valueLabel: string;
  changeLabel: string;
  conceptHref: string;
  latest: number;
  previous: number | null;
  change: number | null;
  changeUnit: SnapshotChangeUnit;
  observationPeriod: string;
  unit: string;
  updatedAt: string;
  verifiedThrough: string | null;
  chartType?: string;
  isEvent: boolean;
};

export type SnapshotConclusion = {
  id: string;
  title: string;
  explanation: string;
  kind: 'risk' | 'watch';
  evidenceIds: string[];
};

export type MacroDomainId =
  | 'growth'
  | 'prices'
  | 'credit-liquidity'
  | 'policy-financial-conditions'
  | 'labor'
  | 'external';

export type MacroDomainStateValue =
  | 'strengthening'
  | 'weakening'
  | 'stable'
  | 'mixed'
  | 'divergent'
  | 'easing'
  | 'tightening'
  | 'elevated'
  | 'notable';

export type MacroDomainState = {
  id: MacroDomainId;
  label: string;
  state: MacroDomainStateValue;
  explanation: string;
  evidence: SnapshotEvidence[];
  risks: SnapshotConclusion[];
  watchNext: SnapshotConclusion[];
};

export type MacroSynthesis = {
  label: string;
  explanation: string;
  supportingDomainIds: MacroDomainId[];
  conflictingDomainIds: MacroDomainId[];
  contextualDomainIds: MacroDomainId[];
};

export type MacroSnapshot = {
  rulesVersion: string;
  freshness: {
    earliestUpdatedAt: string;
    latestUpdatedAt: string;
    note: string;
  };
  domains: MacroDomainState[];
  synthesis: MacroSynthesis;
  risks: SnapshotConclusion[];
  watchNext: SnapshotConclusion[];
};
