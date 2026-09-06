import { getShanghaiDate, normalizeConceptPath } from './visitor.ts';

export type VisitorStats = { available: true; total: number; today: number };
export type PageStat = { path: string; total: number; today?: number };

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
  const scope = "FROM macrolens_visitors WHERE blob3 LIKE '/concepts/%'";
  return {
    total: `SELECT blob3 AS path, COUNT(DISTINCT blob1) AS total ${scope} GROUP BY blob3 ORDER BY total DESC`,
    today: `SELECT blob3 AS path, COUNT(DISTINCT blob1) AS today ${scope} AND blob2 = '${safeDate}' GROUP BY blob3 ORDER BY today DESC`,
  };
}

export function parsePageStats(payload: unknown, field: 'total' | 'today'): PageStat[] | null {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data?: unknown }).data)) return null;

  const rows = (payload as { data: unknown[] }).data;
  const pages: PageStat[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') return null;
    const path = normalizeConceptPath((row as Record<string, unknown>).path);
    const rawCount = (row as Record<string, unknown>)[field];
    const count = typeof rawCount === 'number' ? rawCount : Number(rawCount);
    if (!path || !Number.isSafeInteger(count) || count < 0 || seen.has(path)) return null;
    seen.add(path);
    pages.push(field === 'total' ? { path, total: count } : { path, total: 0, today: count });
  }
  return pages;
}

export function combinePageStats(total: PageStat[], today: PageStat[]): PageStat[] {
  const todayByPath = new Map(today.map((page) => [page.path, page.today ?? 0]));
  return total.map((page) => ({
    path: page.path,
    total: page.total,
    today: todayByPath.get(page.path) ?? 0,
  }));
}
