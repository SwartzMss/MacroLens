import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const conceptDirectory = `${root}src/content/concepts/`;
const homepagePath = `${root}src/pages/index.astro`;

const expectedMetadata = {
  'disposable-income': { name: '居民人均可支配收入', category: 'growth', topics: ['household-sector', 'labor-market', 'economic-activity'], prerequisites: ['wages'], order: 11 },
  'income-expectations': { name: '收入预期', category: 'growth', topics: ['household-sector', 'labor-market', 'economic-activity'], prerequisites: ['wages'], order: 12 },
  'household-consumption': { name: '居民消费支出', category: 'growth', topics: ['household-sector', 'economic-activity'], prerequisites: ['disposable-income', 'income-expectations'], order: 13 },
  'household-saving-rate': { name: '居民储蓄率', category: 'growth', topics: ['household-sector', 'economic-activity', 'market-rates'], prerequisites: ['disposable-income', 'household-consumption'], order: 14 },
  'propensity-to-consume': { name: '消费倾向', category: 'growth', topics: ['household-sector', 'economic-activity'], prerequisites: ['household-consumption'], order: 15 },
};

const requiredTerms = {
  'disposable-income': ['工资性收入', '经营净收入', '财产净收入', '转移净收入', '工资与劳动报酬', '国民经济核算', '名义', '实际', '人均', '总量'],
  'income-expectations': ['收入预期', '调查', '期限', '分布', '实现收入', '消费', '不等于', '不保证'],
  'household-consumption': ['居民人均消费支出', '居民消费支出', '社会消费品零售总额', '不等于', '服务', '名义', '实际', '人均', '总量'],
  'household-saving-rate': ['住户部门总储蓄', '可支配收入', '居民消费支出', '居民储蓄', '居民存款余额', '流量', '金融资产', '财富'],
  'propensity-to-consume': ['平均消费倾向', '边际消费倾向', '消费水平', '可支配收入', '名义', '实际', '人均', '总量'],
};

const requiredSources = {
  'disposable-income': [
    'https://www.stats.gov.cn/zs/tjws/tjzb/202301/t20230101_1903384.html',
    'https://www.stats.gov.cn/zs/tjws/zytjzbqs/jmrj/202501/t20250121_1958392.html',
  ],
  'income-expectations': [
    'https://www.pbc.gov.cn/diaochatongjisi/fileDir/resource/cms/2025/03/2025032117142239782.pdf',
  ],
  'household-consumption': [
    'https://www.stats.gov.cn/hd/cjwtjd/202302/t20230207_1902278.html',
    'https://www.stats.gov.cn/sj/zxfb/202601/t20260119_1962321.html',
  ],
  'household-saving-rate': [
    'https://www.stats.gov.cn/hd/cjwtjd/202302/t20230207_1902278.html',
    'https://www.oecd.org/en/data/indicators/household-savings-forecast.html',
  ],
  'propensity-to-consume': [
    'https://www.stats.gov.cn/hd/cjwtjd/202302/t20230207_1902278.html',
  ],
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
  test(`${id} has stable household metadata and statistical boundaries`, () => {
    const document = readConcept(id);
    const metadata = parseFrontmatter(document);

    assert.equal(metadata.id, id);
    assert.equal(metadata.name, expected.name);
    assert.equal(metadata.country, 'CN');
    assert.equal(metadata.category, expected.category);
    assert.equal(metadata.graph, 'macro');
    assert.equal(metadata.order, expected.order);
    assert.equal(metadata.level, id === 'income-expectations' || id === 'household-saving-rate' || id === 'propensity-to-consume' ? 'advanced' : 'basic');
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

test('household concept related IDs resolve and homepage stays curated', () => {
  const pageIds = new Set(Object.keys(expectedMetadata));
  const approvedAbstractIds = new Set([
    'economic-activity', 'household-income-conditions', 'household-consumption-behavior',
    'household-saving-behavior', 'saving-consumption-choice',
  ]);

  for (const id of Object.keys(expectedMetadata)) {
    const metadata = parseFrontmatter(readConcept(id));
    for (const relatedId of metadata.related) {
      assert.ok(pageIds.has(relatedId) || approvedAbstractIds.has(relatedId) || existsSync(`${conceptDirectory}${relatedId}.md`), `${id} related ID ${relatedId} must resolve`);
    }
  }

  const homepage = readFileSync(homepagePath, 'utf8');
  for (const id of Object.keys(expectedMetadata)) assert.equal(homepage.includes(id), false, `homepage must not mention ${id}`);
});
