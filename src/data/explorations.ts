export const explorations = [
  {
    id: 'why-rate-cuts-dont-boost-loans',
    title: '为什么降息了，大家还是不愿意借钱？',
    summary: '利率变低只是改变了借钱的一个条件。借款人、银行和未来的收入预期，还会一起决定贷款会不会真的增加。',
    minutes: 10,
    published: true,
  },
] as const;

export const explorationHref = (id: string) => `/learn/explore/${id}/`;
export const publishedExplorationIds = explorations.filter(item => item.published).map(item => item.id as string);
