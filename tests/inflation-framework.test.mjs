import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const conceptDirectory = fileURLToPath(new URL('../src/content/concepts/', import.meta.url));
const graphPath = fileURLToPath(new URL('../data/relations/macro.json', import.meta.url));
const homepagePath = fileURLToPath(new URL('../src/pages/index.astro', import.meta.url));

const expectedMetadata = {
  'gdp-deflator': {
    name: 'GDP 平减指数',
    category: 'inflation',
    graph: 'macro',
    level: 'basic',
    topics: ['prices-inflation', 'economic-activity'],
    prerequisites: ['gdp', 'cpi'],
  },
  'inflation-expectations': {
    name: '通胀预期',
    category: 'inflation',
    graph: 'macro',
    level: 'advanced',
    topics: ['prices-inflation'],
    prerequisites: ['cpi'],
  },
  'phillips-curve': {
    name: '菲利普斯曲线',
    category: 'inflation',
    graph: 'macro',
    level: 'advanced',
    topics: ['prices-inflation', 'economic-activity'],
    prerequisites: ['inflation-expectations', 'output-gap'],
  },
  'price-transmission': {
    name: '价格传导',
    category: 'inflation',
    graph: 'macro',
    level: 'advanced',
    topics: ['prices-inflation'],
    prerequisites: ['cpi', 'ppi'],
  },
};

const requiredTerms = {
  'gdp-deflator': ['名义GDP', '实际GDP', '国内生产', '权重', '不等于CPI'],
  'inflation-expectations': ['预期通胀', '调查', '市场价格', '实现通胀', '锚定'],
  'phillips-curve': ['失业率', '产出缺口', '通胀', '预期', '不是稳定的因果定律'],
  'price-transmission': ['上游', '下游', '成本', '需求', '传导时滞', 'PPI上涨不必然带来CPI上涨'],
};

const expectedIndicatorLabels = new Map([
  ['gdp-deflator', 'GDP 平减指数'],
  ['inflation-expectations', '通胀预期'],
  ['phillips-curve', '菲利普斯曲线'],
  ['price-transmission', '价格传导'],
]);

const expectedAbstractLabels = new Map([
  ['economy-wide-price-level', '经济整体价格水平'],
  ['price-setting', '价格设定'],
  ['inflation-pressure', '通胀压力'],
  ['inflation-slack-relationship', '通胀与经济松弛关系'],
  ['downstream-price-pressure', '下游价格压力'],
  ['upstream-downstream-price-pass-through', '上下游价格传导'],
]);

const expectedRelations = [
  ['gdp-deflator', 'economy-wide-price-level', 'MEASURES'],
  ['inflation-expectations', 'price-setting', 'AFFECTS'],
  ['inflation-expectations', 'real-interest-rate', 'AFFECTS'],
  ['output-gap', 'inflation-pressure', 'CORRELATES'],
  ['phillips-curve', 'inflation-slack-relationship', 'REFLECTS'],
  ['ppi', 'downstream-price-pressure', 'AFFECTS'],
  ['price-transmission', 'upstream-downstream-price-pass-through', 'REFLECTS'],
];

const canonicalRelationTypes = new Set([
  'CAUSES', 'AFFECTS', 'REFLECTS', 'CORRELATES', 'COMPONENT_OF',
  'IMPLEMENTS', 'USES', 'OVERLAPS_WITH', 'MEASURES', 'DERIVED_FROM',
]);

function readConcept(id) {
  const path = `${conceptDirectory}/${id}.md`;
  assert.equal(existsSync(path), true, `${id} concept page is missing`);
  return readFileSync(path, 'utf8');
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function parseFrontmatter(document) {
  const match = document.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, 'concept must have leading YAML frontmatter');
  return Object.fromEntries(match[1].split('\n').map((line) => {
    const colon = line.indexOf(':');
    assert.notEqual(colon, -1, `invalid frontmatter line: ${line}`);
    const key = line.slice(0, colon).trim();
    const rawValue = line.slice(colon + 1).trim();
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      const contents = rawValue.slice(1, -1).trim();
      return [key, contents ? contents.split(',').map(parseScalar) : []];
    }
    if (rawValue.startsWith('{') && rawValue.endsWith('}')) {
      const contents = rawValue.slice(1, -1).trim();
      return [key, Object.fromEntries(contents ? contents.split(',').map((entry) => {
        const entryColon = entry.indexOf(':');
        assert.notEqual(entryColon, -1, `invalid inline map entry: ${entry}`);
        return [entry.slice(0, entryColon).trim(), parseScalar(entry.slice(entryColon + 1))];
      }) : [])];
    }
    return [key, parseScalar(rawValue)];
  }));
}

function relationKey({ source, target, type }) {
  return `${source}\0${target}\0${type}`;
}

for (const [id, metadataExpectation] of Object.entries(expectedMetadata)) {
  test(`${id} has the approved metadata and explanatory terms`, () => {
    const document = readConcept(id);
    const metadata = parseFrontmatter(document);

    assert.deepEqual({
      id: metadata.id,
      name: metadata.name,
      category: metadata.category,
      graph: metadata.graph,
      level: metadata.level,
      topics: metadata.topics,
      prerequisites: metadata.prerequisites,
    }, { id, ...metadataExpectation });

    for (const term of requiredTerms[id]) {
      assert.ok(document.includes(term), `${id} must explain ${term}`);
    }
  });
}

test('registers inflation framework graph nodes with stable labels', () => {
  const elements = JSON.parse(readFileSync(graphPath, 'utf8'));
  const rawNodes = elements.filter((item) => 'id' in item.data).map((item) => item.data);
  const nodes = new Map(rawNodes.map((node) => [node.id, node]));

  assert.equal(new Set(rawNodes.map((node) => node.id)).size, rawNodes.length, 'graph node IDs must be unique');

  for (const [id, label] of expectedIndicatorLabels) {
    assert.equal(nodes.get(id)?.label, label, `missing indicator node ${id}`);
    assert.equal(nodes.get(id)?.kind, 'indicator', `${id} must be an indicator node`);
  }
  for (const [id, label] of expectedAbstractLabels) {
    assert.equal(nodes.get(id)?.label, label, `missing abstract node ${id}`);
    assert.equal(Object.hasOwn(nodes.get(id), 'kind'), false, `${id} must remain an abstract node`);
  }
});

test('uses exactly the approved non-causal inflation framework relations', () => {
  const elements = JSON.parse(readFileSync(graphPath, 'utf8'));
  const rawNodes = elements.filter((item) => 'id' in item.data).map((item) => item.data);
  const nodes = new Map(rawNodes.map((node) => [node.id, node]));
  const relations = elements.filter((item) => 'source' in item.data).map((item) => item.data);
  const relationKeys = relations.map(relationKey);
  const clusterNodeIds = new Set([...expectedIndicatorLabels.keys(), ...expectedAbstractLabels.keys()]);
  const expectedRelationKeys = expectedRelations.map(([source, target, type]) => relationKey({ source, target, type }));
  const clusterRelations = relations.filter(
    (relation) => clusterNodeIds.has(relation.source) || clusterNodeIds.has(relation.target),
  );

  assert.equal(new Set(relationKeys).size, relations.length, 'graph relation triples must be unique');
  for (const relation of relations) {
    assert.ok(nodes.has(relation.source), `missing source node ${relation.source}`);
    assert.ok(nodes.has(relation.target), `missing target node ${relation.target}`);
    assert.ok(canonicalRelationTypes.has(relation.type), `unknown relation type ${relation.type}`);
  }

  assert.deepEqual(clusterRelations.map(relationKey).sort(), expectedRelationKeys.sort());
  assert.equal(clusterRelations.some((relation) => relation.type === 'CAUSES'), false, 'inflation relations must not claim causality');
});

test('keeps the curated homepage free of inflation framework concept IDs', () => {
  const homepage = readFileSync(homepagePath, 'utf8');
  for (const id of Object.keys(expectedMetadata)) {
    assert.equal(homepage.includes(id), false, `homepage must not mention ${id}`);
  }
});
