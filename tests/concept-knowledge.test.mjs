import assert from 'node:assert/strict';
import test from 'node:test';
import { buildConceptKnowledge } from '../src/data/conceptKnowledge.ts';
import { getRelationData } from '../src/data/graphRegistry.ts';

const concepts = [
  { data: { id: 'monetary-policy', name: '货币政策', subtitle: '中央银行的政策框架' } },
  { data: { id: 'policy-rate', name: '政策利率', subtitle: '政策利率读数', chart: 'policy-rate' } },
  { data: { id: 'lpr', name: 'LPR', subtitle: '贷款定价参考', chart: 'lpr' } },
  { data: { id: 'credit', name: '人民币贷款 / 信贷', subtitle: '信贷读数', chart: 'credit' } },
  { data: { id: 'm2', name: 'M2', subtitle: '广义货币', chart: 'm2' } },
];

test('concept knowledge view reuses graph relations for indicators and transmission chain', () => {
  const knowledge = buildConceptKnowledge({
    graphId: 'macro',
    conceptId: 'monetary-policy',
    summary: '中央银行的政策框架',
    relatedIds: ['policy-rate', 'lpr', 'credit', 'm2'],
    concepts,
  });

  assert.equal(knowledge.summary, '中央银行的政策框架');
  assert.ok(knowledge.relationCount > 0);
  assert.deepEqual(knowledge.indicators.map(({ data }) => data.id), ['policy-rate', 'lpr', 'credit', 'm2']);
  assert.deepEqual(knowledge.chain.map(({ relation }) => [relation.source, relation.target]), [
    ['monetary-policy', 'policy-rate'],
    ['policy-rate', 'lpr'],
    ['lpr', 'credit'],
    ['credit', 'm2'],
  ]);
  assert.ok(knowledge.limitations.length > 0);
  assert.ok(knowledge.evidence.every(({ url }) => url.startsWith('https://')));
});

test('concept knowledge view keeps concepts without a graph compatible', () => {
  const knowledge = buildConceptKnowledge({
    conceptId: 'm2',
    summary: '广义货币',
    relatedIds: ['m2'],
    concepts,
  });

  assert.equal(knowledge.relationCount, 0);
  assert.deepEqual(knowledge.chain, []);
  assert.deepEqual(knowledge.indicators.map(({ data }) => data.id), ['m2']);
});

test('knowledge chain only uses canonical explainable relations', () => {
  const relationData = getRelationData('macro');
  const knowledge = buildConceptKnowledge({
    graphId: 'macro',
    conceptId: 'monetary-policy',
    summary: '中央银行的政策框架',
    relatedIds: [],
    concepts,
  });

  for (const { relation } of knowledge.chain) {
    assert.ok(relationData.relations.includes(relation));
    assert.ok(relation.relation);
  }
});
