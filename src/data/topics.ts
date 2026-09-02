import type { CategoryId } from './categories';

export const topicIds = [
  'money-supply',
  'credit-financing',
  'monetary-transmission',
  'prices-inflation',
  'economic-activity',
  'household-sector',
  'fiscal-policy',
  'labor-market',
  'housing-market',
  'market-rates',
  'exchange-rates',
  'balance-of-payments',
  'external-balance-sheets',
] as const;

export type TopicId = typeof topicIds[number];
export type Topic = {
  id: TopicId;
  label: string;
  description: string;
  category: CategoryId;
  order: number;
};

export const topics: Record<TopicId, Omit<Topic, 'id'>> = {
  'money-supply': { label: '货币供应与流动性', description: '理解 M0、M1、M2 与货币层次。', category: 'money', order: 10 },
  'credit-financing': { label: '信用与融资', description: '理解贷款、社会融资与融资成本。', category: 'credit', order: 20 },
  'monetary-transmission': { label: '货币政策传导', description: '理解政策工具如何影响金融条件和实体经济。', category: 'policy', order: 30 },
  'prices-inflation': { label: '通胀与价格', description: '理解价格水平、成本与购买力。', category: 'inflation', order: 40 },
  'economic-activity': { label: '经济活动与周期', description: '从产出、需求、生产和周期指标观察经济活动。', category: 'growth', order: 50 },
  'household-sector': { label: '居民部门', description: '理解劳动收入、可支配收入、消费、储蓄与预期之间的统计边界和传导关系。', category: 'growth', order: 55 },
  'fiscal-policy': { label: '财政政策', description: '理解政府收支、债务与宏观调节。', category: 'fiscal', order: 60 },
  'labor-market': { label: '劳动力市场', description: '理解就业、失业、参与率和工资。', category: 'labor', order: 70 },
  'housing-market': { label: '房地产与住房', description: '理解住房价格、交易、融资、建设与土地。', category: 'housing', order: 80 },
  'market-rates': { label: '市场利率', description: '理解资金利率、债券收益率、实际利率与信用利差。', category: 'markets', order: 90 },
  'exchange-rates': { label: '汇率与跨货币定价', description: '理解汇率形成、在岸离岸市场和跨货币定价。', category: 'exchange', order: 100 },
  'balance-of-payments': { label: '国际收支与外部流量', description: '理解经常账户、金融账户和跨境资金流动。', category: 'external', order: 110 },
  'external-balance-sheets': { label: '外部资产负债表', description: '理解外债、储备和国际投资头寸。', category: 'external', order: 120 },
};

export function getTopic(id: TopicId): Topic {
  return { id, ...topics[id] };
}

export const topicRegistry = topicIds.map(getTopic);
