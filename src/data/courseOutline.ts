export const courseOutline = [
  { id: 'connected-economy', title: '经济怎样把我们联系起来？', summary: '从一份早餐出发，看见支出、收入、生产和工作之间的联系。', nextReason: '下一章会把这条联系里的共同工具拆开：大家为什么愿意用钱来交换、比较和安排以后的购买？', published: true },
  { id: 'money', title: '我们为什么需要钱？', summary: '钱怎样帮助交易，现金和银行里的钱怎样使用。', nextReason: '下一章会追问银行账户里的钱从哪里来：银行发放贷款时，为什么会同时留下贷款和存款？', published: true },
  { id: 'bank-lending', title: '银行借出去的钱从哪里来？', summary: '贷款和存款怎样产生，为什么银行不能无限放贷。', nextReason: '下一章会继续看借钱的价格：利率改变时，家庭和企业为什么会重新安排计划？', published: true },
  { id: 'borrowing-cost', title: '借钱贵一点，会改变什么？', summary: '家庭和企业怎样作决定，为什么降息后不一定愿意借钱。', nextReason: '下一章会把镜头转向价格：当借钱、消费和生产都受很多条件影响时，东西为什么还会普遍变贵？', published: true },
  { id: 'prices', title: '东西为什么会越来越贵？', summary: '为什么会涨价，个别东西涨价与普遍涨价有什么不同。', nextReason: '下一章会把价格放回生产和收入的变化中：经济为什么有时变快，有时又慢下来？', published: true },
  { id: 'ups-and-downs', title: '经济为什么时好时坏？', summary: '销售、生产、招工和收入怎样相互影响。', nextReason: '下一章会追问经济慢下来时能做什么：政府和中央银行可以影响哪些环节，为什么要等一段时间？', published: true },
  { id: 'policy', title: '经济慢下来，能做些什么？', summary: '政府和央行能做什么，为什么效果需要时间。', nextReason: '下一章会把前面学到的关系放回真实新闻，练习看清数字的对象、时间、口径和证据边界。', published: true },
  { id: 'reading-news', title: '怎样看懂经济新闻里的数字？', summary: '怎样比较变化，为什么不能只看一个数字。', nextReason: '主线先在这里收束。之后遇到新的新闻，可以带着这套看法回到经济活动、钱、政策和价格之间的联系。', published: true },
] as const;
export const courseLessonHref = (id: string) => `/learn/course/${id}/`;
export const publishedLessonIds = courseOutline.filter(item => item.published).map(item => item.id as string);
