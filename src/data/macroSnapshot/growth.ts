import { makeIndicatorEvidence } from './evidence';
import type {
  MacroDomainState,
  MacroIndicatorMap,
  SnapshotConclusion,
  SnapshotEvidence,
} from './types';

const ids = ['pmi', 'gdp', 'industrial-production', 'retail-sales', 'fixed-asset-investment'] as const;
const weakeningBoundary = -0.2;
const improvingBoundary = 0.2;

const isWeakening = (change: number | null) => change !== null && change < weakeningBoundary;
const isImproving = (change: number | null) => change !== null && change > improvingBoundary;
const periodText = (evidence: SnapshotEvidence[]) => evidence.map(item => item.observationPeriod).join('、');

function conclusion(
  id: string,
  title: string,
  explanation: string,
  kind: 'risk' | 'watch',
  evidenceIds: string[],
): SnapshotConclusion {
  return { id, title, explanation, kind, evidenceIds };
}

export function analyzeGrowth(indicators: MacroIndicatorMap): MacroDomainState {
  const evidence = ids.flatMap(id => makeIndicatorEvidence(indicators[id], id));
  const byId = new Map(evidence.map(item => [item.id, item]));
  const pmi = byId.get('pmi')!;
  const activity = ids.filter(id => id !== 'pmi').map(id => byId.get(id)!);
  const pmiPositive = pmi.latest > 50;
  const pmiNegative = pmi.latest < 50;
  const positiveLevels = activity.filter(item => item.latest > 0).length + (pmiPositive ? 1 : 0);
  const negativeLevels = activity.filter(item => item.latest < 0).length + (pmiNegative ? 1 : 0);
  const weakening = evidence.filter(item => isWeakening(item.change));
  const improving = evidence.filter(item => isImproving(item.change));
  const levelDisagreement = pmiNegative && activity.filter(item => item.latest > 0).length >= 3;

  let state: MacroDomainState['state'] = 'stable';
  if (levelDisagreement || (positiveLevels >= 3 && weakening.length >= 2)) {
    state = 'mixed';
  } else if (negativeLevels >= 3 || weakening.length >= 3) {
    state = 'weakening';
  } else if (positiveLevels >= 4 && weakening.length <= 1) {
    state = 'strengthening';
  } else if (improving.length > weakening.length) {
    state = 'strengthening';
  }

  const risks: SnapshotConclusion[] = [];
  if (pmiNegative) {
    risks.push(conclusion(
      'growth-pmi-below-50',
      'PMI 低于 50 荣枯线',
      `PMI 最新观察为 ${pmi.latest}，观察期为 ${pmi.observationPeriod}，低于 50；这与其他活动指标的读数需要分开理解。`,
      'risk',
      ['pmi'],
    ));
  }
  if (weakening.length >= 3) {
    risks.push(conclusion(
      'growth-synchronised-weakening',
      '多项活动指标动能走弱',
      `${weakening.length} 项活动指标的数值变化低于 -0.2 个口径单位，观察期分别为 ${periodText(weakening)}。`,
      'risk',
      weakening.map(item => item.id),
    ));
  }
  const watchNext = risks.map(risk => conclusion(
    `watch-${risk.id}`,
    `观察：${risk.title}`,
    `继续观察证据期 ${risk.evidenceIds.map(id => byId.get(id)?.observationPeriod).filter(Boolean).join('、')} 的下一次发布值。`,
    'watch',
    risk.evidenceIds,
  ));

  const explanation = state === 'strengthening'
    ? `${positiveLevels} 项活动指标处于正向水平，且改善证据多于走弱证据；水平与动量仍分别记录。`
    : state === 'weakening'
      ? `${negativeLevels} 项活动指标处于负向水平，或至少三项近期动能走弱。`
      : state === 'mixed'
        ? `活动指标存在水平与动量分化：${pmiNegative ? 'PMI 低于 50，' : ''}${weakening.length} 项指标动能走弱，保留为混合状态。`
        : '活动指标的水平与近期变化没有形成统一方向，暂保留为稳定或待观察状态。';

  return {
    id: 'growth',
    label: '增长 / 活动',
    state,
    explanation,
    evidence,
    risks,
    watchNext,
  };
}
