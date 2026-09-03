import { IngestionContractError } from '../types.ts';
import { PMI_METHODOLOGY_FINGERPRINT } from '../types.ts';
import type { IndicatorDataset } from '../types.ts';
import { validateIndicatorDataset } from './dataset.ts';

export function validatePmiDataset(dataset: IndicatorDataset): void {
  validateIndicatorDataset(dataset);
  if (dataset.frequency !== 'monthly') throw new IngestionContractError(`PMI frequency must be monthly, got ${dataset.frequency}`);
  if (dataset.unit !== 'index') throw new IngestionContractError(`PMI unit must be index, got ${dataset.unit}`);
  if (dataset.metric !== 'index') throw new IngestionContractError(`PMI metric must be index, got ${dataset.metric}`);
  if (dataset.calculation !== 'published') throw new IngestionContractError(`PMI calculation must be published, got ${dataset.calculation}`);
  if (dataset.methodologyFingerprint !== PMI_METHODOLOGY_FINGERPRINT) {
    throw new IngestionContractError('PMI methodology fingerprint differs from the expected contract');
  }
  for (const source of dataset.sources) {
    if (!/^https:\/\/www\.stats\.gov\.cn\//.test(source.url)) {
      throw new IngestionContractError(`Invalid official PMI source: ${source.url}`);
    }
  }
  for (const observation of dataset.data) {
    if (observation.value < 0 || observation.value > 100) {
      throw new IngestionContractError(`PMI observation value outside [0, 100]: ${observation.date}=${observation.value}`);
    }
  }
}
