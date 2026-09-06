import macro from '../../data/relations/macro.json';

export const relationTypes = [
  'CAUSES', 'AFFECTS', 'REFLECTS', 'CORRELATES', 'COMPONENT_OF',
  'IMPLEMENTS', 'USES', 'OVERLAPS_WITH', 'MEASURES', 'DERIVED_FROM'
] as const;

export type RelationType = typeof relationTypes[number];
export type RelationNode = { id: string; label: string; kind?: string };
export const explainableRelationTypes = [
  'leading_indicator',
  'leading_factor',
  'synchronous_indicator',
  'lagging_indicator',
  'transmission',
] as const;
export type ExplainableRelationType = typeof explainableRelationTypes[number];
export type RelationshipMetadata = {
  relation: ExplainableRelationType;
  lag: string;
  explanation: string;
};
export type Relation = { source: string; target: string; type: RelationType } & Partial<RelationshipMetadata>;
export type ConceptRelation = { relation: Relation; other: RelationNode; direction: 'incoming' | 'outgoing' | 'symmetric' };
type RawGraphElement = { data: Record<string, unknown> };

const symmetricTypes = new Set<RelationType>(['CORRELATES', 'OVERLAPS_WITH']);

export function isExplainableRelation(relation: Relation): relation is Relation & RelationshipMetadata {
  return explainableRelationTypes.includes(relation.relation as ExplainableRelationType)
    && typeof relation.lag === 'string'
    && relation.lag.trim().length > 0
    && typeof relation.explanation === 'string'
    && relation.explanation.trim().length > 0;
}

export function validateGraphElements(elements: readonly RawGraphElement[]) {
  const nodes = elements.filter(item => 'id' in item.data).map(item => item.data as RelationNode);
  const relations = elements.filter(item => 'source' in item.data).map(item => item.data as Relation);
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) throw new Error(`Duplicate graph node ID: ${node.id}`);
    nodeIds.add(node.id);
  }
  const relationKeys = new Set<string>();
  const forbiddenFields = ['causal_effect', 'impact_strength', 'confidence_score'];
  for (const relation of relations) {
    if (!relationTypes.includes(relation.type)) throw new Error(`Unknown graph relation type: ${relation.type}`);
    if (!nodeIds.has(relation.source)) throw new Error(`Relation references missing node: ${relation.source}`);
    if (!nodeIds.has(relation.target)) throw new Error(`Relation references missing node: ${relation.target}`);
    const key = `${relation.source}\0${relation.target}\0${relation.type}`;
    if (relationKeys.has(key)) throw new Error(`Duplicate graph relation: ${key}`);
    relationKeys.add(key);
    for (const field of forbiddenFields) {
      if (Object.hasOwn(relation, field)) throw new Error(`Forbidden relationship field: ${field}`);
    }
    const hasMetadata = relation.relation !== undefined || relation.lag !== undefined || relation.explanation !== undefined;
    if (!hasMetadata) continue;
    if (relation.relation !== undefined && !explainableRelationTypes.includes(relation.relation as ExplainableRelationType)) {
      throw new Error(`Unknown explainable relationship type: ${relation.relation}`);
    }
    if (!isExplainableRelation(relation)) throw new Error(`Incomplete explainable relationship metadata: ${relation.source} -> ${relation.target}`);
  }
}

function parseGraph(elements: typeof macro) {
  validateGraphElements(elements);
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
    const hasSymmetricExplainableSemantics = isExplainableRelation(relation)
      && relation.relation === 'synchronous_indicator'
      && isSymmetricRelation(relation.type);
    const direction = hasSymmetricExplainableSemantics || (!isExplainableRelation(relation) && isSymmetricRelation(relation.type))
      ? 'symmetric'
      : relation.source === conceptId ? 'outgoing' : 'incoming';
    return [{ relation, other, direction }];
  });
}

export function getExplainableConceptRelations(graphId: string, conceptId: string): ConceptRelation[] {
  return getConceptRelations(graphId, conceptId).filter(item => isExplainableRelation(item.relation));
}

export function getExplainableRelationData(graphId: string) {
  const { nodes, relations } = getRelationData(graphId);
  const explainableRelations = relations.filter(isExplainableRelation);
  const nodeIds = new Set(explainableRelations.flatMap(relation => [relation.source, relation.target]));
  return { nodes: nodes.filter(node => nodeIds.has(node.id)), relations: explainableRelations };
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
