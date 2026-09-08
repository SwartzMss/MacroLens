import type { Relation, RelationNode } from './graphRegistry';
import { getRelationData, requireRelation } from './graphRegistry';
import type { MacroSnapshot, SnapshotEvidence } from './macroSnapshot';

export const homepageNotableSignalIds = [
  'pmi', 'gdp', 'fixed-asset-investment', 'unemployment-rate', 'm2',
] as const;

export type HomepageNotableSignalId = typeof homepageNotableSignalIds[number];

export type HomepageNotableSignal = SnapshotEvidence & { id: HomepageNotableSignalId };
export type LearningPath = {
  number: string;
  title: string;
  description: string;
  steps: { id: string; label: string }[];
};

const previewRelations = [
  ['central-bank', 'monetary-policy', 'IMPLEMENTS'],
  ['monetary-policy', 'policy-rate', 'USES'],
  ['policy-rate', 'financing-conditions', 'AFFECTS'],
  ['financing-conditions', 'credit', 'AFFECTS'],
  ['credit', 'm2', 'AFFECTS'],
  ['m2', 'activity', 'CORRELATES'],
] as const;

export function getHomepageRelationshipPreview(): Relation[] {
  return previewRelations.map(([source, target, type]) => requireRelation('macro', source, target, type));
}

export const learningPaths: LearningPath[] = [
  {
    number: '01',
    title: '钱是什么？',
    description: '从最窄的现金到更广义的货币总量，先建立口径感。',
    steps: [{ id: 'm0', label: 'M0' }, { id: 'm1', label: 'M1' }, { id: 'm2', label: 'M2' }],
  },
  {
    number: '02',
    title: '钱是怎么创造出来的？',
    description: '沿着信贷、存款和社融理解货币如何进入实体经济。',
    steps: [{ id: 'credit', label: '信贷' }, { id: 'm2', label: '存款 / M2' }, { id: 'social-financing', label: '社融' }],
  },
  {
    number: '03',
    title: '央行怎么影响经济？',
    description: '从政策工具走到利率、融资条件和信用需求。',
    steps: [{ id: 'monetary-policy', label: '货币政策' }, { id: 'policy-rate', label: '政策利率' }, { id: 'lpr', label: 'LPR' }, { id: 'credit', label: '信贷' }],
  },
  {
    number: '04',
    title: '价格为什么变化？',
    description: '区分生产端、居民端和核心价格信号的观察角度。',
    steps: [{ id: 'ppi', label: 'PPI' }, { id: 'cpi', label: 'CPI' }, { id: 'core-cpi', label: '核心 CPI' }],
  },
];

export function getNotableSignals(snapshot: MacroSnapshot): HomepageNotableSignal[] {
  const evidence = new Map(snapshot.domains.flatMap((domain) => domain.evidence).map((item) => [item.id, item]));
  return homepageNotableSignalIds.map((id) => {
    const item = evidence.get(id);
    if (!item) throw new Error(`Homepage notable signal missing from Macro Snapshot: ${id}`);
    return { ...item, id };
  });
}

export function getHomepageRelationNodes(): RelationNode[] {
  const ids = new Set(getHomepageRelationshipPreview().flatMap((relation) => [relation.source, relation.target]));
  return getRelationData('macro').nodes.filter((node) => ids.has(node.id));
}
