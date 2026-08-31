export const categoryIds = ['money', 'policy', 'credit', 'inflation', 'growth', 'housing', 'fiscal', 'exchange', 'external', 'labor', 'markets'] as const;
export type CategoryId = typeof categoryIds[number];

export const categories: Record<CategoryId, { label: string; description: string; order: number }> = {
  money: { label: '货币', description: '从流通中货币到广义货币，理解不同层次的“钱”。', order: 10 },
  policy: { label: '货币政策', description: '理解政策目标、工具操作与金融条件之间的传导。', order: 15 },
  credit: { label: '信用与融资', description: '理解贷款、社会融资与利率如何连接金融体系和实体经济。', order: 20 },
  inflation: { label: '通胀', description: '观察价格水平、成本与购买力的变化。', order: 30 },
  growth: { label: '经济增长', description: '理解产出、需求与经济周期。', order: 40 },
  housing: { label: '房地产', description: '理解住房价格、交易、融资、建设与土地财政的不同统计口径。', order: 45 },
  fiscal: { label: '财政', description: '理解政府收支、债务与宏观调节。', order: 50 },
  exchange: { label: '汇率', description: '理解货币之间的相对价格与跨境传导。', order: 60 },
  external: { label: '外部部门', description: '理解国际收支、跨境资金流动与一国对外经济联系。', order: 70 },
  labor: { label: '劳动力市场', description: '理解就业、失业、劳动参与和工资如何共同描绘劳动力市场。', order: 80 },
  markets: { label: '金融市场', description: '理解政策锚如何传导到资金利率、债券收益率、实际利率与信用利差。', order: 90 },
};

export function getCategory(id: CategoryId) {
  return categories[id];
}
