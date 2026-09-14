import type { ConceptEntry } from './conceptCatalog';
import { topicIds } from './topics';

export type ReviewQuestion = { question: string; explanation: string; conceptIds: string[] };
export type LearningStep = {
  id: string;
  kind: 'concept' | 'recap';
  title: string;
  conceptId?: string;
  focus?: string;
  nextReason?: string;
  questions?: ReviewQuestion[];
};
export type LearningPath = {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'published';
  revision: number;
  topicIds: string[];
  outcomes: string[];
  assumedConceptIds: string[];
  extensionConceptIds: string[];
  chapters: { title: string; stepIds: string[] }[];
  steps: LearningStep[];
};
const read = (id: string, title: string, focus: string, nextReason: string): LearningStep =>
  ({ id, kind: 'concept', conceptId: id, title, focus, nextReason });
const recap = (questions: ReviewQuestion[]): LearningStep => ({ id: 'recap', kind: 'recap', title: '路线回顾', questions });

export const learningPaths: LearningPath[] = [
  {
    id: 'macro-foundations', title: '从零建立宏观认识', status: 'published', revision: 1,
    description: '从经济活动走到价格、收入、货币、政策与对外联系。分七章阅读，先建立整体认识。',
    topicIds: ['economic-activity', 'prices-inflation', 'household-sector', 'money-supply', 'monetary-transmission', 'fiscal-policy', 'balance-of-payments'],
    outcomes: ['分清经济活动、价格和收入指标各自回答的问题。', '理解钱、信用与政策之间的基本联系和传导条件。', '阅读宏观新闻时，先核对口径，再观察变化。'],
    assumedConceptIds: [], extensionConceptIds: ['fiscal-revenue', 'fiscal-deficit', 'household-consumption', 'balance-of-payments'],
    chapters: [
      { title: '经济活动', stepIds: ['gdp', 'retail-sales', 'pmi'] },
      { title: '价格', stepIds: ['cpi', 'ppi'] },
      { title: '就业与收入', stepIds: ['employment', 'unemployment-rate', 'wages', 'disposable-income'] },
      { title: '钱与信用', stepIds: ['m0', 'm1', 'm2', 'credit'] },
      { title: '货币政策', stepIds: ['monetary-policy', 'policy-rate', 'lpr'] },
      { title: '财政', stepIds: ['fiscal-policy', 'fiscal-expenditure', 'government-debt'] },
      { title: '对外联系', stepIds: ['exchange-rate', 'exports', 'imports'] },
      { title: '把各部分联系起来', stepIds: ['recap'] },
    ],
    steps: [
      read('gdp', 'GDP', '先用总产出建立认识，再区分总量与增速。', '接着从需求的一侧，看社零记录了什么。'),
      read('retail-sales', '社会消费品零售总额', '社零能观察哪些消费活动，又没有覆盖什么？', '已经看过活动规模，再看 PMI 如何描述景气变化。'),
      read('pmi', 'PMI', '分清景气方向与实际产出的增长速度。', '下一章转向价格，区分量的变化和价格的变化。'),
      read('cpi', 'CPI', '先理解居民消费价格的观察范围。', '再看生产端的价格，比较两种观察视角。'),
      read('ppi', 'PPI', '生产端价格与居民消费价格为什么可能不同步？', '接着观察经济活动与个人工作、收入的联系。'),
      read('employment', '就业', '先明确哪些人被统计为就业。', '理解就业后，再看失业率的分母和调查范围。'),
      read('unemployment-rate', '城镇调查失业率', '失业率能回答什么，不能代表哪些人群的全部处境？', '工作之外，还要观察劳动带来的收入。'),
      read('wages', '工资与劳动报酬', '区分工资统计与一个家庭的全部收入。', '再看可支配收入，理解工资之外的收入和扣减。'),
      read('disposable-income', '居民人均可支配收入', '区分收入来源，以及人均值与自己的收入。', '下一章从用于支付的钱开始，理解货币口径。'),
      read('m0', 'M0', '从现金开始建立货币层次的认识。', '接着把范围扩展到 M1。'),
      read('m1', 'M1', '了解方便支付的货币范围，并留意统计口径变化。', '再看范围更广的 M2。'),
      read('m2', 'M2', '分清广义货币余额和它的增长速度。', '接着看银行贷款与存款如何联系。'),
      read('credit', '人民币贷款与信贷', '贷款余额、增速和新增贷款分别意味着什么？', '理解信用后，再看央行如何影响融资条件。'),
      read('monetary-policy', '货币政策', '把政策目标、工具操作和实际结果分开。', '从政策框架走到具体的利率信号。'),
      read('policy-rate', '政策利率', '政策利率为什么不是贷款合同上的利率？', '接着认识贷款定价的参考：LPR。'),
      read('lpr', 'LPR', '参考报价如何与实际贷款定价、重定价时间联系？', '下一章转向政府收支，认识财政政策。'),
      read('fiscal-policy', '财政政策', '政府收支与货币政策是不同的调节方式。', '接着看政府支出记录的范围。'),
      read('fiscal-expenditure', '财政支出', '看支出时先区分预算口径和统计期间。', '再看债务存量，避免把支出与债务直接混为一谈。'),
      read('government-debt', '政府债务', '区分债务余额与一段时期的新增融资。', '下一章把视野扩展到汇率与跨境贸易。'),
      read('exchange-rate', '汇率', '先判断报价方向，再理解升值和贬值。', '接着看出口，注意币种和贸易统计口径。'),
      read('exports', '出口', '出口金额变化不等于出口数量同幅变化。', '再看进口，形成对双向贸易的认识。'),
      read('imports', '进口', '分别观察进口与出口，避免只看一个方向。', '最后回顾这些指标各自回答的问题。'),
      recap([
        { question: 'GDP、PMI、CPI 可以互相替代吗？', explanation: 'GDP 观察产出，PMI 描述调查中的景气变化，CPI 观察居民消费价格。先分清指标含义、单位和期间，再比较变化。', conceptIds: ['gdp', 'pmi', 'cpi'] },
        { question: '降息是否意味着贷款一定增加？', explanation: '政策利率、贷款报价和实际信用变化之间需要时间与条件；银行约束、借款需求和还款能力都影响结果。', conceptIds: ['monetary-policy', 'lpr', 'credit'] },
        { question: '读一个宏观数字时，先问什么？', explanation: '先问统计对象、单位、时间范围以及它是余额、增速还是期间增量。不同口径的数字不能直接替换。', conceptIds: ['m2', 'credit', 'government-debt', 'exports'] },
      ]),
    ],
  },
  {
    id: 'money-credit', title: '钱与银行信用', status: 'published', revision: 1,
    description: '从现金和存款开始，理解银行贷款、货币总量与社会融资的边界。',
    topicIds: ['money-supply', 'credit-financing'], assumedConceptIds: [], extensionConceptIds: ['mortgage', 'credit-spread'],
    outcomes: ['分清 M0、M1、M2 的范围。', '解释银行贷款与存款的联系。', '区分货币总量、贷款和社会融资。'],
    chapters: [{ title: '货币层次', stepIds: ['m0', 'm1', 'm2'] }, { title: '信用与融资', stepIds: ['credit', 'social-financing', 'recap'] }],
    steps: [
      read('m0', 'M0', '以流通现金作为货币口径的起点。', '从现金扩展到 M1 的统计范围。'),
      read('m1', 'M1', '不同货币层次的区别在于统计范围。', '接着看更广义的 M2。'),
      read('m2', 'M2', '区分存款和其他资产，以及余额与增速。', '再看银行贷款为什么常与存款创造相伴。'),
      read('credit', '人民币贷款与信贷', '分清贷款供给、借款需求和人民币贷款统计范围。', '贷款之外还有其他融资方式，接着看社融。'),
      read('social-financing', '社会融资规模', '社融观察实体经济获得融资，不能等同于货币总量。', '回顾三种观察口径的区别。'),
      recap([
        { question: '银行放贷就是央行印钞吗？', explanation: '存款类银行发放贷款通常伴随存款创造，但这不等于央行印制纸币；不同贷款主体与统计范围也不能机械地一一对应。', conceptIds: ['credit', 'm2'] },
        { question: 'M2、人民币贷款、社融为何不能当作同一个数字？', explanation: 'M2 看广义货币，人民币贷款看特定贷款范围，社融看实体经济从金融体系获得的融资。比较之前要核对余额、期间增量和统计覆盖。', conceptIds: ['m2', 'credit', 'social-financing'] },
      ]),
    ],
  },
  {
    id: 'monetary-transmission', title: '央行如何影响经济', status: 'published', revision: 1,
    description: '沿着政策信号、资金市场、贷款定价和信贷，理解传导为什么需要条件。',
    topicIds: ['monetary-transmission', 'credit-financing', 'market-rates'], assumedConceptIds: ['m2'], extensionConceptIds: ['omo', 'rrr', 'real-interest-rate'],
    outcomes: ['分清政策利率、市场资金利率和 LPR。', '知道贷款报价变化为什么不等于所有合同立刻变化。', '解释流动性充裕与信贷需求偏弱为何可能并存。'],
    chapters: [{ title: '从政策到资金市场', stepIds: ['monetary-policy', 'policy-rate', 'interbank-rate'] }, { title: '从定价到信用', stepIds: ['lpr', 'credit', 'recap'] }],
    steps: [
      read('monetary-policy', '货币政策', '先区分政策目标、操作行动与实际传导结果。', '从整体框架进入一个具体工具：政策利率。'),
      read('policy-rate', '政策利率', '注意政策利率与市场交易利率的区别。', '接着看资金市场实际形成的 DR007 / R007。'),
      read('interbank-rate', '银行间资金利率', '市场资金价格如何围绕政策信号变化？留意参与者与期限口径。', '资金成本是贷款定价的因素之一，再看 LPR。'),
      read('lpr', 'LPR', '区分参考报价、实际贷款利率和重定价时间。', '报价变化后是否形成贷款，还要看信贷。'),
      read('credit', '人民币贷款与信贷', '从银行愿不愿贷、借款人愿不愿借来理解传导条件。', '回顾各环节，检查哪些结论不能直接推出。'),
      recap([
        { question: '政策利率下调，所有存量贷款会当天等幅下调吗？', explanation: '不能这样推断。还要看 LPR 报价、实际合同的加减点、固定或浮动利率安排以及重定价时间。', conceptIds: ['policy-rate', 'lpr'] },
        { question: '资金市场宽松，新增贷款就一定增加吗？', explanation: '信用扩张还取决于银行的资本和风险约束、借款人的需求与还款能力。流动性条件不能替代对这些环节的观察。', conceptIds: ['monetary-policy', 'interbank-rate', 'credit'] },
        { question: '继续观察政策传导时，可以分别看什么？', explanation: '分别看政策信号、资金市场价格、贷款报价与实际信用变化。各环节的频率、范围和时滞不同，这是一条观察线索，不是必然因果链。', conceptIds: ['monetary-policy', 'policy-rate', 'interbank-rate', 'lpr', 'credit'] },
      ]),
    ],
  },
  {
    id: 'prices-inflation', title: '如何读懂价格变化', status: 'published', revision: 1,
    description: '从居民端、生产端与核心价格入手，理解价格传导为什么可能不同步。',
    topicIds: ['prices-inflation'], assumedConceptIds: [], extensionConceptIds: ['inflation-expectations', 'gdp-deflator', 'real-interest-rate'],
    outcomes: ['区分 CPI、PPI 和核心 CPI 的观察范围。', '不把同比、环比和价格水平混为一谈。', '理解生产端价格传向消费端需要哪些条件。'],
    chapters: [{ title: '三种观察视角', stepIds: ['cpi', 'ppi', 'core-cpi'] }, { title: '把价格联系起来', stepIds: ['price-transmission', 'recap'] }],
    steps: [
      read('cpi', 'CPI', '先明确居民消费价格的范围和涨跌幅含义。', '换到生产端，认识 PPI。'),
      read('ppi', 'PPI', '比较生产端价格与居民消费价格的统计范围。', '再回到居民端，看排除食品和能源后的价格。'),
      read('core-cpi', '核心 CPI', '理解排除部分波动较大项目后的观察视角。', '有了这些口径，再看价格变化如何传导。'),
      read('price-transmission', '价格传导', '关注需求、成本占比、竞争和时滞等条件。', '回顾不同价格指标之间能比较什么、不能推断什么。'),
      recap([
        { question: 'PPI 上涨，CPI 就一定同比例上涨吗？', explanation: '两者覆盖范围不同，成本传导还取决于需求、竞争、成本占比和企业利润吸收等条件，可能有时滞与损耗。', conceptIds: ['ppi', 'cpi', 'price-transmission'] },
        { question: '核心 CPI 比 CPI 更接近每个人的生活成本吗？', explanation: '核心 CPI 排除食品和能源，提供另一个价格观察角度；它并不代表每个家庭的实际消费组合，也不取代总体 CPI。', conceptIds: ['cpi', 'core-cpi'] },
      ]),
    ],
  },
];

export const publishedLearningPaths = learningPaths.filter(path => path.status === 'published');
export const learningPathHref = (pathId: string) => `/learn/${pathId}/`;
export const learningStepHref = (pathId: string, stepId: string) => `/learn/${pathId}/${stepId}/`;
export function getLearningContext(pathId: string | null, stepId: string | null) {
  const path = publishedLearningPaths.find(path => path.id === pathId);
  const step = path?.steps.find(step => step.id === stepId);
  return path && step ? { path, step } : null;
}

export function validateLearningPaths(paths: readonly LearningPath[], concepts: readonly ConceptEntry[]) {
  const byId = new Map(concepts.map(concept => [concept.data.id, concept]));
  const pathIds = new Set<string>();
  const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  for (const path of paths) {
    if (!slug.test(path.id) || pathIds.has(path.id)) throw new Error(`Duplicate or invalid learning path: ${path.id}`);
    pathIds.add(path.id);
    if (!path.steps.length || !path.outcomes.length || !Number.isInteger(path.revision) || path.revision < 1) throw new Error(`Incomplete learning path: ${path.id}`);
    for (const topic of path.topicIds) if (!(topicIds as readonly string[]).includes(topic)) throw new Error(`Unknown topic: ${topic}`);
    const known = new Set<string>();
    const requireConcept = (id: string) => {
      const concept = byId.get(id);
      if (!concept) throw new Error(`Missing learning concept: ${id}`);
      return concept;
    };
    const assume = (id: string) => {
      if (known.has(id)) return;
      known.add(id);
      for (const pre of requireConcept(id).data.prerequisites) assume(pre);
    };
    path.assumedConceptIds.forEach(assume);
    path.extensionConceptIds.forEach(requireConcept);
    const ids = new Set<string>();
    const usedConcepts = new Set<string>();
    for (const step of path.steps) {
      if (!slug.test(step.id) || ids.has(step.id)) throw new Error(`Duplicate or invalid learning step: ${step.id}`);
      ids.add(step.id);
      if (step.kind === 'concept') {
        const concept = requireConcept(step.conceptId ?? '');
        if (usedConcepts.has(concept.data.id)) throw new Error(`Duplicate learning concept: ${concept.data.id}`);
        const visit = (id: string, visiting = new Set<string>()) => {
          if (visiting.has(id)) throw new Error(`Learning prerequisite cycle: ${id}`);
          visiting.add(id);
          for (const pre of requireConcept(id).data.prerequisites) {
            if (!known.has(pre)) throw new Error(`${path.id}/${step.id} needs prerequisite: ${pre}`);
            visit(pre, new Set(visiting));
          }
        };
        visit(concept.data.id);
        known.add(concept.data.id);
        usedConcepts.add(concept.data.id);
      } else {
        if (!step.questions?.length) throw new Error(`Missing recap: ${path.id}`);
        for (const question of step.questions) {
          if (!question.explanation || !question.conceptIds.length) throw new Error(`Unsourced recap: ${path.id}`);
          question.conceptIds.forEach(requireConcept);
        }
      }
    }
    const chapterIds = path.chapters.flatMap(chapter => chapter.stepIds);
    if (chapterIds.length !== path.steps.length || chapterIds.some((id, i) => id !== path.steps[i].id)) throw new Error(`Chapter order mismatch: ${path.id}`);
  }
}
