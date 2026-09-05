import { getShanghaiDate } from './visitor.ts';

export type VisitorStats = { available: true; total: number; today: number };

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
