import {
  dashboardIndicatorIds,
  getDashboardIndicators,
  type DashboardIndicator,
  type DashboardIndicatorId,
} from './dashboard';

export const macroSnapshotRulesVersion = '2026-09-05';

type SignalFamily = 'pmi' | 'activity-growth' | 'monetary-growth';
export type SnapshotEvidence = {
  id: DashboardIndicatorId;
  name: string;
  conceptHref: string;
  latest: number;
  previous: number | null;
  change: number | null;
  period: string;
  unit: string;
};

export type SnapshotSignal = SnapshotEvidence & {
  family: SignalFamily;
  fact: string;
  interpretation: string;
};

export type SnapshotConclusion = {
  id: string;
  title: string;
  explanation: string;
  kind: 'risk' | 'watch';
  evidenceIds: DashboardIndicatorId[];
};

export type SnapshotPhase = {
  label: '扩张信号' | '收缩压力' | '增长放缓' | '混合信号';
  explanation: string;
  evidenceIds: DashboardIndicatorId[];
};

export type MacroSnapshot = {
  rulesVersion: string;
  asOf: string;
  phase: SnapshotPhase;
  signals: SnapshotSignal[];
  risks: SnapshotConclusion[];
  watchNext: SnapshotConclusion[];
};

const activityIds: DashboardIndicatorId[] = [
  'pmi', 'gdp', 'industrial-production', 'retail-sales', 'fixed-asset-investment',
];
const growthIds: DashboardIndicatorId[] = [
  'gdp', 'industrial-production', 'retail-sales', 'fixed-asset-investment',
];
const monetaryIds: DashboardIndicatorId[] = ['m0', 'm1', 'm2'];
const weakeningBoundary = -0.2;
const improvingBoundary = 0.2;

const formatValue = (value: number, unit: string) => `${value.toFixed(1)}${unit === '%' ? '%' : ''}`;
const formatChange = (change: number | null, unit: string) => {
  if (change === null) return '无可比上一期';
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}${unit === '%' ? '%' : ''}`;
};

function changeInterpretation(change: number | null): 'improving' | 'weakening' | 'stable' {
  if (change === null || (change >= weakeningBoundary && change <= improvingBoundary)) return 'stable';
  return change > improvingBoundary ? 'improving' : 'weakening';
}

function makeEvidence(indicator: DashboardIndicator): SnapshotEvidence {
  return {
    id: indicator.id,
    name: indicator.name,
    conceptHref: indicator.conceptHref,
    latest: indicator.latest.value,
    previous: indicator.previous?.value ?? null,
    change: indicator.change,
    period: indicator.latest.date,
    unit: indicator.dataset.unit,
  };
}

function classifyPmi(indicator: DashboardIndicator): SnapshotSignal {
  const evidence = makeEvidence(indicator);
  const momentum = changeInterpretation(indicator.change);
  const level = indicator.latest.value >= 50 ? '达到或高于 50 的扩张阈值' : '低于 50 的扩张阈值';
  const momentumText = momentum === 'improving' ? '，较上一期改善' : momentum === 'weakening' ? '，较上一期走弱' : '，较上一期基本稳定';
  return {
    ...evidence,
    family: 'pmi',
    fact: `${indicator.name}最新为 ${formatValue(indicator.latest.value, indicator.dataset.unit)}（${indicator.latest.date}），较上一期${formatChange(indicator.change, indicator.dataset.unit)}。`,
    interpretation: `按 PMI 50 荣枯线规则，当前${level}${momentumText}。`,
  };
}

function classifyGrowth(indicator: DashboardIndicator): SnapshotSignal {
  const evidence = makeEvidence(indicator);
  const momentum = changeInterpretation(indicator.change);
  const level = indicator.latest.value > 0 ? '正增长' : '非正增长';
  const momentumText = momentum === 'improving' ? '改善' : momentum === 'weakening' ? '走弱或放缓' : '基本稳定';
  return {
    ...evidence,
    family: 'activity-growth',
    fact: `${indicator.name}最新为 ${formatValue(indicator.latest.value, indicator.dataset.unit)}（${indicator.latest.date}），较上一期${formatChange(indicator.change, indicator.dataset.unit)}。`,
    interpretation: `按该指标的增长率口径，当前为${level}，变化动能${momentumText}。`,
  };
}

function classifyMonetaryGrowth(indicator: DashboardIndicator): SnapshotSignal {
  const evidence = makeEvidence(indicator);
  const weakening = indicator.change !== null && indicator.change < weakeningBoundary;
  return {
    ...evidence,
    family: 'monetary-growth',
    fact: `${indicator.name}最新增速为 ${formatValue(indicator.latest.value, indicator.dataset.unit)}（${indicator.latest.date}），较上一期${formatChange(indicator.change, indicator.dataset.unit)}。`,
    interpretation: weakening
      ? '按货币增速自身的变化，当前货币增速动能走弱，需继续观察；这不直接推出需求、价格或资产价格结论。'
      : '当前仅报告货币增速及其变化，不据此推出需求、价格或资产价格结论。',
  };
}

function derivePhase(signals: SnapshotSignal[]): SnapshotPhase {
  const byId = new Map(signals.map((signal) => [signal.id, signal]));
  const activity = activityIds.map((id) => byId.get(id)!);
  const positiveCount = activity.filter((signal) => signal.id === 'pmi'
    ? signal.latest >= 50
    : signal.latest > 0).length;
  const negativeIds = activity.filter((signal) => signal.id === 'pmi'
    ? signal.latest < 50
    : signal.latest <= 0).map((signal) => signal.id);
  const weakeningIds = activity.filter((signal) => signal.change !== null && signal.change < weakeningBoundary).map((signal) => signal.id);

  if (positiveCount >= 4 && weakeningIds.length <= 1) {
    return {
      label: '扩张信号',
      explanation: `五项活动指标中有 ${positiveCount} 项达到正向水平，且仅 ${weakeningIds.length} 项动能走弱，符合扩张信号规则。`,
      evidenceIds: activityIds,
    };
  }
  if (negativeIds.length >= 3) {
    return {
      label: '收缩压力',
      explanation: `${negativeIds.length} 项活动指标处于非正向水平，达到收缩压力规则。`,
      evidenceIds: negativeIds,
    };
  }
  if (weakeningIds.length >= 3) {
    return {
      label: '增长放缓',
      explanation: `${weakeningIds.length} 项活动指标较上一期走弱，达到增长放缓规则。`,
      evidenceIds: weakeningIds,
    };
  }
  return {
    label: '混合信号',
    explanation: '活动指标的水平和变化未同时满足扩张、收缩压力或增长放缓规则，因此保留为混合信号。',
    evidenceIds: activityIds,
  };
}

function makeRisk(
  id: string,
  title: string,
  explanation: string,
  evidenceIds: DashboardIndicatorId[],
): SnapshotConclusion {
  return { id, title, explanation, kind: 'risk', evidenceIds };
}

function deriveRisks(signals: SnapshotSignal[]): SnapshotConclusion[] {
  const byId = new Map(signals.map((signal) => [signal.id, signal]));
  const pmi = byId.get('pmi')!;
  const activity = activityIds.map((id) => byId.get(id)!);
  const weakeningActivity = activity.filter((signal) => signal.change !== null && signal.change < weakeningBoundary);
  const nonPositiveActivity = activity.filter((signal) => signal.id === 'pmi'
    ? signal.latest < 50
    : signal.latest <= 0);
  const weakeningMonetary = monetaryIds
    .map((id) => byId.get(id)!)
    .filter((signal) => signal.change !== null && signal.change < weakeningBoundary);
  const risks: SnapshotConclusion[] = [];

  if (pmi.latest < 50) {
    risks.push(makeRisk(
      'pmi-below-threshold',
      '制造业景气低于荣枯线',
      `PMI 最新为 ${formatValue(pmi.latest, pmi.unit)}，低于 50 的扩张阈值。`,
      ['pmi'],
    ));
  }
  if (weakeningActivity.length >= 3) {
    risks.push(makeRisk(
      'activity-synchronised-weakening',
      '活动指标近期同步走弱',
      `共有 ${weakeningActivity.length} 项活动指标较上一期走弱，达到同步走弱规则。`,
      weakeningActivity.map((signal) => signal.id),
    ));
  }
  if (nonPositiveActivity.some((signal) => signal.id !== 'pmi')) {
    risks.push(makeRisk(
      'non-positive-activity-growth',
      '存在负增长或负累计增长信号',
      '至少一项增长类活动指标处于非正增长水平，需要结合其自身口径继续观察。',
      nonPositiveActivity.filter((signal) => signal.id !== 'pmi').map((signal) => signal.id),
    ));
  }
  if (weakeningMonetary.length > 0) {
    risks.push(makeRisk(
      'monetary-growth-momentum-weakening',
      '货币增速动能走弱',
      '至少一项货币增速较上一期走弱；这只说明货币增速本身的变化，不断言其对需求、价格或资产价格的传导结果。',
      weakeningMonetary.map((signal) => signal.id),
    ));
  }
  return risks;
}

function deriveWatchNext(risks: SnapshotConclusion[], phase: SnapshotPhase, signals: SnapshotSignal[]): SnapshotConclusion[] {
  if (risks.length === 0) {
    return [{
      id: 'watch-next-observation',
      title: '继续观察下一期数据',
      explanation: '当前没有触发独立风险规则，继续观察下一期活动与货币数据发布后的变化。',
      kind: 'watch',
      evidenceIds: phase.evidenceIds,
    }];
  }
  const byId = new Map(signals.map((signal) => [signal.id, signal]));
  return risks.map((risk) => {
    const periods = risk.evidenceIds
      .map((id) => byId.get(id)?.period)
      .filter(Boolean)
      .join('、');
    return {
      id: `watch-${risk.id}`,
      title: `观察：${risk.title}`,
      explanation: `当前证据期为 ${periods}，继续观察相关指标下一期发布值是否延续该变化。`,
      kind: 'watch' as const,
      evidenceIds: risk.evidenceIds,
    };
  });
}

function validateIndicators(indicators: DashboardIndicator[]): Map<DashboardIndicatorId, DashboardIndicator> {
  const map = new Map(indicators.map((indicator) => [indicator.id, indicator]));
  const missing = dashboardIndicatorIds.filter((id) => !map.has(id));
  if (missing.length > 0) throw new Error(`Macro snapshot missing required indicators: ${missing.join(', ')}`);
  if (map.size !== dashboardIndicatorIds.length || indicators.length !== dashboardIndicatorIds.length) {
    throw new Error('Macro snapshot received unexpected or duplicate indicators');
  }
  return map;
}

export function buildMacroSnapshot(indicators: DashboardIndicator[] = getDashboardIndicators()): MacroSnapshot {
  const byId = validateIndicators(indicators);
  const signals = dashboardIndicatorIds.map((id) => {
    const indicator = byId.get(id)!;
    if (id === 'pmi') return classifyPmi(indicator);
    if (growthIds.includes(id)) return classifyGrowth(indicator);
    return classifyMonetaryGrowth(indicator);
  });
  const phase = derivePhase(signals);
  const risks = deriveRisks(signals);
  return {
    rulesVersion: macroSnapshotRulesVersion,
    asOf: dashboardIndicatorIds.map((id) => byId.get(id)!.dataset.updatedAt).sort().at(-1)!,
    phase,
    signals,
    risks,
    watchNext: deriveWatchNext(risks, phase, signals),
  };
}
