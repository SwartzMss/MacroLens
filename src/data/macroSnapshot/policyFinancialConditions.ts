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

function financialConditionDirection(evidence: SnapshotEvidence[]): 'easing' | 'tightening' | 'stable' {
  const changes = evidence.map(item => item.change).filter((change): change is number => change !== null);
  const improving = changes.filter(change => change > 0.0001).length;
  const tightening = changes.filter(change => change < -0.0001).length;
  if (tightening > improving) return 'easing';
  if (improving > tightening) return 'tightening';
  return 'stable';
}

function eventDirection(change: number | null): 'easing' | 'tightening' | 'stable' {
  if (change !== null && change < -0.0001) return 'easing';
  if (change !== null && change > 0.0001) return 'tightening';
  return 'stable';
}

export function analyzePolicyFinancialConditions(indicators: MacroIndicatorMap): MacroDomainState {
  const policyEvidence = makeIndicatorEvidence(indicators['policy-rate'], 'policy-rate');
  const lprEvidence = makeIndicatorEvidence(indicators.lpr, 'lpr');
  const evidence = [...policyEvidence, ...lprEvidence];
  const latestPolicyEvent = policyEvidence[0];
  const lastEventDirection = eventDirection(latestPolicyEvent.change);
  const eventIsCurrent = !latestPolicyEvent.verifiedThrough
    || latestPolicyEvent.observationPeriod >= latestPolicyEvent.verifiedThrough;
  const policyState: 'easing' | 'tightening' | 'stable' = eventIsCurrent ? lastEventDirection : 'stable';
  const lprState = financialConditionDirection(lprEvidence);
  const state: MacroDomainState['state'] = policyState === 'stable'
    ? lprState
    : lprState === 'stable' || policyState === lprState
      ? policyState
      : 'mixed';
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
    explanation: `政策利率最近一次事件（${latestPolicyEvent.observationPeriod}）方向为${lastEventDirection}${eventIsCurrent ? '' : `，已核验至${latestPolicyEvent.verifiedThrough}且期间无新事件，当前政策变动状态为稳定`}; LPR 系列按各自水平变化记录为${lprState}；这两类证据不直接证明经济结果。`,
    evidence,
    risks,
    watchNext,
  };
}
