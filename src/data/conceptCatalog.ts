export type ConceptEntry = {
  data: {
    id: string;
    name: string;
    subtitle: string;
    category: string;
    order: number;
    level: 'basic' | 'advanced';
    topics: readonly string[];
    prerequisites: readonly string[];
    featured: boolean;
  };
};

export type TopicEntry = {
  id: string;
  label: string;
  description: string;
  category: string;
  order: number;
};

export type ConceptCatalog<T extends ConceptEntry> = {
  concepts: T[];
  byId: Map<string, T>;
  topics: Map<string, T[]>;
};

export function sortConcepts<T extends ConceptEntry>(concepts: readonly T[]): T[] {
  return [...concepts].sort((a, b) => a.data.order - b.data.order || a.data.id.localeCompare(b.data.id));
}

export function sortTopicConcepts<T extends ConceptEntry>(members: readonly T[], byId: ReadonlyMap<string, T>): T[] {
  const memberIds = new Set(members.map((entry) => entry.data.id));
  const indegree = new Map(members.map((entry) => [entry.data.id, 0]));
  const dependents = new Map<string, T[]>();

  for (const member of members) {
    const prerequisites = byId.get(member.data.id)?.data.prerequisites ?? member.data.prerequisites;
    for (const prerequisiteId of prerequisites) {
      if (!memberIds.has(prerequisiteId)) continue;
      indegree.set(member.data.id, (indegree.get(member.data.id) ?? 0) + 1);
      dependents.set(prerequisiteId, [...(dependents.get(prerequisiteId) ?? []), member]);
    }
  }

  let layer = sortConcepts(members.filter((entry) => indegree.get(entry.data.id) === 0));
  const ordered: T[] = [];
  while (layer.length > 0) {
    const next: T[] = [];
    for (const entry of layer) {
      ordered.push(entry);
      for (const dependent of dependents.get(entry.data.id) ?? []) {
        const remaining = (indegree.get(dependent.data.id) ?? 0) - 1;
        indegree.set(dependent.data.id, remaining);
        if (remaining === 0) next.push(dependent);
      }
    }
    layer = sortConcepts(next);
  }

  if (ordered.length !== members.length) throw new Error('prerequisite cycle in topic members');
  return ordered;
}

function assertUnique(values: readonly string[], conceptId: string, field: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`${conceptId} has duplicate ${field}: ${value}`);
    seen.add(value);
  }
}

export function buildConceptCatalog<T extends ConceptEntry>(
  entries: readonly T[],
  registry: readonly TopicEntry[],
): ConceptCatalog<T> {
  const byId = new Map<string, T>();
  for (const entry of entries) {
    const id = entry.data.id;
    if (byId.has(id)) throw new Error(`Duplicate stable concept ID: ${id}`);
    byId.set(id, entry);
  }

  const topicById = new Map<string, TopicEntry>();
  for (const topic of registry) {
    if (topicById.has(topic.id)) throw new Error(`Duplicate topic ID: ${topic.id}`);
    topicById.set(topic.id, topic);
  }

  for (const entry of entries) {
    const { id, topics, prerequisites } = entry.data;
    assertUnique(topics, id, 'topic');
    for (const topicId of topics) {
      if (!topicById.has(topicId)) throw new Error(`${id} references unknown topic: ${topicId}`);
    }
    assertUnique(prerequisites, id, 'prerequisite');
    for (const prerequisiteId of prerequisites) {
      if (!byId.has(prerequisiteId)) throw new Error(`${id} references missing prerequisite: ${prerequisiteId}`);
      if (prerequisiteId === id) throw new Error(`${id} cannot list itself as a prerequisite`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string, path: string[]) => {
    if (visited.has(id)) return;
    const cycleStart = path.indexOf(id);
    if (cycleStart !== -1) {
      throw new Error(`prerequisite cycle: ${[...path.slice(cycleStart), id].join(' -> ')}`);
    }
    if (visiting.has(id)) return;
    visiting.add(id);
    const entry = byId.get(id);
    for (const prerequisiteId of entry?.data.prerequisites ?? []) visit(prerequisiteId, [...path, id]);
    visiting.delete(id);
    visited.add(id);
  };
  for (const entry of entries) visit(entry.data.id, []);

  const topicMembers = new Map<string, T[]>();
  for (const topic of registry) topicMembers.set(topic.id, []);
  for (const entry of entries) {
    for (const topicId of entry.data.topics) topicMembers.get(topicId)?.push(entry);
  }
  for (const [topicId, members] of topicMembers) topicMembers.set(topicId, sortTopicConcepts(members, byId));

  return { concepts: sortConcepts(entries), byId, topics: topicMembers };
}
