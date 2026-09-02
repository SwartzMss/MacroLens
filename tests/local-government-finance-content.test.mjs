import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { topicRegistry } from '../src/data/topics.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const conceptDirectory = `${root}src/content/concepts/`;
const expectedMetadata = {
  'local-government-finance': { name: '地方财政', order: 6, level: 'basic', prerequisites: ['fiscal-policy'] },
  'local-government-debt': { name: '地方政府债务', order: 7, level: 'basic', prerequisites: ['local-government-finance'] },
  'local-government-special-bonds': { name: '地方政府专项债', order: 8, level: 'advanced', prerequisites: ['local-government-debt'] },
  'land-transfer-revenue': { name: '国有土地使用权出让收入', order: 9, level: 'basic', prerequisites: ['local-government-finance'] },
  lgfv: { name: '地方政府融资平台（LGFV / 城投平台）', order: 10, level: 'advanced', prerequisites: ['local-government-finance'] },
};
const requiredTerms = {
  'local-government-finance': ['一般公共预算', '政府性基金预算', '税收收入', '非税收入', '土地出让收入', '不属于一般公共预算', '存量', '流量'],
  'local-government-debt': ['地方政府债务', '一般债务', '专项债务', '债务限额', '债务余额', '发行额', '还本', 'LGFV', '隐性债务', '企业债务'],
  'local-government-special-bonds': ['一般债券', '专项债券', '一般公共预算', '政府性基金收入', '专项收入', '项目收益', '不等于 GDP'],
  'land-transfer-revenue': ['国有土地使用权出让收入', '政府性基金预算', '土地成交价款', '不是税收收入', '缴款进度', '土地交易额'],
  lgfv: ['独立法人', '企业债券', '地方政府法定债务', '不等于', '谁借谁还', '风险自担', '政府担保', '市场化'],
};
const requiredSources = {
  'local-government-finance': ['https://www.npc.gov.cn/rdxwzx/xwzx2026/xwzx2026019/202601/t20260116_451162.html'],
  'local-government-debt': ['https://yss.mof.gov.cn/2026zyczys/202603/t20260324_3986005.htm', 'https://yss.mof.gov.cn/zhuantilanmu/zfzw/201611/t20161122_2463933.htm'],
  'local-government-special-bonds': ['https://yss.mof.gov.cn/2026zyczys/202603/t20260324_3986005.htm'],
  'land-transfer-revenue': ['https://yss.mof.gov.cn/xiazaizhongxin/202510/P020251022648527813584.pdf'],
  lgfv: ['https://zfxxgk.ndrc.gov.cn/web/iteminfo.jsp?id=1232', 'https://www.gov.cn/zhengce/content/2010-06/13/content_1942.htm'],
};

function parseFrontmatter(document) {
  const match = document.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, 'concept must have leading YAML frontmatter');
  return Object.fromEntries(match[1].split('\n').map((line) => {
    const colon = line.indexOf(':');
    assert.notEqual(colon, -1, `invalid frontmatter line: ${line}`);
    const key = line.slice(0, colon).trim();
    const rawValue = line.slice(colon + 1).trim();
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) return [key, rawValue.slice(1, -1).split(',').map((value) => value.trim()).filter(Boolean)];
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

function readConcept(id) {
  const path = `${conceptDirectory}${id}.md`;
  assert.equal(existsSync(path), true, `${id} concept page is missing`);
  return readFileSync(path, 'utf8');
}

test('registers the local-government-finance topic and preserves the prerequisite DAG', () => {
  const topic = topicRegistry.find((entry) => entry.id === 'local-government-finance');
  assert.deepEqual(topic, {
    id: 'local-government-finance',
    label: '地方财政与地方融资',
    description: '理解地方预算、法定政府债务、土地出让收入与 LGFV 融资的边界和联系。',
    category: 'fiscal',
    order: 62,
  });

  for (const [id, expected] of Object.entries(expectedMetadata)) {
    const metadata = parseFrontmatter(readConcept(id));
    assert.equal(metadata.id, id);
    assert.equal(metadata.name, expected.name);
    assert.equal(metadata.country, 'CN');
    assert.equal(metadata.category, 'fiscal');
    assert.equal(metadata.graph, 'macro');
    assert.equal(metadata.order, expected.order);
    assert.equal(metadata.level, expected.level);
    assert.deepEqual(metadata.topics, ['local-government-finance']);
    assert.deepEqual(metadata.prerequisites, expected.prerequisites);
    assert.equal(metadata.featured, 'false');
    assert.doesNotMatch(metadata.source, /undefined/);
  }
});

for (const [id, terms] of Object.entries(requiredTerms)) test(`${id} preserves its legal and accounting boundaries`, () => {
  const document = readConcept(id);
  for (const term of terms) assert.ok(document.includes(term), `${id} must explain ${term}`);
  for (const source of requiredSources[id]) assert.ok(document.includes(source), `${id} must cite ${source}`);
});

test('local-government-finance related IDs resolve and homepage stays curated', () => {
  const ids = new Set(readdirSync(conceptDirectory).filter((name) => name.endsWith('.md')).map((name) => name.replace(/\.md$/, '')));
  const abstractIds = new Set(['fiscal-conditions', 'local-fiscal-space', 'market-financing', 'local-fiscal-and-investment-conditions']);
  for (const id of Object.keys(expectedMetadata)) {
    const metadata = parseFrontmatter(readConcept(id));
    for (const related of metadata.related) assert.ok(ids.has(related) || abstractIds.has(related), `${id} related ${related} must resolve`);
  }
  const homepage = readFileSync(`${root}src/pages/index.astro`, 'utf8');
  for (const id of Object.keys(expectedMetadata)) assert.equal(homepage.includes(id), false, `homepage must not mention ${id}`);
});

test('does not collapse LGFV liabilities into statutory local-government debt', () => {
  const document = readConcept('lgfv');
  assert.doesNotMatch(document, /LGFV(?:债务|负债)?(?:属于|构成|就是)地方政府(?:法定)?债务/);
});
