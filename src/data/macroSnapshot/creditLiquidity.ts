import { makeIndicatorEvidence } from './evidence';
import type {
  MacroDomainState,
  MacroIndicatorMap,
  SnapshotConclusion,
  SnapshotEvidence,
} from './types';

const monetaryIds = ['m0', 'm1', 'm2'] as const;
const financingIds = ['credit', 'social-financing'] as const;

function conclusion(
  id: string,
  title: string,
  explanation: string,
  kind: 'risk' | 'watch',
  evidenceIds: string[],
): SnapshotConclusion {
  return { id, title, explanation, kind, evidenceIds };
}

function groupDirection(evidence: SnapshotEvidence[]): 'strengthening' | 'weakening' | 'stable' {
  const positive = evidence.filter(item => item.latest > 0 && (item.change === null || item.change >= -0.2)).length;
  const negative = evidence.filter(item => item.latest < 0 || (item.change !== null && item.change < -0.2)).length;
  if (positive > negative) return 'strengthening';
  if (negative > positive) return 'weakening';
  return 'stable';
}

export function analyzeCreditLiquidity(indicators: MacroIndicatorMap): MacroDomainState {
  const evidence = [...monetaryIds, ...financingIds].flatMap(id => makeIndicatorEvidence(indicators[id], id));
  const byId = new Map(evidence.map(item => [item.id, item]));
  const monetary = monetaryIds.map(id => byId.get(id)!);
  const financing = financingIds.map(id => byId.get(id)!);
  const monetaryState = groupDirection(monetary);
  const financingState = groupDirection(financing);
  const state: MacroDomainState['state'] = monetaryState !== financingState
    ? 'mixed'
    : monetaryState;
  const evidenceIds = evidence.map(item => item.id);
  const risks = state === 'mixed'
    ? [conclusion(
      'credit-liquidity-divergence',
      '货币与融资证据分化',
      `货币增速组为${monetaryState}，信贷与社会融资组为${financingState}；这只描述两组数据的差异，不推出需求或资产价格结果。`,
      'risk',
      evidenceIds,
    )]
    : [];
  const watchNext = risks.map(risk => conclusion(
    `watch-${risk.id}`,
    `观察：${risk.title}`,
    `继续观察 ${risk.evidenceIds.join('、')} 的下一期读数和各自观察期。`,
    'watch',
    risk.evidenceIds,
  ));

  return {
    id: 'credit-liquidity',
    label: '信用与流动性',
    state,
    explanation: state === 'mixed'
      ? `货币增速与信贷/社会融资证据没有同向，分别为${monetaryState}和${financingState}；不把流动性读数直接等同于经济走强。`
      : `货币增速与信贷/社会融资证据大体同向为${state}，仍只报告货币和融资数据自身。`,
    evidence,
    risks,
    watchNext,
  };
}
