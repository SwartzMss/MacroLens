import macro from '../../data/relations/macro.json';

interface GraphElement { data: { id?: string; source?: string; target?: string; [key: string]: unknown } }

const graphs = { macro } satisfies Record<string, GraphElement[]>;

export function getGraphOverview(graphId: string, stableIds: readonly string[]): GraphElement[] {
  if (!Object.prototype.hasOwnProperty.call(graphs, graphId)) throw new Error(`Unknown graph dataset: ${graphId}`);
  const graph = graphs[graphId as keyof typeof graphs] as GraphElement[];
  const available = new Set(graph.filter(item => item.data.id).map(item => item.data.id as string));
  const requested = new Set(stableIds);
  const missing = stableIds.filter(id => !available.has(id));
  if (missing.length) throw new Error(`Overview nodes missing from graph "${graphId}": ${missing.join(', ')}`);
  return graph.filter(item => item.data.id
    ? requested.has(item.data.id)
    : requested.has(item.data.source!) && requested.has(item.data.target!));
}

export function getGraphData(graphId: string, conceptId?: string, hops = 2): GraphElement[] {
  if (!Object.prototype.hasOwnProperty.call(graphs, graphId)) throw new Error(`Unknown graph dataset: ${graphId}`);
  const graph = graphs[graphId as keyof typeof graphs] as GraphElement[];
  if (!conceptId) return graph;

  const nodeIds = new Set(graph.filter(item => item.data.id).map(item => item.data.id as string));
  if (!nodeIds.has(conceptId)) throw new Error(`Concept "${conceptId}" is missing from graph "${graphId}"`);

  const included = new Set([conceptId]);
  let frontier = new Set([conceptId]);
  for (let depth = 0; depth < hops; depth++) {
    const next = new Set<string>();
    for (const item of graph) {
      const { source, target } = item.data;
      if (!source || !target) continue;
      if (frontier.has(source) && !included.has(target)) next.add(target);
      if (frontier.has(target) && !included.has(source)) next.add(source);
    }
    if (next.size === 0) break;
    for (const id of next) included.add(id);
    frontier = next;
  }

  return graph.filter(item => item.data.id ? included.has(item.data.id) : included.has(item.data.source!) && included.has(item.data.target!));
}
