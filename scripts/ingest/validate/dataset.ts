import { IngestionContractError } from '../types.ts';
import type { IndicatorDataset } from '../types.ts';

const DATE_PATTERN = /^\d{4}-\d{2}$/;

function fail(message: string): never {
  throw new IngestionContractError(message);
}

export function validateIndicatorDataset(dataset: IndicatorDataset): void {
  for (const field of ['id', 'country', 'frequency', 'unit', 'metric', 'label', 'chartTitle', 'source', 'calculation', 'updatedAt', 'comparabilityNote']) {
    if (typeof dataset[field as keyof IndicatorDataset] !== 'string' || !dataset[field as keyof IndicatorDataset]) {
      fail(`Missing indicator field: ${field}`);
    }
  }
  if (dataset.frequency !== 'monthly') fail(`PMI frequency must be monthly, got ${dataset.frequency}`);
  if (dataset.unit !== 'index') fail(`PMI unit must be index, got ${dataset.unit}`);
  if (dataset.metric !== 'index') fail(`PMI metric must be index, got ${dataset.metric}`);
  if (dataset.calculation !== 'published') fail(`PMI calculation must be published, got ${dataset.calculation}`);
  if (!Array.isArray(dataset.sources) || dataset.sources.length === 0) fail('PMI dataset requires source provenance');

  for (const source of dataset.sources) {
    if (!source.title || !source.coverage || !/^https:\/\/www\.stats\.gov\.cn\//.test(source.url)) {
      fail(`Invalid official PMI source: ${source.url}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source.sourceDate)) fail(`Invalid PMI source date: ${source.sourceDate}`);
  }
  if (!Array.isArray(dataset.data) || dataset.data.length === 0) fail('PMI dataset requires observations');

  let previousDate = '';
  for (const observation of dataset.data) {
    if (!DATE_PATTERN.test(observation.date)) fail(`Invalid PMI observation date: ${observation.date}`);
    if (observation.date <= previousDate) fail(`PMI observations must be sorted and unique: ${observation.date}`);
    if (!Number.isFinite(observation.value) || observation.value < 0 || observation.value > 100) {
      fail(`PMI observation value outside [0, 100]: ${observation.date}=${observation.value}`);
    }
    previousDate = observation.date;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataset.updatedAt)) fail(`Invalid PMI updatedAt: ${dataset.updatedAt}`);
  const latestSource = dataset.sources.at(-1);
  if (latestSource?.sourceDate !== dataset.updatedAt) {
    fail(`PMI updatedAt must match the latest source date: ${dataset.updatedAt} != ${latestSource?.sourceDate}`);
  }
}
