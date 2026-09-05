import { getShanghaiDate } from './visitor.ts';

export type VisitorStats = { available: true; total: number; today: number };

export function visitorStatsQuery(today = getShanghaiDate()): string {
  const safeDate = today.replaceAll("'", "''");
  return `SELECT (SELECT COUNT(DISTINCT blob1) FROM macrolens_visitors) AS total, (SELECT COUNT(DISTINCT blob1) FROM macrolens_visitors WHERE blob2 = '${safeDate}') AS today`;
}

export function parseVisitorStats(payload: unknown): VisitorStats | null {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data?: unknown }).data)) return null;
  const rows = (payload as { data: unknown[] }).data;
  if (rows.length !== 1 || !rows[0] || typeof rows[0] !== 'object') return null;
  const row = rows[0] as { total?: unknown; today?: unknown };
  const total = typeof row.total === 'number' ? row.total : Number(row.total);
  const today = typeof row.today === 'number' ? row.today : Number(row.today);
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(today) || today < 0) return null;
  return { available: true, total, today };
}
