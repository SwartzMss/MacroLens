import { getShanghaiDate } from './visitor.ts';

export type VisitorStats = { available: true; total: number; today: number };

export function visitorStatsQuery(today = getShanghaiDate()): string {
  const safeDate = today.replaceAll("'", "''");
  return [
    "SELECT 'total' AS metric, COUNT(DISTINCT blob1) AS visitors FROM macrolens_visitors",
    `SELECT 'today' AS metric, COUNT(DISTINCT blob1) AS visitors FROM macrolens_visitors WHERE blob2 = '${safeDate}'`,
  ].join(' UNION ALL ');
}

export function parseVisitorStats(payload: unknown): VisitorStats | null {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data?: unknown }).data)) return null;
  const rows = (payload as { data: unknown[] }).data;
  const values = new Map<string, number>();

  for (const row of rows) {
    if (!row || typeof row !== 'object') return null;
    const typedRow = row as { metric?: unknown; visitors?: unknown };
    const metric = typedRow.metric;
    if ((metric !== 'total' && metric !== 'today') || values.has(metric)) return null;
    const value = typeof typedRow.visitors === 'number' ? typedRow.visitors : Number(typedRow.visitors);
    if (!Number.isSafeInteger(value) || value < 0) return null;
    values.set(metric, value);
  }

  if (values.size !== 2) return null;
  const total = values.get('total');
  const today = values.get('today');
  if (total === undefined || today === undefined) return null;
  return { available: true, total, today };
}
