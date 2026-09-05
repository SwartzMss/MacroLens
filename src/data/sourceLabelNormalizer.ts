const sourceAliases: Record<string, string> = {
  NBS: '国家统计局',
  'National Bureau of Statistics': '国家统计局',
  国家统计局: '国家统计局',
  PBOC: '中国人民银行',
  "People's Bank of China": '中国人民银行',
  中国人民银行: '中国人民银行',
};

export function normalizeSourceLabel(source: string): string {
  const normalized = source.trim();
  return sourceAliases[normalized] ?? source;
}
