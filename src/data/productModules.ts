export const productModules = [
  { id: 'home', label: '首页', description: '产品总入口', path: '/' },
  { id: 'learn', label: '学习', description: '固定学习路径', path: '/learn' },
  { id: 'now', label: '当前宏观', description: '观察当前数据', path: '/now' },
  { id: 'concepts', label: '知识库', description: '浏览概念集合', path: '/concepts' },
  { id: 'search', label: '搜索', description: '查找站内内容', path: '/search' },
] as const;

export type ProductModuleId = typeof productModules[number]['id'];
