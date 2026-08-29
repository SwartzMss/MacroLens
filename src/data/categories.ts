export const categories = {
  money: { label: '货币', description: '从流通中货币到广义货币，理解不同层次的“钱”。', order: 10 },
  credit: { label: '信用与融资', description: '理解贷款、社会融资与利率如何连接金融体系和实体经济。', order: 20 },
  inflation: { label: '通胀', description: '观察价格水平、成本与购买力的变化。', order: 30 },
  growth: { label: '经济增长', description: '理解产出、需求与经济周期。', order: 40 },
  fiscal: { label: '财政', description: '理解政府收支、债务与宏观调节。', order: 50 },
  exchange: { label: '汇率', description: '理解货币之间的相对价格与跨境传导。', order: 60 },
} as const;

export type CategoryId = keyof typeof categories;

export function getCategory(id: string) {
  return categories[id as CategoryId] ?? { label: id, description: '宏观经济概念。', order: 999 };
}
