export const courseOutline = [
  { id: 'connected-economy', title: '经济怎样把我们联系起来？', summary: '从一份早餐出发，看见支出、收入、生产和工作之间的联系。', published: true },
  { id: 'money', title: '我们为什么需要钱？', summary: '钱怎样帮助交易，现金和银行里的钱怎样使用。', published: true },
  { id: 'bank-lending', title: '银行借出去的钱从哪里来？', summary: '贷款和存款怎样产生，为什么银行不能无限放贷。', published: true },
  { id: 'borrowing-cost', title: '借钱贵一点，会改变什么？', summary: '家庭和企业怎样作决定，为什么降息后不一定愿意借钱。', published: false },
  { id: 'prices', title: '东西为什么会越来越贵？', summary: '为什么会涨价，个别东西涨价与普遍涨价有什么不同。', published: false },
  { id: 'ups-and-downs', title: '经济为什么时好时坏？', summary: '销售、生产、招工和收入怎样相互影响。', published: false },
  { id: 'policy', title: '经济慢下来，能做些什么？', summary: '政府和央行能做什么，为什么效果需要时间。', published: false },
  { id: 'reading-news', title: '怎样看懂经济新闻里的数字？', summary: '怎样比较变化，为什么不能只看一个数字。', published: false },
] as const;
export const courseLessonHref = (id: string) => `/learn/course/${id}/`;
export const publishedLessonIds = courseOutline.filter(item => item.published).map(item => item.id as string);
