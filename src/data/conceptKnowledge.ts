import {
  getConceptRelations,
  getRelationData,
  isExplainableRelation,
  type Relation,
  type RelationNode,
} from './graphRegistry';

export type KnowledgeConcept = {
  data: {
    id: string;
    name: string;
    subtitle: string;
    chart?: string;
  };
};

export type KnowledgeNode = RelationNode & {
  href?: string;
};

export type KnowledgeChainStep = {
  relation: Relation;
  source: KnowledgeNode;
  target: KnowledgeNode;
};

export type ConceptKnowledge = {
  summary: string;
  relationCount: number;
  indicators: KnowledgeConcept[];
  chain: KnowledgeChainStep[];
  limitations: string[];
  evidence: Array<{ title: string; url: string }>;
};

type BuildConceptKnowledgeOptions = {
  graphId?: string;
  conceptId: string;
  summary: string;
  relatedIds: readonly string[];
  concepts: readonly KnowledgeConcept[];
};

function unique<T>(values: readonly T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const valueKey = key(value);
    if (seen.has(valueKey)) return false;
    seen.add(valueKey);
    return true;
  });
}

function longestChain(
  start: string,
  relationsBySource: ReadonlyMap<string, Relation[]>,
  visited = new Set<string>(),
  depth = 0,
): Relation[] {
  if (depth >= 4) return [];

  const candidates = (relationsBySource.get(start) ?? [])
    .filter((relation) => !visited.has(relation.target))
    .sort((left, right) => {
      const rank = (relation: Relation) => relation.relation === 'transmission' ? 0 : relation.relation === 'leading_factor' ? 1 : 2;
      return rank(left) - rank(right);
    });

  let best: Relation[] = [];
  for (const relation of candidates) {
    const nextVisited = new Set(visited).add(relation.source).add(relation.target);
    const path = [relation, ...longestChain(relation.target, relationsBySource, nextVisited, depth + 1)];
    if (path.length > best.length) best = path;
  }
  return best;
}

export function buildConceptKnowledge({
  graphId,
  conceptId,
  summary,
  relatedIds,
  concepts,
}: BuildConceptKnowledgeOptions): ConceptKnowledge {
  const conceptsById = new Map(concepts.map((concept) => [concept.data.id, concept]));
  const graphNodes = graphId ? getRelationData(graphId).nodes : [];
  const directRelations = graphId ? getConceptRelations(graphId, conceptId) : [];
  const directIndicatorIds = new Set(
    directRelations
      .filter(({ other }) => other.kind === 'indicator')
      .map(({ other }) => other.id),
  );
  const indicatorOrder = unique(
    [...relatedIds, ...directIndicatorIds],
    (id) => id,
  );
  const indicators = indicatorOrder
    .map((id) => conceptsById.get(id))
    .filter((concept): concept is KnowledgeConcept => Boolean(concept?.data.chart));

  const explainableRelations = directRelations
    .map(({ relation }) => relation)
    .filter(isExplainableRelation);
  const relationsBySource = new Map<string, Relation[]>();
  if (graphId) {
    for (const relation of getRelationData(graphId).relations.filter(isExplainableRelation)) {
      relationsBySource.set(relation.source, [...(relationsBySource.get(relation.source) ?? []), relation]);
    }
  }
  const chainRelations = longestChain(conceptId, relationsBySource, new Set([conceptId]));
  const nodeView = (node: RelationNode): KnowledgeNode => ({
    ...node,
    label: conceptsById.get(node.id)?.data.name ?? node.label,
    ...(conceptsById.has(node.id) ? { href: `/concepts/${node.id}` } : {}),
  });
  const nodesForChain = new Map(graphNodes.map((node) => [node.id, nodeView(node)]));
  const chain = chainRelations.flatMap((relation) => {
    const source = nodesForChain.get(relation.source);
    const target = nodesForChain.get(relation.target);
    return source && target ? [{ relation, source, target }] : [];
  });

  const limitations = unique(
    explainableRelations.flatMap((relation) => relation.limitations),
    (limitation) => limitation,
  ).slice(0, 6);
  const evidence = unique(
    explainableRelations.flatMap((relation) => relation.evidence),
    (item) => item.url,
  ).slice(0, 6);

  return {
    summary,
    relationCount: directRelations.length,
    indicators,
    chain,
    limitations,
    evidence,
  };
}
