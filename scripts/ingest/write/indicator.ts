import fs from 'node:fs';
import path from 'node:path';
import type { IndicatorDataset } from '../types.ts';

export function writeIndicatorDataset(filePath: string, dataset: IndicatorDataset): { changed: boolean; output: string } {
  const output = `${JSON.stringify(dataset, null, 2)}\n`;
  let current = '';
  try {
    current = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (current === output) return { changed: false, output };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, output, 'utf8');
  return { changed: true, output };
}
