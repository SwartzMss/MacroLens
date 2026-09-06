import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fetchText } from './fetch-text.ts';
import { parseLprHistoryResponse } from './fetch/lpr.ts';
import { normalizeLprDataset } from './normalize/lpr.ts';
import { validateLprDataset } from './validate/lpr.ts';
import { writeIndicatorDataset } from './write/indicator.ts';
import type { IndicatorDataset } from './types.ts';

export const LPR_HISTORY_URL = 'https://www.chinamoney.com.cn/ags/ms/cm-u-bk-currency/LprChrtCSV?startDate=2019-08-01&endDate=2099-12-31';

type CliOptions = { fixture?: string; target: string; help?: boolean };

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { target: 'data/indicators/lpr.json' };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--fixture') options.fixture = args[++index];
    else if (argument === '--target') options.target = args[++index] ?? '';
    else if (argument === '--help') {
      console.log('Usage: npm run ingest:lpr -- [--fixture FILE] [--target FILE]');
      options.help = true;
      return options;
    } else throw new Error(`Unknown option: ${argument}`);
  }
  if (!options.target) throw new Error('--target requires a file path');
  return options;
}

export async function runLpr(args: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args);
  if (options.help) return;
  const existing = JSON.parse(await fs.readFile(options.target, 'utf8')) as IndicatorDataset;
  validateLprDataset(existing);
  const payload = options.fixture ? await fs.readFile(options.fixture, 'utf8') : await fetchText(LPR_HISTORY_URL);
  const normalized = normalizeLprDataset(parseLprHistoryResponse(payload, LPR_HISTORY_URL), existing);
  const result = writeIndicatorDataset(options.target, normalized);
  console.log(`lpr: ${normalized.data.at(-1)?.date} Changed: ${result.changed}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runLpr().catch((error: unknown) => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : error);
    process.exitCode = 1;
  });
}
