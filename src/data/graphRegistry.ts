import macro from '../../data/relations/macro.json';

interface GraphElement { data: { id?: string; source?: string; target?: string; [key: string]: unknown } }

const graphs = { macro } satisfies Record<string, GraphElement[]>;

export function getGraphData(graphId: string, conceptId?: string, hops = 2): GraphElement[] {
  if (!Object.prototype.hasOwnProperty.call(graphs, graphId)) throw new Error(`Unknown graph dataset: ${graphId}`);
  const graph = graphs[graphId as keyof typeof graphs] as GraphElement[];
  if (!conceptId) return graph;

  const nodeIds = new Set(graph.filter(item => item.data.id).map(item => item.data.id as string));
  if (!nodeIds.has(conceptId)) throw new Error(`Concept "${conceptId}" is missing from graph "${graphId}"`);

  const included = new Set([conceptId]);
  for (let depth = 0; depth < hops; depth++) {
    for (const item of graph) {
      const { source, target } = item.data;
      if (!source || !target) continue;
      if (included.has(source) || included.has(target)) { included.add(source); included.add(target); }
    }
  }

  return graph.filter(item => item.data.id ? included.has(item.data.id) : included.has(item.data.source!) && included.has(item.data.target!));
}
