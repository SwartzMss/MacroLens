import { IngestionContractError, MethodologyMismatchError, PBOC_FINANCIAL_METHODOLOGY_FINGERPRINTS } from '../types.ts';
import type { IndicatorDataset, PBOCFinancialDatasetId } from '../types.ts';
import { validateIndicatorDataset } from './dataset.ts';

export function validatePBOCFinancialDataset(dataset: IndicatorDataset, id: PBOCFinancialDatasetId): void {
  validateIndicatorDataset(dataset);
  if (dataset.id !== id) throw new IngestionContractError(`PBOC financial dataset id mismatch: ${dataset.id} != ${id}`);
  if (dataset.country !== 'CN') throw new IngestionContractError(`PBOC financial country must be CN, got ${dataset.country}`);
  if (dataset.frequency !== 'monthly') throw new IngestionContractError(`PBOC financial frequency must be monthly, got ${dataset.frequency}`);
  if (dataset.unit !== '%') throw new IngestionContractError(`PBOC financial unit must be %, got ${dataset.unit}`);
  if (dataset.metric !== 'yoy') throw new IngestionContractError(`PBOC financial metric must be yoy, got ${dataset.metric}`);
  if (dataset.calculation !== 'published') throw new IngestionContractError(`PBOC financial calculation must be published, got ${dataset.calculation}`);
  if (dataset.source !== 'PBOC') throw new IngestionContractError(`PBOC financial source must be PBOC, got ${dataset.source}`);
  if (dataset.methodologyFingerprint !== PBOC_FINANCIAL_METHODOLOGY_FINGERPRINTS[id]) {
    throw new MethodologyMismatchError(`PBOC financial methodology fingerprint mismatch for ${id}`);
  }
  for (const source of dataset.sources) {
    if (!/^https:\/\/www\.pbc\.gov\.cn\//.test(source.url)) {
      throw new IngestionContractError(`Invalid official PBOC source: ${source.url}`);
    }
  }
}
