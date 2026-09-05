import m1 from '../../data/indicators/m1.json';
import m2 from '../../data/indicators/m2.json';
import m0 from '../../data/indicators/m0.json';
import pmi from '../../data/indicators/pmi.json';
import gdp from '../../data/indicators/gdp.json';
import industrialProduction from '../../data/indicators/industrial-production.json';
import retailSales from '../../data/indicators/retail-sales.json';
import fixedAssetInvestment from '../../data/indicators/fixed-asset-investment.json';
import cpi from '../../data/indicators/cpi.json';
import coreCpi from '../../data/indicators/core-cpi.json';
import ppi from '../../data/indicators/ppi.json';

export interface IndicatorDataset {
  id: string; country: string; frequency: string;
  unit: string; metric: string; comparisonType?: IndicatorComparisonType; label: string; chartTitle: string; definitionEffectiveFrom?: string; definitionAsOf?: string; source: string;
  calculation: string; calculationEffectiveFrom?: string; updatedAt: string; comparabilityNote: string;
  methodologyFingerprint: string; methodologyEffectiveFrom?: string;
  sources: Array<{ title: string; url: string; sourceDate: string; coverage: string; role?: string }>;
  referenceValue?: number; referenceLabel?: string;
  data: Array<{ date: string; value: number }>;
}

export type IndicatorComparisonType =
  | 'previous_month_same_metric'
  | 'previous_month_level'
  | 'previous_month_rate'
  | 'previous_quarter_same_metric'
  | 'previous_quarter_level'
  | 'previous_quarter_rate'
  | 'previous_cumulative_period';

const indicatorData = {
  m0, m1, m2, pmi, gdp,
  'industrial-production': industrialProduction,
  'retail-sales': retailSales,
  'fixed-asset-investment': fixedAssetInvestment,
  cpi,
  'core-cpi': coreCpi,
  ppi,
} satisfies Record<string, IndicatorDataset>;

export function getIndicatorData(id: string): IndicatorDataset {
  if (!Object.prototype.hasOwnProperty.call(indicatorData, id)) throw new Error(`Unknown indicator dataset: ${id}`);
  return indicatorData[id as keyof typeof indicatorData];
}
