import { requireRelation, type Relation, type RelationType } from './graphRegistry';

type RelationSpec = readonly [source: string, target: string, type: RelationType];

export type TransmissionPathDefinition = {
  id: string;
  title: string;
  description: string;
  relations: readonly RelationSpec[];
};

export const transmissionPathDefinitions: readonly TransmissionPathDefinition[] = [
  {
    id: 'policy-to-financing',
    title: '政策怎样走到融资条件？',
    description: '从政策框架出发，沿着政策利率、融资条件和信贷看传导经过哪些环节。',
    relations: [
      ['central-bank', 'monetary-policy', 'IMPLEMENTS'],
      ['monetary-policy', 'policy-rate', 'USES'],
      ['policy-rate', 'financing-conditions', 'AFFECTS'],
      ['financing-conditions', 'credit', 'AFFECTS'],
    ],
  },
  {
    id: 'prices-to-policy',
    title: '价格压力怎样从生产端传到居民端？',
    description: '把生产者价格、下游价格和居民消费价格分开看，再理解政策会观察哪些输入。',
    relations: [
      ['ppi', 'producer-price-pressure', 'REFLECTS'],
      ['producer-price-pressure', 'downstream-price-pressure', 'AFFECTS'],
      ['downstream-price-pressure', 'consumer-price-pressure', 'AFFECTS'],
      ['cpi', 'consumer-price-pressure', 'REFLECTS'],
    ],
  },
  {
    id: 'activity-evidence',
    title: '哪些读数能帮助观察经济活动？',
    description: '调查、生产和消费数据观察的范围不同，放在一起时要先确认各自回答的问题。',
    relations: [
      ['pmi', 'business-activity-conditions', 'REFLECTS'],
      ['business-activity-conditions', 'economic-activity', 'CORRELATES'],
      ['retail-sales', 'consumption-activity', 'REFLECTS'],
      ['consumption-activity', 'economic-activity', 'COMPONENT_OF'],
    ],
  },
  {
    id: 'employment-to-income',
    title: '就业怎样连到收入和消费？',
    description: '就业数据只能先说明劳动力市场的一部分，还要继续看收入、消费和统计范围。',
    relations: [
      ['employment', 'labor-market-conditions', 'REFLECTS'],
      ['labor-market-conditions', 'household-income-conditions', 'AFFECTS'],
      ['household-income-conditions', 'household-consumption', 'AFFECTS'],
      ['household-consumption', 'consumption-activity', 'REFLECTS'],
    ],
  },
  {
    id: 'trade-to-activity',
    title: '外贸读数能回答什么问题？',
    description: '出口和进口先说明跨境交易的不同方向，再分别核对金额、数量、价格和国内活动。',
    relations: [
      ['exports', 'external-trade', 'COMPONENT_OF'],
      ['imports', 'external-trade', 'COMPONENT_OF'],
      ['exports', 'economic-activity', 'AFFECTS'],
    ],
  },
];

export type TransmissionPath = Omit<TransmissionPathDefinition, 'relations'> & { relations: Relation[] };

export function getTransmissionPaths(): TransmissionPath[] {
  return transmissionPathDefinitions.map((path) => ({
    ...path,
    relations: path.relations.map(([source, target, type]) => requireRelation('macro', source, target, type)),
  }));
}
