import { makeIndicatorEvidence } from './evidence';
import type {
  MacroDomainState,
  MacroIndicatorMap,
  SnapshotConclusion,
} from './types';

const ids = ['cpi', 'core-cpi', 'ppi'] as const;

function conclusion(
  id: string,
  title: string,
  explanation: string,
  kind: 'risk' | 'watch',
  evidenceIds: string[],
): SnapshotConclusion {
  return { id, title, explanation, kind, evidenceIds };
}

export function analyzePrices(indicators: MacroIndicatorMap): MacroDomainState {
  const evidence = ids.flatMap(id => makeIndicatorEvidence(indicators[id], id));
  const signs = new Set(evidence.map(item => item.latest > 0 ? 'positive' : item.latest < 0 ? 'negative' : 'neutral'));
  const allNegative = evidence.every(item => item.latest < 0);
  const allPositive = evidence.every(item => item.latest > 0);
  const improving = evidence.filter(item => item.change !== null && item.change >= 0).length;
  const state: MacroDomainState['state'] = signs.size > 1
    ? 'divergent'
    : allNegative
      ? 'weakening'
      : allPositive && improving >= 2
        ? 'strengthening'
        : 'stable';
  const risks = state === 'divergent'
    ? [conclusion(
      'prices-divergent',
      '价格指标方向分化',
      'CPI、核心 CPI 与 PPI 的最新读数方向并不一致，当前只描述价格指标自身的分化。',
      'risk',
      evidence.map(item => item.id),
    )]
    : [];
  const watchNext = risks.map(risk => conclusion(
    `watch-${risk.id}`,
    `观察：${risk.title}`,
    `继续观察 ${risk.evidenceIds.join('、')} 的下一期价格读数及其观察期。`,
    'watch',
    risk.evidenceIds,
  ));

  return {
    id: 'prices',
    label: '价格',
    state,
    explanation: state === 'divergent'
      ? 'CPI、核心 CPI 与 PPI 的价格水平或动量方向不同，保留为分化状态，不据此推出需求、资产价格或投资结论。'
      : state === 'weakening'
        ? 'CPI、核心 CPI 与 PPI 最新读数均为负，价格证据整体偏弱，但仍只描述价格指标自身。'
        : state === 'strengthening'
          ? 'CPI、核心 CPI 与 PPI 最新读数均为正，且多数近期变化不弱；这仍是价格指标层面的描述。'
          : '价格指标没有形成统一的强弱方向，继续分别观察 CPI、核心 CPI 与 PPI。',
    evidence,
    risks,
    watchNext,
  };
}
