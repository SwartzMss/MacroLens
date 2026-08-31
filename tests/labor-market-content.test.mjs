import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { categories, categoryIds } from '../src/data/categories.ts';

const conceptDirectory = fileURLToPath(new URL('../src/content/concepts/', import.meta.url));

function readConcept(id) {
  const path = `${conceptDirectory}/${id}.md`;
  assert.ok(existsSync(path), `${id} concept page is missing`);
  return readFileSync(path, 'utf8');
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function parseFrontmatter(document) {
  const match = document.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, 'document must have leading YAML frontmatter');
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

const approvedMetadata = {
  employment: { id: 'employment', name: '就业', subtitle: '处于就业状态的人口存量，不等于某一期间新增的就业岗位或人员', country: 'CN', category: 'labor', source: '国家统计局', definition: { source: '国家统计局劳动力调查制度', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['unemployment-rate', 'youth-unemployment', 'labor-force-participation', 'wages', 'gdp'], graph: 'macro', order: 1 },
  'unemployment-rate': { id: 'unemployment-rate', name: '城镇调查失业率', subtitle: '城镇失业人口占城镇劳动力的比重，不是占全部劳动年龄人口的比重', country: 'CN', category: 'labor', source: '国家统计局', definition: { source: '国家统计局劳动力调查制度', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['employment', 'youth-unemployment', 'labor-force-participation', 'wages', 'gdp'], graph: 'macro', order: 2 },
  'youth-unemployment': { id: 'youth-unemployment', name: '青年失业率 / 分年龄组失业率', subtitle: '观察不同年龄劳动力的失业状况，必须先确认年龄分组和在校生口径', country: 'CN', category: 'labor', source: '国家统计局', definition: { source: '国家统计局分年龄组调查失业率说明', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['unemployment-rate', 'employment', 'labor-force-participation', 'wages'], graph: 'macro', order: 3 },
  'labor-force-participation': { id: 'labor-force-participation', name: '劳动参与率', subtitle: '劳动力占劳动年龄人口的比重，连接就业、失业与退出劳动力市场', country: 'CN', category: 'labor', source: '国家统计局与国际劳工组织', definition: { source: '国家统计局劳动力调查制度与 ILOSTAT', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['employment', 'unemployment-rate', 'youth-unemployment', 'wages'], graph: 'macro', order: 4 },
  wages: { id: 'wages', name: '工资与劳动报酬', subtitle: '衡量劳动所得时必须区分平均与中位、名义与实际以及统计覆盖范围', country: 'CN', category: 'labor', source: '国家统计局', definition: { source: '国家统计局单位就业人员工资统计制度', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['employment', 'unemployment-rate', 'labor-force-participation', 'cpi', 'retail-sales'], graph: 'macro', order: 5 },
};

function assertConcept(id, terms, sourceUrls) {
  const document = readConcept(id);
  assert.deepEqual(parseFrontmatter(document), approvedMetadata[id]);
  assert.doesNotMatch(document, /^chart:/m);
  for (const term of terms) assert.ok(document.includes(term), `${id} must explain ${term}`);
  for (const url of sourceUrls) assert.ok(document.includes(url), `${id} must cite ${url}`);
}

test('registers labor after external', () => {
  assert.equal(categoryIds.at(-1), 'labor');
  assert.deepEqual(categories.labor, {
    label: '劳动力市场',
    description: '理解就业、失业、劳动参与和工资如何共同描绘劳动力市场。',
    order: 80,
  });
  assert.equal(categoryIds.indexOf('labor'), categoryIds.indexOf('external') + 1);
});

test('all labor related IDs resolve to stable concept pages', () => {
  const conceptIds = new Set(readdirSync(conceptDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => parseFrontmatter(readFileSync(`${conceptDirectory}/${entry.name}`, 'utf8')).id));
  for (const metadata of Object.values(approvedMetadata)) {
    for (const relatedId of metadata.related) assert.ok(conceptIds.has(relatedId), `${metadata.id} related ID ${relatedId} must resolve`);
  }
});

test('employment is a status stock rather than a new-jobs flow', () => {
  assertConcept('employment', [
    '人口存量', '参考周', '一小时', '新增就业', '单位就业人员', '招聘职位', '就业质量',
  ], ['https://www.stats.gov.cn/sj/sjjd/202302/t20230202_1896011.html']);
});

test('unemployment rate uses the labor force denominator and distinguishes registration', () => {
  assertConcept('unemployment-rate', [
    '调查失业率', '登记失业率', '就业人口 + 失业人口', '劳动力', '常住人口', '户籍',
    '没有工作', '寻找工作', '能够工作', '退出劳动力市场', '就业质量',
  ], [
    'https://www.stats.gov.cn/sj/sjjd/202302/t20230202_1896011.html',
    'https://www.stats.gov.cn/zs/tjws/zytjzbqs/tcsyl/202409/t20240910_1956360.html',
  ]);
});

test('youth unemployment preserves the methodology break and student treatment', () => {
  assertConcept('youth-unemployment', [
    '16—24岁', '25—29岁', '30—59岁', '不含在校生', '2024年1月', '暂停发布',
    '不能直接拼接', '在校学生', '寻找工作', '能够工作',
  ], [
    'https://www.stats.gov.cn/xxgk/sjfb/zxfb2020/202401/t20240117_1946644.html',
    'https://www.stats.gov.cn/hd/lyzx/zxgk/202406/t20240619_1955075.html',
  ]);
});

test('participation explains the identity, denominator, and labor-force exit', () => {
  assertConcept('labor-force-participation', [
    '就业人口 + 失业人口', '劳动年龄人口', '分母', '不在劳动力人口', '退出劳动力市场',
    '失业率下降', '就业增加', '年龄结构',
  ], [
    'https://www.stats.gov.cn/zs/tjws/zytjzbqs/tcsyl/202411/t20241115_1957491.html',
    'https://rshiny.ilo.org/dataexplorer18/?lang=en&id=EAP_2WAP_SEX_AGE_RT_A',
  ]);
});

test('wages separates level, purchasing power, compensation, and coverage concepts', () => {
  assertConcept('wages', [
    '平均工资', '中位数', '名义工资', '实际工资', '居民消费价格指数', '工资总额',
    '劳动报酬', '可支配收入', '单位就业人员', '个体就业人员', '覆盖范围',
  ], [
    'https://www.stats.gov.cn/zs/tjws/zytjzbqs/dwjyry/202411/t20241128_1957598.html',
    'https://www.stats.gov.cn/sj/ndsj/2025/html/zbe04.pdf',
  ]);
});
