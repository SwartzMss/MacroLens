import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const conceptDirectory = `${root}src/content/concepts/`;
const homepagePath = `${root}src/pages/index.astro`;

const expectedMetadata = {
  productivity: { name: '劳动生产率', category: 'growth', topics: ['structural-growth', 'economic-activity'], prerequisites: ['gdp'], order: 7 },
  'total-factor-productivity': { name: '全要素生产率（TFP）', category: 'growth', topics: ['structural-growth', 'economic-activity'], prerequisites: ['productivity'], order: 8 },
  'working-age-population': { name: '劳动年龄人口', category: 'labor', topics: ['structural-growth', 'labor-market'], prerequisites: [], order: 6 },
  'demographic-dependency-ratio': { name: '人口抚养比', category: 'labor', topics: ['structural-growth', 'labor-market'], prerequisites: ['working-age-population'], order: 7 },
  'potential-output': { name: '潜在产出与潜在增长', category: 'growth', topics: ['structural-growth', 'economic-activity'], prerequisites: ['productivity', 'working-age-population', 'labor-force-participation'], order: 9 },
};

const requiredTerms = {
  productivity: ['劳动生产率', '生产率水平', '生产率增速', '实际产出', '劳动投入', '就业人数', '工时', '名义', '实际', '工资'],
  'total-factor-productivity': ['全要素生产率', '劳动生产率', '生产函数', '资本', '劳动', '残差', '模型', '估计', '修订', '技术'],
  'working-age-population': ['劳动年龄人口', '年龄范围', '劳动力', '就业人口', '失业人口', '劳动参与率', '分母', '年龄边界'],
  'demographic-dependency-ratio': ['人口抚养比', '人口结构', '劳动年龄人口', '儿童', '老年', '比重', '财政', '家庭', '不等于', 'GDP'],
  'potential-output': ['潜在产出', '潜在增长', '实际 GDP 增长', '产出缺口', '无法直接观测', '模型', '估计', '修订', '周期性', '结构性'],
};

const requiredSources = {
  productivity: ['https://www.stats.gov.cn/sj/zxfb/', 'https://www.oecd.org/en/topics/productivity.html'],
  'total-factor-productivity': ['https://www.oecd.org/en/topics/productivity.html', 'https://www.imf.org/external/Pubs/FT/fandd/basics/pdf/jahan_output.pdf'],
  'working-age-population': ['https://www.stats.gov.cn/hd/cjwtjd/202302/t20230207_1902273.html', 'https://rshiny.ilo.org/dataexplorer18/?lang=en&id=EAP_2WAP_SEX_AGE_RT_A'],
  'demographic-dependency-ratio': ['https://www.stats.gov.cn/sj/zxfb/', 'https://data.worldbank.org/indicator/SP.POP.DPND'],
  'potential-output': ['https://www.imf.org/external/Pubs/FT/fandd/basics/pdf/jahan_output.pdf', 'https://www.stats.gov.cn/sj/zxfb/'],
};

function readConcept(id) {
  const path = `${conceptDirectory}${id}.md`;
  assert.equal(existsSync(path), true, `${id} concept page is missing`);
  return readFileSync(path, 'utf8');
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
      return [key, rawValue.slice(1, -1).split(',').map((value) => value.trim()).filter(Boolean)];
    }
    if (rawValue.startsWith('{') && rawValue.endsWith('}')) {
      const entries = rawValue.slice(1, -1).split(',').map((entry) => entry.trim()).filter(Boolean);
      return [key, Object.fromEntries(entries.map((entry) => {
        const entryColon = entry.indexOf(':');
        return [entry.slice(0, entryColon).trim(), entry.slice(entryColon + 1).trim()];
      }))];
    }
    if (/^\d+$/.test(rawValue)) return [key, Number(rawValue)];
    return [key, rawValue];
  }));
}

for (const [id, expected] of Object.entries(expectedMetadata)) {
  test(`${id} has stable structural-growth metadata and boundaries`, () => {
    const document = readConcept(id);
    const metadata = parseFrontmatter(document);

    assert.equal(metadata.id, id);
    assert.equal(metadata.name, expected.name);
    assert.equal(metadata.country, 'CN');
    assert.equal(metadata.category, expected.category);
    assert.equal(metadata.graph, 'macro');
    assert.equal(metadata.order, expected.order);
    assert.equal(metadata.level, id === 'productivity' || id === 'working-age-population' ? 'basic' : 'advanced');
    assert.deepEqual(metadata.topics, expected.topics);
    assert.deepEqual(metadata.prerequisites, expected.prerequisites);
    assert.equal(metadata.featured, 'false');
    assert.equal(Object.hasOwn(metadata, 'chart'), false);
    assert.match(metadata.source, /\S/);
    assert.match(metadata.definition.source, /\S/);
    assert.match(metadata.definition.asOf, /^2026-08$/);

    for (const term of requiredTerms[id]) assert.ok(document.includes(term), `${id} must explain ${term}`);
    for (const source of requiredSources[id]) assert.ok(document.includes(source), `${id} must cite ${source}`);
  });
}

test('output-gap follows potential-output in the learning order', () => {
  const metadata = parseFrontmatter(readConcept('output-gap'));
  assert.deepEqual(metadata.prerequisites, ['potential-output']);
});

test('structural-growth related IDs resolve and homepage stays curated', () => {
  const pageIds = new Set(Object.keys(expectedMetadata));
  const approvedAbstractIds = new Set(['economic-activity', 'labor-supply', 'economic-slack']);

  for (const id of Object.keys(expectedMetadata)) {
    const metadata = parseFrontmatter(readConcept(id));
    for (const relatedId of metadata.related) {
      assert.ok(pageIds.has(relatedId) || approvedAbstractIds.has(relatedId) || existsSync(`${conceptDirectory}${relatedId}.md`), `${id} related ID ${relatedId} must resolve`);
    }
  }

  const homepage = readFileSync(homepagePath, 'utf8');
  for (const id of Object.keys(expectedMetadata)) assert.equal(homepage.includes(id), false, `homepage must not mention ${id}`);
});
