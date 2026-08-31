import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

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
        return [entry.slice(0, entryColon).trim(), parseScalar(entry.slice(entryColon + 1))];
      }) : [])];
    }
    return [key, parseScalar(rawValue)];
  }));
}

const approvedMetadata = {
  'output-gap': { id: 'output-gap', name: '产出缺口', subtitle: '实际产出相对潜在产出的估计偏离，不是直接观测的官方 GDP 指标', country: 'CN', category: 'growth', source: '国际货币基金组织与国家统计局', definition: { source: 'IMF output-gap methodology and NBS GDP', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['gdp', 'capacity-utilization', 'unemployment-rate', 'cpi'], graph: 'macro', order: 6 },
  'inventory-cycle': { id: 'inventory-cycle', name: '库存周期', subtitle: '企业库存存量、变化与需求生产调整形成的条件性周期叙事', country: 'CN', category: 'growth', source: '国家统计局', definition: { source: '国家统计局工业企业财务与国民经济核算口径', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['industrial-production', 'industrial-profits', 'pmi', 'gdp'], graph: 'macro', order: 7 },
  'capacity-utilization': { id: 'capacity-utilization', name: '工业产能利用率', subtitle: '规模以上工业实际产出相对可持续生产能力的季度调查指标', country: 'CN', category: 'growth', source: '国家统计局', definition: { source: '国家统计局工业产能利用率调查', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['industrial-production', 'output-gap', 'industrial-profits', 'ppi'], graph: 'macro', order: 8 },
  'industrial-profits': { id: 'industrial-profits', name: '规模以上工业企业利润', subtitle: '观察规上工业企业累计利润、收入与利润率，必须保持可比口径', country: 'CN', category: 'growth', source: '国家统计局', definition: { source: '国家统计局工业企业财务状况统计', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['industrial-production', 'inventory-cycle', 'capacity-utilization', 'ppi'], graph: 'macro', order: 9 },
  'leading-indicators': { id: 'leading-indicators', name: '领先指标', subtitle: '相对特定经济活动和预测期具有经验领先性的信号角色，不是一条通用序列', country: 'CN', category: 'growth', source: '国家统计局与中国人民银行', definition: { source: '官方指标方法与条件性领先关系', asOf: '2026-08' }, updatedAt: '2026-08-31', related: ['pmi', 'credit', 'social-financing', 'yield-curve', 'industrial-production'], graph: 'macro', order: 10 },
};

function assertConcept(id, terms, urls) {
  const document = readConcept(id);
  assert.deepEqual(parseFrontmatter(document), approvedMetadata[id]);
  assert.doesNotMatch(document, /^chart:/m);
  for (const term of terms) assert.ok(document.includes(term), `${id} must explain ${term}`);
  for (const url of urls) assert.ok(document.includes(url), `${id} must cite ${url}`);
}

test('output gap remains estimated and revisable', () => assertConcept('output-gap', ['实际产出', '潜在产出', '无法直接观测', '估计', '占潜在产出的比重', '统计滤波', '生产函数', '多变量模型', '实时估计', '修订', '官方GDP', '不能据此创建一条中国官方产出缺口序列'], ['https://www.imf.org/external/Pubs/FT/fandd/basics/pdf/jahan_output.pdf', 'https://www.stats.gov.cn/sj/zxfb/']));

test('inventory cycle separates stocks, growth, accumulation, and GDP contribution', () => assertConcept('inventory-cycle', ['存货存量', '产成品存货', '同比增速', '补库存', '去库存', '存货变动', 'GDP增长贡献', '并不等价', '主动补库存', '被动补库存', '主动去库存', '被动去库存', '不是固定时钟', '价格变化'], ['https://www.stats.gov.cn/sj/pcsj/jjpc/1jp/html/indicator2.htm', 'https://www.stats.gov.cn/sj/zxfb/202601/t20260127_1962382.html']));

test('capacity utilization preserves official scope', () => assertConcept('capacity-utilization', ['实际产出', '生产能力', '价值量', '规模以上工业企业', '大中型企业全面调查', '小微企业抽样调查', '按季', '未经季节调整', '行业', '季节性', '不自动等于经济过热'], ['https://www.stats.gov.cn/zs/tjws/tjzb/202301/t20230101_1903791.html', 'https://www.stats.gov.cn/sj/zxfb/202501/t20250117_1958324.html']));

test('industrial profits explains cumulative and comparable semantics', () => assertConcept('industrial-profits', ['2000万元及以上', '工业法人单位', '利润总额', '营业收入', '营业收入利润率', '累计值', '1月份数据免报', '可比口径', '不能直接相比计算增速', '相邻累计值相减', '推算值', '上年同期累计差额', '基数效应', '由亏转盈'], ['https://www.stats.gov.cn/sj/zxfb/202501/t20250127_1958485.html', 'https://www.stats.gov.cn/sj/zxfb/202601/t20260127_1962382.html']));

test('leading indicators are scoped rather than guaranteed', () => assertConcept('leading-indicators', ['经验角色', '预测目标', '领先期', '历史样本', 'PMI新订单', '扩散指数', '信用脉冲', '推导指标', '市场变量', '不保证', '样本外失效', '不创建自制综合领先指标'], ['https://www.stats.gov.cn/zs/tjws/zytjzbqs/cgzlzs/202501/t20250121_1958396.html', 'https://www.pbc.gov.cn/diaochatongjisi/116219/index.html']));

test('all business-cycle related IDs resolve', () => {
  const ids = new Set(readdirSync(conceptDirectory).filter((name) => name.endsWith('.md')).map((name) => parseFrontmatter(readFileSync(`${conceptDirectory}/${name}`, 'utf8')).id));
  for (const metadata of Object.values(approvedMetadata)) for (const related of metadata.related) assert.ok(ids.has(related), `${metadata.id} related ID ${related} must resolve`);
});
