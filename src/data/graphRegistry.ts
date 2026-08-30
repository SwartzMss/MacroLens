import macro from '../../data/relations/macro.json';

export const relationTypes = [
  'CAUSES', 'AFFECTS', 'REFLECTS', 'CORRELATES', 'COMPONENT_OF',
  'IMPLEMENTS', 'USES', 'OVERLAPS_WITH', 'MEASURES', 'DERIVED_FROM'
] as const;

export type RelationType = typeof relationTypes[number];
export type RelationNode = { id: string; label: string; kind?: string };
export type Relation = { source: string; target: string; type: RelationType };
export type ConceptRelation = { relation: Relation; other: RelationNode; direction: 'incoming' | 'outgoing' | 'symmetric' };

const symmetricTypes = new Set<RelationType>(['CORRELATES', 'OVERLAPS_WITH']);

function parseGraph(elements: typeof macro) {
  const nodes = elements.filter(item => 'id' in item.data).map(item => item.data as RelationNode);
  const relations = elements.filter(item => 'source' in item.data).map(item => item.data as Relation);
  return { nodes, relations };
}

const graphs = { macro: parseGraph(macro) };

export function getRelationData(graphId: string) {
  if (!Object.prototype.hasOwnProperty.call(graphs, graphId)) throw new Error(`Unknown relationship dataset: ${graphId}`);
  return graphs[graphId as keyof typeof graphs];
}

export function isSymmetricRelation(type: RelationType) { return symmetricTypes.has(type); }

export function getConceptRelations(graphId: string, conceptId: string): ConceptRelation[] {
  const { nodes, relations } = getRelationData(graphId);
  const nodesById = new Map(nodes.map(node => [node.id, node]));
  if (!nodesById.has(conceptId)) throw new Error(`Concept "${conceptId}" is missing from relationship dataset "${graphId}"`);
  return relations.flatMap(relation => {
    if (relation.source !== conceptId && relation.target !== conceptId) return [];
    const otherId = relation.source === conceptId ? relation.target : relation.source;
    const other = nodesById.get(otherId);
    if (!other) throw new Error(`Relation references missing node "${otherId}"`);
    const direction = isSymmetricRelation(relation.type) ? 'symmetric' : relation.source === conceptId ? 'outgoing' : 'incoming';
    return [{ relation, other, direction }];
  });
}

export function getRelatedNodeIds(graphId: string, conceptId: string) {
  return getConceptRelations(graphId, conceptId).map(item => item.other.id);
}

export function getIncomingRelations(graphId: string, conceptId: string) {
  return getConceptRelations(graphId, conceptId).filter(item => item.direction === 'incoming');
}

export function getOutgoingRelations(graphId: string, conceptId: string) {
  return getConceptRelations(graphId, conceptId).filter(item => item.direction === 'outgoing');
}

export function getSymmetricRelations(graphId: string, conceptId: string) {
  return getConceptRelations(graphId, conceptId).filter(item => item.direction === 'symmetric');
}

export function requireRelation(graphId: string, source: string, target: string, type: RelationType): Relation {
  const relation = getRelationData(graphId).relations.find(item => item.source === source && item.target === target && item.type === type);
  if (!relation) throw new Error(`Missing canonical relation: ${source} --${type}--> ${target}`);
  return relation;
}
