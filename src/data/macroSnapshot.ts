import { getIndicatorData } from './indicatorRegistry';
import { analyzeCreditLiquidity } from './macroSnapshot/creditLiquidity';
import { makeIndicatorEvidence } from './macroSnapshot/evidence';
import { analyzeExternal } from './macroSnapshot/external';
import { analyzeGrowth } from './macroSnapshot/growth';
import { analyzeLabor } from './macroSnapshot/labor';
import { analyzePolicyFinancialConditions } from './macroSnapshot/policyFinancialConditions';
import { analyzePrices } from './macroSnapshot/prices';
import { deriveSynthesis } from './macroSnapshot/synthesis';
import {
  macroIndicatorIds,
  type MacroDomainState,
  type MacroIndicatorMap,
  type MacroSnapshot,
} from './macroSnapshot/types';

export {
  macroIndicatorIds,
  type MacroDomainId,
  type MacroDomainState,
  type MacroDomainStateValue,
  type MacroIndicatorId,
  type MacroIndicatorMap,
  type MacroSnapshot,
  type MacroSynthesis,
  type SnapshotChangeUnit,
  type SnapshotConclusion,
  type SnapshotEvidence,
} from './macroSnapshot/types';

export const macroSnapshotRulesVersion = '2026-09-07.2';

export const getMacroSnapshotIndicators = (): MacroIndicatorMap => Object.fromEntries(
  macroIndicatorIds.map(id => [id, getIndicatorData(id)]),
) as MacroIndicatorMap;

export const makeEvidence = makeIndicatorEvidence;

function validateIndicators(input: unknown): MacroIndicatorMap {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Macro snapshot indicators must be a keyed object');
  }
  const record = input as Record<string, unknown>;
  const keys = Object.keys(record);
  const missing = macroIndicatorIds.filter(id => !Object.prototype.hasOwnProperty.call(record, id));
  const unexpected = keys.filter(id => !(macroIndicatorIds as readonly string[]).includes(id));
  if (missing.length > 0) throw new Error(`Macro snapshot missing indicators: ${missing.join(', ')}`);
  if (unexpected.length > 0) throw new Error(`Macro snapshot received unexpected indicators: ${unexpected.join(', ')}`);
  for (const id of macroIndicatorIds) {
    const dataset = record[id] as { id?: unknown };
    if (typeof dataset !== 'object' || dataset === null || dataset.id !== id) {
      throw new Error(`Macro snapshot indicator id mismatch: ${id}`);
    }
  }
  return record as MacroIndicatorMap;
}

function deriveFreshness(indicators: MacroIndicatorMap): MacroSnapshot['freshness'] {
  const dates = macroIndicatorIds.map(id => indicators[id].updatedAt).sort();
  return {
    earliestUpdatedAt: dates[0],
    latestUpdatedAt: dates.at(-1)!,
    note: '各领域保留自身观察期、频率与数据集更新时间；更新时间范围不代表所有指标处于同一最新观察期。',
  };
}

function analyzeDomains(indicators: MacroIndicatorMap): MacroDomainState[] {
  return [
    analyzeGrowth(indicators),
    analyzePrices(indicators),
    analyzeCreditLiquidity(indicators),
    analyzePolicyFinancialConditions(indicators),
    analyzeLabor(indicators),
    analyzeExternal(indicators),
  ];
}

export function buildMacroSnapshot(
  indicators: MacroIndicatorMap = getMacroSnapshotIndicators(),
): MacroSnapshot {
  const validated = validateIndicators(indicators);
  const domains = analyzeDomains(validated);
  return {
    rulesVersion: macroSnapshotRulesVersion,
    freshness: deriveFreshness(validated),
    domains,
    synthesis: deriveSynthesis(domains),
    risks: domains.flatMap(domain => domain.risks),
    watchNext: domains.flatMap(domain => domain.watchNext),
  };
}
