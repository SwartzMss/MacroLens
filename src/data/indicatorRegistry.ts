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
import credit from '../../data/indicators/credit.json';
import socialFinancing from '../../data/indicators/social-financing.json';
import lpr from '../../data/indicators/lpr.json';
import unemploymentRate from '../../data/indicators/unemployment-rate.json';
import exports from '../../data/indicators/exports.json';
import imports from '../../data/indicators/imports.json';
import policyRate from '../../data/indicators/policy-rate.json';
import { validateIndicatorDataset } from '../domain/indicatorDataset';
import type { IndicatorDataset } from '../domain/indicatorDataset';

const rawIndicatorData = {
  m0, m1, m2, pmi, gdp,
  'industrial-production': industrialProduction,
  'retail-sales': retailSales,
  'fixed-asset-investment': fixedAssetInvestment,
  cpi,
  'core-cpi': coreCpi,
  ppi,
  credit,
  'social-financing': socialFinancing,
  lpr,
  'unemployment-rate': unemploymentRate,
  exports,
  imports,
  'policy-rate': policyRate,
} as const;

const indicatorData: Record<string, IndicatorDataset> = Object.fromEntries(
  Object.entries(rawIndicatorData).map(([id, input]) => {
    const dataset = validateIndicatorDataset(input);
    if (dataset.id !== id) throw new Error(`Registered indicator id mismatch: ${id} != ${dataset.id}`);
    return [id, dataset];
  }),
);

export function getIndicatorData(id: string): IndicatorDataset {
  if (!Object.prototype.hasOwnProperty.call(indicatorData, id)) throw new Error(`Unknown indicator dataset: ${id}`);
  return indicatorData[id as keyof typeof indicatorData];
}
