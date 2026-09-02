import { IngestionContractError, MethodologyMismatchError } from '../types.ts';
import { MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS } from '../types.ts';
import type { IndicatorDataset, MoneySupplyDatasetId } from '../types.ts';
import { validateIndicatorDataset } from './dataset.ts';

export function validateMoneySupplyDataset(dataset: IndicatorDataset, id: MoneySupplyDatasetId): void {
  validateIndicatorDataset(dataset);
  if (dataset.id !== id) throw new IngestionContractError(`Money-supply dataset id mismatch: ${dataset.id} != ${id}`);
  if (dataset.country !== 'CN') throw new IngestionContractError(`Money-supply country must be CN, got ${dataset.country}`);
  if (dataset.frequency !== 'monthly') throw new IngestionContractError(`Money-supply frequency must be monthly, got ${dataset.frequency}`);
  if (dataset.unit !== '%') throw new IngestionContractError(`Money-supply unit must be %, got ${dataset.unit}`);
  if (dataset.metric !== 'yoy') throw new IngestionContractError(`Money-supply metric must be yoy, got ${dataset.metric}`);
  if (dataset.source !== 'PBOC') throw new IngestionContractError(`Money-supply source must be PBOC, got ${dataset.source}`);
  if (dataset.methodologyFingerprint !== MONEY_SUPPLY_METHODOLOGY_FINGERPRINTS[id]) {
    throw new MethodologyMismatchError(`Money-supply methodology fingerprint mismatch for ${id}`);
  }
  for (const source of dataset.sources) {
    if (!/^https:\/\/www\.pbc\.gov\.cn\//.test(source.url)) {
      throw new IngestionContractError(`Invalid official PBOC source: ${source.url}`);
    }
  }
}
