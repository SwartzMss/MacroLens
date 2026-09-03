import m1 from '../../data/indicators/m1.json';
import m2 from '../../data/indicators/m2.json';
import m0 from '../../data/indicators/m0.json';
import pmi from '../../data/indicators/pmi.json';
import gdp from '../../data/indicators/gdp.json';
import industrialProduction from '../../data/indicators/industrial-production.json';
import retailSales from '../../data/indicators/retail-sales.json';
import fixedAssetInvestment from '../../data/indicators/fixed-asset-investment.json';

export interface IndicatorDataset {
  id: string; country: string; frequency: string;
  unit: string; metric: string; label: string; chartTitle: string; definitionEffectiveFrom?: string; definitionAsOf?: string; source: string;
  calculation: string; calculationEffectiveFrom?: string; updatedAt: string; comparabilityNote: string;
  sources: Array<{ title: string; url: string; sourceDate: string; coverage: string }>;
  referenceValue?: number; referenceLabel?: string;
  data: Array<{ date: string; value: number }>;
}

const indicatorData = {
  m0, m1, m2, pmi, gdp,
  'industrial-production': industrialProduction,
  'retail-sales': retailSales,
  'fixed-asset-investment': fixedAssetInvestment
} satisfies Record<string, IndicatorDataset>;

export function getIndicatorData(id: string): IndicatorDataset {
  if (!Object.prototype.hasOwnProperty.call(indicatorData, id)) throw new Error(`Unknown indicator dataset: ${id}`);
  return indicatorData[id as keyof typeof indicatorData];
}
