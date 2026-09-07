import { makeIndicatorEvidence } from './evidence';
import type { MacroDomainState, MacroIndicatorMap, SnapshotConclusion, SnapshotEvidence } from './types';

const ids = ['exports', 'imports'] as const;

function conclusion(
  id: string,
  title: string,
  explanation: string,
  kind: 'risk' | 'watch',
  evidenceIds: string[],
): SnapshotConclusion {
  return { id, title, explanation, kind, evidenceIds };
}

function direction(item: SnapshotEvidence): 'strengthening' | 'weakening' | 'stable' {
  if (item.change !== null && item.change > 0.2 && item.latest >= 0) return 'strengthening';
  if (item.latest < 0 || (item.change !== null && item.change < -0.2)) return 'weakening';
  return 'stable';
}

export function analyzeExternal(indicators: MacroIndicatorMap): MacroDomainState {
  const evidence = ids.flatMap(id => makeIndicatorEvidence(indicators[id], id));
  const byId = new Map(evidence.map(item => [item.id, item]));
  const exportState = direction(byId.get('exports')!);
  const importState = direction(byId.get('imports')!);
  const state: MacroDomainState['state'] = exportState !== importState
    ? 'divergent'
    : exportState === 'strengthening'
      ? 'strengthening'
      : exportState === 'weakening'
        ? 'weakening'
        : 'stable';
  const evidenceIds = evidence.map(item => item.id);
  const risks = state === 'divergent'
    ? [conclusion(
      'external-exports-imports-divergence',
      '出口与进口方向分化',
      `出口证据为${exportState}，进口证据为${importState}；这只描述海关贸易数据的分化，不据此推出国内需求或增长因果。`,
      'risk',
      evidenceIds,
    )]
    : [];
  const watchNext = risks.map(risk => conclusion(
    `watch-${risk.id}`,
    `观察：${risk.title}`,
    `继续观察出口与进口下一期发布值及其各自观察期。`,
    'watch',
    risk.evidenceIds,
  ));

  return {
    id: 'external',
    label: '外部',
    state,
    explanation: state === 'divergent'
      ? '出口和进口的最新增长读数或动量方向不同，保留为外部部门分化状态。'
      : `出口和进口证据大体同向为${state}，仍只描述海关货物贸易数据自身。`,
    evidence,
    risks,
    watchNext,
  };
}
