export const explorations = [
  {
    id: 'why-rate-cuts-dont-boost-loans',
    title: '为什么降息了，大家还是不愿意借钱？',
    summary: '利率变低只是改变了借钱的一个条件。借款人、银行和未来的收入预期，还会一起决定贷款会不会真的增加。',
    minutes: 7,
    published: true,
  },
  {
    id: 'why-orders-dont-immediately-create-jobs',
    title: '为什么订单多了，企业却没有马上招人？',
    summary: '订单是一个信号，但企业还要确认收入什么时候到账、现有员工能不能先完成、招人是否值得，以及这次需求会不会很快消失。',
    minutes: 7,
    published: true,
  },
  {
    id: 'why-slower-inflation-doesnt-lower-prices',
    title: '为什么通胀降了，东西却没有马上变便宜？',
    summary: '价格上涨得慢一点，不等于已经涨过的价格回去了。要把价格现在是多少，和它最近涨得有多快分开看。',
    minutes: 7,
    published: true,
  },
  {
    id: 'why-growth-doesnt-feel-richer',
    title: '为什么经济增长了，普通人却不一定觉得更有钱？',
    summary: '总量增加、平均收入上升和每个家庭的购买力不是同一个问题。行业、地区、工作时间和生活成本的差异，会改变每个人的感受。',
    minutes: 7,
    published: true,
  },
  {
    id: 'why-downturns-make-everyone-more-cautious',
    title: '为什么经济下行时，大家会一起变谨慎？',
    summary: '家庭、企业和银行面对不确定的收入与风险时，可能都先保留现金、推迟决定。它们之间的联系会放大压力，但不会自动走成同一条路。',
    minutes: 7,
    published: true,
  },
  {
    id: 'why-one-policy-feels-different',
    title: '为什么同一个政策，不同人感受不一样？',
    summary: '政策先改变某些合同、收入或条件，再通过借款、储蓄、价格和就业传开。每个人所在的位置不同，感受到的方向和时间也会不同。',
    minutes: 7,
    published: true,
  },
] as const;

export const explorationHref = (id: string) => `/learn/explore/${id}/`;
export const publishedExplorationIds = explorations.filter(item => item.published).map(item => item.id as string);
