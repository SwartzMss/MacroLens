import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateGraphElements } from '../src/data/graphRegistry.ts';

const graphPath = fileURLToPath(new URL('../data/relations/macro.json', import.meta.url));
const graph = JSON.parse(readFileSync(graphPath, 'utf8'));
const nodes = graph.filter((element) => 'id' in element.data).map((element) => element.data);
const nodesById = new Map(nodes.map((node) => [node.id, node]));
const correctedNodeTypes = {
  'central-bank': 'concept',
  government: 'concept',
  'phillips-curve': 'mechanism',
  'price-transmission': 'mechanism',
  'interest-rate-parity': 'mechanism',
  'carry-trade': 'mechanism',
  'capital-controls': 'concept',
  'impossible-trinity': 'concept',
};

test('formalizes every macro graph node with a semantic type', () => {
  const allowedTypes = new Set(['indicator', 'concept', 'mechanism', 'state']);

  assert.deepEqual(new Set(nodes.map((node) => node.type)), allowedTypes);
  for (const node of nodes) {
    assert.equal(typeof node.type, 'string', `${node.id} needs an explicit node type`);
    assert.equal(allowedTypes.has(node.type), true, `${node.id} has an invalid node type`);
    if (node.kind !== undefined) assert.equal(node.kind, 'indicator');
  }

  assert.equal(nodes.find((node) => node.id === 'm2')?.type, 'indicator');
  assert.equal(nodes.find((node) => node.id === 'monetary-policy')?.type, 'concept');
  assert.equal(nodes.find((node) => node.id === 'financing-conditions')?.type, 'mechanism');
  assert.equal(nodes.find((node) => node.id === 'consumer-price-pressure')?.type, 'state');
  assert.equal(nodes.find((node) => node.id === 'activity')?.type, 'state');
  assert.doesNotThrow(() => validateGraphElements(graph));
});

test('classifies frameworks, mechanisms, policy constructs, and institutions semantically', () => {
  for (const [id, expectedType] of Object.entries(correctedNodeTypes)) {
    assert.equal(nodesById.get(id)?.type, expectedType, `${id} should be a ${expectedType}`);
  }

  for (const id of Object.keys(correctedNodeTypes)) {
    assert.equal(nodesById.get(id)?.kind, undefined, `${id} must not retain the legacy indicator kind`);
  }
});

test('keeps the audited graph inventory and legacy indicator alias consistent', () => {
  const relations = graph.filter((element) => 'source' in element.data).map((element) => element.data);
  const nodeIds = new Set(nodes.map((node) => node.id));

  assert.equal(nodes.length, 143);
  assert.equal(relations.length, 143);
  assert.equal(nodeIds.size, nodes.length);
  for (const node of nodes) {
    if (node.kind !== undefined) assert.equal(node.type, 'indicator', `${node.id} has a non-indicator legacy kind`);
  }
  for (const relation of relations) {
    assert.equal(nodeIds.has(relation.source), true, `missing source node: ${relation.source}`);
    assert.equal(nodeIds.has(relation.target), true, `missing target node: ${relation.target}`);
  }
});

test('rejects missing, unknown, and inconsistent node type metadata', () => {
  const relation = { data: { source: 'a', target: 'b', type: 'AFFECTS' } };
  const node = (id, type, extra = {}) => ({ data: { id, label: id, ...(type === undefined ? {} : { type }), ...extra } });

  assert.throws(
    () => validateGraphElements([node('a'), node('b', 'concept'), relation]),
    /Invalid macro node type for a/,
  );
  assert.throws(
    () => validateGraphElements([node('a', 'unknown'), node('b'), relation]),
    /Invalid macro node type for a/,
  );
  assert.throws(
    () => validateGraphElements([node('a', 'state', { kind: 'indicator' }), node('b'), relation]),
    /Inconsistent legacy node kind for a/,
  );
});
