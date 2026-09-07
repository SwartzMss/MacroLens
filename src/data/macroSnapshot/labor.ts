import { makeIndicatorEvidence } from './evidence';
import type { MacroDomainState, MacroIndicatorMap, SnapshotConclusion } from './types';

function conclusion(
  id: string,
  title: string,
  explanation: string,
  kind: 'risk' | 'watch',
  evidenceIds: string[],
): SnapshotConclusion {
  return { id, title, explanation, kind, evidenceIds };
}

export function analyzeLabor(indicators: MacroIndicatorMap): MacroDomainState {
  const evidence = makeIndicatorEvidence(indicators['unemployment-rate'], 'unemployment-rate');
  const latest = evidence[0];
  const state: MacroDomainState['state'] = latest.change !== null && latest.change > 0.0001
    ? 'weakening'
    : latest.change !== null && latest.change < -0.0001
      ? 'strengthening'
      : 'stable';
  const risks = state === 'weakening'
    ? [conclusion(
      'labor-unemployment-rising',
      '失业率上升',
      `城镇调查失业率较上一期上升 ${latest.change?.toFixed(1)} 个百分点，观察期为 ${latest.observationPeriod}。`,
      'risk',
      ['unemployment-rate'],
    )]
    : [];
  const watchNext = risks.map(risk => conclusion(
    `watch-${risk.id}`,
    `观察：${risk.title}`,
    `继续观察 ${latest.observationPeriod} 后的下一期月度劳动市场读数。`,
    'watch',
    risk.evidenceIds,
  ));

  return {
    id: 'labor',
    label: '劳动',
    state,
    explanation: state === 'weakening'
      ? '失业率近期上升，劳动市场证据偏弱；劳动状态独立于增长域报告。'
      : state === 'strengthening'
        ? '失业率近期下降，劳动市场证据改善；劳动状态独立于增长域报告。'
        : '失业率近期变化有限，劳动市场证据暂时稳定。',
    evidence,
    risks,
    watchNext,
  };
}
