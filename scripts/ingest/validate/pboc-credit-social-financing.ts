import { IngestionContractError, MethodologyMismatchError, PBOC_FINANCIAL_METHODOLOGY_FINGERPRINTS } from '../types.ts';
import type { IndicatorDataset, PBOCFinancialDatasetId } from '../types.ts';
import { validateIndicatorDataset, validateMonthlyObservations } from './dataset.ts';

export function validatePBOCFinancialDataset(dataset: IndicatorDataset, id: PBOCFinancialDatasetId): void {
  validateIndicatorDataset(dataset);
  if (dataset.id !== id) throw new IngestionContractError(`PBOC financial dataset id mismatch: ${dataset.id} != ${id}`);
  if (dataset.country !== 'CN') throw new IngestionContractError(`PBOC financial country must be CN, got ${dataset.country}`);
  if (dataset.frequency !== 'monthly') throw new IngestionContractError(`PBOC financial frequency must be monthly, got ${dataset.frequency}`);
  if (dataset.unit !== '%') throw new IngestionContractError(`PBOC financial unit must be %, got ${dataset.unit}`);
  if (dataset.metric !== 'yoy') throw new IngestionContractError(`PBOC financial metric must be yoy, got ${dataset.metric}`);
  if (dataset.calculation !== 'published') throw new IngestionContractError(`PBOC financial calculation must be published, got ${dataset.calculation}`);
  if (dataset.source !== 'PBOC') throw new IngestionContractError(`PBOC financial source must be PBOC, got ${dataset.source}`);
  if (dataset.balance) {
    if (dataset.balance.unit !== '万亿元') throw new IngestionContractError('PBOC balance unit must be 万亿元');
    validateMonthlyObservations(dataset.balance.data, `PBOC ${id} balance`);
    for (const observation of dataset.balance.data) {
      if (observation.value <= 0 || !dataset.data.some(item => item.date === observation.date)) {
        throw new IngestionContractError(`Invalid ${id} balance observation: ${observation.date}`);
      }
    }
  }
  if (id === 'credit') {
    if (dataset.calculationEffectiveFrom !== '2025-12') {
      throw new MethodologyMismatchError('PBOC credit calculation must declare the published boundary from 2025-12');
    }
    if (!dataset.comparabilityNote.includes('2025-12')) {
      throw new MethodologyMismatchError('PBOC credit comparability note must document the 2025-12 calculation boundary');
    }
    if (!dataset.sources.some((source) => source.role === 'methodology' && source.coverage === '2023-01 to 2023-12')) {
      throw new IngestionContractError('PBOC credit requires the 2023 balance table as the historical YoY denominator source');
    }
  }
  if (dataset.methodologyFingerprint !== PBOC_FINANCIAL_METHODOLOGY_FINGERPRINTS[id]) {
    throw new MethodologyMismatchError(`PBOC financial methodology fingerprint mismatch for ${id}`);
  }
  for (const source of dataset.sources) {
    if (!/^https:\/\/www\.pbc\.gov\.cn\//.test(source.url)) {
      throw new IngestionContractError(`Invalid official PBOC source: ${source.url}`);
    }
  }
}
