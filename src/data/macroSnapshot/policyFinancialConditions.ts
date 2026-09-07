import { makeIndicatorEvidence } from './evidence';
import type {
  MacroDomainState,
  MacroIndicatorMap,
  SnapshotConclusion,
  SnapshotEvidence,
} from './types';

function conclusion(
  id: string,
  title: string,
  explanation: string,
  kind: 'risk' | 'watch',
  evidenceIds: string[],
): SnapshotConclusion {
  return { id, title, explanation, kind, evidenceIds };
}

function levelDirection(evidence: SnapshotEvidence[]): 'strengthening' | 'weakening' | 'stable' {
  const changes = evidence.map(item => item.change).filter((change): change is number => change !== null);
  const improving = changes.filter(change => change > 0.0001).length;
  const weakening = changes.filter(change => change < -0.0001).length;
  if (improving > weakening) return 'strengthening';
  if (weakening > improving) return 'weakening';
  return 'stable';
}

export function analyzePolicyFinancialConditions(indicators: MacroIndicatorMap): MacroDomainState {
  const policyEvidence = makeIndicatorEvidence(indicators['policy-rate'], 'policy-rate');
  const lprEvidence = makeIndicatorEvidence(indicators.lpr, 'lpr');
  const evidence = [...policyEvidence, ...lprEvidence];
  const policyChange = policyEvidence[0].change;
  const policyState: 'easing' | 'tightening' | 'stable' = policyChange !== null && policyChange < -0.0001
    ? 'easing'
    : policyChange !== null && policyChange > 0.0001
      ? 'tightening'
      : 'stable';
  const lprState = levelDirection(lprEvidence);
  const state: MacroDomainState['state'] = policyState === 'easing' && lprState === 'stable'
    ? 'mixed'
    : policyState === 'tightening' && lprState === 'stable'
      ? 'mixed'
    : policyState !== 'stable' && lprState !== 'stable'
        ? 'mixed'
        : policyState !== 'stable'
          ? policyState
          : lprState;
  const evidenceIds = evidence.map(item => item.id);
  const risks = state === 'mixed'
    ? [conclusion(
      'policy-financial-conditions-divergence',
      '政策操作与 LPR 读数分化',
      '政策利率事件与 LPR 系列的近期变化并不完全同步，当前只描述政策和报价条件，不把它们当作实际融资结果。',
      'risk',
      evidenceIds,
    )]
    : [];
  const watchNext = risks.map(risk => conclusion(
    `watch-${risk.id}`,
    `观察：${risk.title}`,
    `继续观察政策事件 ${policyEvidence[0].observationPeriod} 以及 LPR 系列的下一期读数。`,
    'watch',
    risk.evidenceIds,
  ));

  return {
    id: 'policy-financial-conditions',
    label: '政策与金融条件',
    state,
    explanation: `政策利率按事件/阶梯语义记录为${policyState}，LPR 系列按各自水平变化记录为${lprState}；这两类证据不直接证明经济结果。`,
    evidence,
    risks,
    watchNext,
  };
}
