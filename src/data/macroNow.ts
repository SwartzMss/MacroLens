export const macroNowQuestions = [
  { id: 'growth', label: '经济活动', href: '/now/growth/', question: '在变快还是变慢？' },
  { id: 'prices', label: '价格变化', href: '/now/prices/', question: '上升、放缓，还是分化？' },
  { id: 'credit', label: '钱与融资', href: '/now/credit/', question: '钱变多就更容易融资吗？' },
  { id: 'policy', label: '政策与利率', href: '/now/policy/', question: '放松后融资更容易了吗？' },
  { id: 'labor', label: '就业情况', href: '/now/labor/', question: '失业率下降就变好了吗？' },
  { id: 'external', label: '外贸变化', href: '/now/external/', question: '出口增长就更强了吗？' },
] as const;

export type MacroNowQuestionId = typeof macroNowQuestions[number]['id'];
export type MacroNowQuestion = typeof macroNowQuestions[number];

const macroNowConceptQuestionIds: Record<string, MacroNowQuestionId> = {
  gdp: 'growth',
  'industrial-production': 'growth',
  'retail-sales': 'growth',
  'fixed-asset-investment': 'growth',
  pmi: 'growth',
  cpi: 'prices',
  'core-cpi': 'prices',
  ppi: 'prices',
  m0: 'credit',
  m1: 'credit',
  m2: 'credit',
  credit: 'credit',
  'social-financing': 'credit',
  'policy-rate': 'policy',
  lpr: 'policy',
  'unemployment-rate': 'labor',
  exports: 'external',
  imports: 'external',
};

const macroNowQuestionsById = new Map(macroNowQuestions.map(question => [question.id, question]));

export function getMacroNowQuestion(id: MacroNowQuestionId): MacroNowQuestion {
  return macroNowQuestionsById.get(id)!;
}

export function getMacroNowQuestionForConcept(conceptId: string): MacroNowQuestion | null {
  const questionId = macroNowConceptQuestionIds[conceptId];
  return questionId ? getMacroNowQuestion(questionId) : null;
}
