import type { ConceptEntry } from './conceptCatalog';
import { topicIds } from './topics';

export type ReviewQuestion = {
  stage?: string;
  question: string;
  explanation: string;
  observation?: string;
  conceptIds: string[];
};
export type LearningStep = {
  id: string;
  kind: 'concept' | 'recap';
  title: string;
  conceptId?: string;
  focus?: string;
  nextReason?: string;
  recapHeading?: string;
  recapIntro?: string;
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
const recap = (questions: ReviewQuestion[], options: Pick<LearningStep, 'recapHeading' | 'recapIntro'> = {}): LearningStep => ({
  id: 'recap', kind: 'recap', title: '路线回顾', questions, ...options,
});

export const learningPaths: LearningPath[] = [
  {
    id: 'macro-foundations', title: '从零开始的宏观经济旅程', status: 'published', revision: 4,
    description: '沿着八个问题，从经济活动、钱与信用走到利率、价格、就业收入与周期，先建立宏观经济的整体框架。',
    topicIds: ['economic-activity', 'prices-inflation', 'household-sector', 'money-supply', 'monetary-transmission'],
    outcomes: ['用产出、货币、信用、利率、价格、收入和周期建立一张宏观经济地图。', '理解政策信号传到融资、需求和生活时需要哪些条件，避免把相关描述当成必然因果。', '阅读宏观新闻时，先找到它在这条旅程中的位置，再核对统计口径、单位和时间范围。'],
    assumedConceptIds: [], extensionConceptIds: ['fiscal-policy', 'fiscal-expenditure', 'government-debt', 'fiscal-revenue', 'fiscal-deficit', 'household-consumption'],
    chapters: [
      { title: '经济是什么', stepIds: ['gdp', 'retail-sales'] },
      { title: '钱与货币体系', stepIds: ['m0', 'm1', 'm2'] },
      { title: '信用如何创造', stepIds: ['credit'] },
      { title: '利率与货币政策', stepIds: ['monetary-policy', 'policy-rate', 'lpr'] },
      { title: '什么是通胀', stepIds: ['cpi', 'ppi'] },
      { title: '经济如何影响就业与收入', stepIds: ['employment', 'unemployment-rate', 'wages', 'disposable-income'] },
      { title: '经济为什么会有周期', stepIds: ['pmi', 'inventory-cycle'] },
      { title: '把各部分联系起来', stepIds: ['recap'] },
    ],
    steps: [
      read('gdp', 'GDP', '先用总产出建立认识，再区分总量与增速。', '接着从需求的一侧，看社零记录了什么。'),
      read('retail-sales', '社会消费品零售总额', '社零能观察哪些消费活动，又没有覆盖什么？', '有了经济活动的起点，下一步从现金和存款认识钱。'),
      read('m0', 'M0', '从现金开始建立货币层次的认识。', '接着把范围扩展到 M1。'),
      read('m1', 'M1', '了解方便支付的货币范围，并留意统计口径变化。', '再看范围更广的 M2。'),
      read('m2', 'M2', '分清广义货币余额和它的增长速度。', '货币口径之外，还要看银行贷款与存款如何联系。'),
      read('credit', '人民币贷款与信贷', '贷款余额、增速和新增贷款分别意味着什么？', '理解信用后，再看影响融资条件的政策与利率。'),
      read('monetary-policy', '货币政策', '把政策目标、工具操作和实际结果分开。', '从政策框架走到具体的利率信号。'),
      read('policy-rate', '政策利率', '政策利率为什么不是贷款合同上的利率？', '接着认识贷款定价的参考：LPR。'),
      read('lpr', 'LPR', '参考报价如何与实际贷款定价、重定价时间联系？', '理解利率之后，转向居民实际感受到的价格变化。'),
      read('cpi', 'CPI', '先理解居民消费价格的观察范围。', '再看生产端的价格，比较两种观察视角。'),
      read('ppi', 'PPI', '生产端价格与居民消费价格为什么可能不同步？', '价格之外，还要观察政策和经济活动如何进入工作与收入。'),
      read('employment', '就业', '先明确哪些人被统计为就业。', '理解就业后，再看失业率的分母和调查范围。'),
      read('unemployment-rate', '城镇调查失业率', '失业率能回答什么，不能代表哪些人群的全部处境？', '工作之外，还要观察劳动带来的收入。'),
      read('wages', '工资与劳动报酬', '区分工资统计与一个家庭的全部收入。', '再看可支配收入，理解工资之外的收入和扣减。'),
      read('disposable-income', '居民人均可支配收入', '区分收入来源，以及人均值与自己的收入。', '接下来观察经济活动如何出现扩张、放缓和周期变化。'),
      read('pmi', 'PMI', '分清景气方向与实际产出的增长速度；PMI 是调查信号，不是官方综合周期指数。', '再看企业如何根据需求、价格和生产变化调整库存。'),
      read('inventory-cycle', '库存周期', '库存周期是分析框架，不是一条官方综合指数，也不是固定时钟。', '最后回顾这些指标各自回答的问题，并把它们放回同一张宏观地图。'),
      recap([
        {
          stage: '1 · 需求回升',
          question: '假设居民消费和企业投资开始回升，最早可以从哪里看到线索？',
          explanation: '这是一个假设起点。零售数据能观察部分消费活动，PMI 是企业调查信号，GDP 则从国民经济核算角度汇总一个时期的最终产出；三者覆盖范围和发布时间不同，不能互相替代。',
          observation: '先看社会消费品零售总额和 PMI 的变化，再在季度数据发布后核对 GDP。',
          conceptIds: ['retail-sales', 'pmi', 'gdp'],
        },
        {
          stage: '2 · 企业扩张与就业',
          question: '需求如果持续，企业为什么可能扩大生产并增加就业？',
          explanation: '当企业判断订单和销售能够持续时，可能增加生产、补充库存或招聘；但产出和就业的反应会受到行业结构、生产率、库存位置和用工安排影响，未必同时、同幅发生。',
          observation: '把 GDP、PMI 和就业放在一起看，留意调查信号、实际产出和劳动力市场数据的时点差异。',
          conceptIds: ['gdp', 'pmi', 'employment', 'inventory-cycle'],
        },
        {
          stage: '3 · 信贷进入扩张',
          question: '企业和居民活动变活跃后，信贷为什么可能跟着变化？',
          explanation: '更强的融资需求和银行愿意放贷，可能共同推高新增信贷；政策利率和 LPR 变化可能影响融资成本，但银行资本与风险约束、借款人的还款能力和实际需求仍决定信用是否扩张。',
          observation: '沿着货币政策、政策利率、LPR 到人民币贷款的顺序观察，并为传导预留数周到数月的时间。',
          conceptIds: ['monetary-policy', 'policy-rate', 'lpr', 'credit'],
        },
        {
          stage: '4 · 价格压力',
          question: '扩张阶段为什么可能出现 CPI 或 PPI 的价格压力？',
          explanation: '需求增加、原材料成本变化和供给能力约束都可能推高部分价格。PPI 观察生产者环节，CPI 观察居民消费篮子，生产端变化传到消费端还要经过成本占比、竞争、需求和合约等条件。',
          observation: '同时看 PPI 和 CPI 的范围、同比或环比口径，以及它们之间可能存在的时滞。',
          conceptIds: ['ppi', 'cpi'],
        },
        {
          stage: '5 · 货币政策收紧',
          question: '价格压力上升时，货币政策会怎样评估是否调整利率？',
          explanation: '价格压力是政策评估的输入之一，决策还要结合经济活动、通胀预期、就业和金融条件。政策利率调整可能是收紧融资条件的一个信号，但不代表所有贷款合同会立即等幅变化。',
          observation: '区分货币政策目标、政策利率动作和实际贷款利率，检查 LPR 报价与重定价时间。',
          conceptIds: ['monetary-policy', 'policy-rate', 'lpr'],
        },
        {
          stage: '6 · 活动与就业放缓',
          question: '融资条件收紧后，经济活动如何可能传回产出和就业？',
          explanation: '融资成本上升或信用供给收紧，可能让部分居民和企业推迟支出与投资，随后生产、库存和招聘计划出现变化；影响通常有时滞，也会因行业、借款人和政策配套不同而不同。',
          observation: '比较 PMI 的较早信号、GDP 的季度产出和就业数据，避免用单一指标判断整个经济阶段。',
          conceptIds: ['policy-rate', 'credit', 'pmi', 'gdp', 'employment'],
        },
        {
          stage: '7 · 条件变化与可能宽松',
          question: '经济放缓后，为什么政策方向可能重新转向宽松？',
          explanation: '如果价格压力减弱，而产出、信用或就业走弱，政策制定者可能重新评估融资条件；宽松信号能改变部分资金价格和预期，但经济恢复仍取决于需求、银行供给、借款人信心和其他约束。',
          observation: '把政策动作与后续的资金价格、信用、产出和就业变化分开记录，并标注政策到结果的时滞。',
          conceptIds: ['monetary-policy', 'policy-rate', 'credit', 'gdp', 'employment'],
        },
      ], {
        recapHeading: '经济周期：把各部分串起来',
        recapIntro: '下面用一个假设场景，把需求、产出、就业、信贷、价格、利率和货币政策放进同一条观察线索。现实中的顺序、力度和时滞会因供给冲击、外部需求、财政安排与预期变化而不同，这里用来练习如何连接指标，不代表每次都会完整走完一轮。',
      }),
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
  {
    id: 'open-economy', title: '开放经济入门', status: 'published', revision: 1,
    description: '从汇率和进出口开始，理解一个经济体如何与外部发生交易，以及不同统计口径怎样连接。',
    topicIds: ['exchange-rates', 'balance-of-payments'],
    outcomes: ['理解汇率是货币之间的相对价格，并先确认报价方向。', '区分出口、进口的金额变化与数量、价格变化。', '知道海关贸易统计和国际收支统计回答的问题不同。'],
    assumedConceptIds: [], extensionConceptIds: ['balance-of-payments', 'effective-exchange-rate', 'trade-balance'],
    chapters: [{ title: '汇率与跨境交易', stepIds: ['exchange-rate', 'exports', 'imports'] }, { title: '路线回顾', stepIds: ['recap'] }],
    steps: [
      read('exchange-rate', '汇率', '先判断报价方向，再理解升值和贬值。', '接着看出口，注意币种和贸易统计口径。'),
      read('exports', '出口', '出口金额变化不等于出口数量同幅变化。', '再看进口，形成对双向贸易的认识。'),
      read('imports', '进口', '分别观察进口与出口，避免只看一个方向。', '最后回顾汇率、出口和进口各自回答的问题。'),
      recap([
        { question: '本币升值，出口一定下降吗？', explanation: '汇率变化可能影响价格和竞争力，但出口还取决于外部需求、产品结构、合同和传导时滞。不能只凭汇率方向推出出口结果。', conceptIds: ['exchange-rate', 'exports'] },
        { question: '出口金额上升，说明出口数量也同比例增加吗？', explanation: '出口金额同时受数量和价格影响，还要核对币种、统计范围和比较期间。', conceptIds: ['exports', 'imports'] },
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
