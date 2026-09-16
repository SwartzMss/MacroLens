import { getShanghaiDate } from './visitor.ts';

export type VisitorStats = { available: true; total: number; today: number };
export type PageStat = { pageId: string; total: number; today?: number };

export function visitorStatsQueries(today = getShanghaiDate()): { total: string; today: string } {
  const safeDate = today.replaceAll("'", "''");
  return {
    total: 'SELECT COUNT(DISTINCT blob1) AS total FROM macrolens_visitors',
    today: `SELECT COUNT(DISTINCT blob1) AS today FROM macrolens_visitors WHERE blob2 = '${safeDate}'`,
  };
}

export function parseVisitorCount(payload: unknown, field: 'total' | 'today'): number | null {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data?: unknown }).data)) return null;
  const rows = (payload as { data: unknown[] }).data;
  if (rows.length !== 1 || !rows[0] || typeof rows[0] !== 'object') return null;
  const value = (rows[0] as Record<string, unknown>)[field];
  const count = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

export function pageStatsQueries(today = getShanghaiDate()): { total: string; today: string } {
  const safeDate = today.replaceAll("'", "''");
  const scope = "FROM macrolens_visitors WHERE blob4 LIKE 'learn:%'";
  return {
    total: `SELECT blob4 AS page_id, COUNT(DISTINCT blob1) AS total ${scope} GROUP BY blob4 ORDER BY total DESC`,
    today: `SELECT blob4 AS page_id, COUNT(DISTINCT blob1) AS today ${scope} AND blob2 = '${safeDate}' GROUP BY blob4 ORDER BY today DESC`,
  };
}

export function parsePageStats(payload: unknown, field: 'total' | 'today'): PageStat[] | null {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data?: unknown }).data)) return null;

  const rows = (payload as { data: unknown[] }).data;
  const pages: PageStat[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') return null;
    const pageId = (row as Record<string, unknown>).page_id;
    const rawCount = (row as Record<string, unknown>)[field];
    const count = typeof rawCount === 'number' ? rawCount : Number(rawCount);
    if (typeof pageId !== 'string' || !/^learn:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pageId)
      || !Number.isSafeInteger(count) || count < 0 || seen.has(pageId)) return null;
    seen.add(pageId);
    pages.push(field === 'total' ? { pageId, total: count } : { pageId, total: 0, today: count });
  }
  return pages;
}

export function combinePageStats(total: PageStat[], today: PageStat[]): PageStat[] {
  const todayByPage = new Map(today.map((page) => [page.pageId, page.today ?? 0]));
  return total.map((page) => ({
    pageId: page.pageId,
    total: page.total,
    today: todayByPage.get(page.pageId) ?? 0,
  }));
}
