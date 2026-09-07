import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateGraphElements } from '../src/data/graphRegistry.ts';

const graphPath = fileURLToPath(new URL('../data/relations/macro.json', import.meta.url));
const graph = JSON.parse(readFileSync(graphPath, 'utf8'));
const nodes = graph.filter((element) => 'id' in element.data).map((element) => element.data);

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
