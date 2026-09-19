import { productModules, type ProductModuleId } from '../src/data/productModules.ts';
import { getShanghaiDate } from './visitor.ts';

export type ModuleStat = { moduleId: ProductModuleId; total: number; today: number };
type ParsedModuleStat = { moduleId: ProductModuleId; total: number; today?: number };

const moduleIds = new Set<ProductModuleId>(productModules.map(module => module.id));

function moduleCondition(module: typeof productModules[number]): string {
  return module.path === '/'
    ? "blob3 = '/'"
    : `(blob3 = '${module.path}' OR blob3 LIKE '${module.path}/%')`;
}

function moduleCase(): string {
  return `CASE ${productModules.map(module => `WHEN ${moduleCondition(module)} THEN '${module.id}'`).join(' ')} END`;
}

function moduleScope(): string {
  return productModules.map(moduleCondition).join(' OR ');
}

export function moduleStatsQueries(today = getShanghaiDate()): { total: string; today: string } {
  const safeDate = today.replaceAll("'", "''");
  const expression = moduleCase();
  const scope = moduleScope();
  return {
    total: `SELECT ${expression} AS module_id, COUNT(DISTINCT blob1) AS total FROM macrolens_visitors WHERE ${scope} GROUP BY module_id ORDER BY total DESC`,
    today: `SELECT ${expression} AS module_id, COUNT(DISTINCT blob1) AS today FROM macrolens_visitors WHERE ${scope} AND blob2 = '${safeDate}' GROUP BY module_id ORDER BY today DESC`,
  };
}

function parseCount(value: unknown): number | null {
  const count = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

export function parseModuleStats(payload: unknown, field: 'total' | 'today'): ParsedModuleStat[] | null {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data?: unknown }).data)) return null;

  const rows = (payload as { data: unknown[] }).data;
  const modules: ParsedModuleStat[] = [];
  const seen = new Set<ProductModuleId>();
  for (const rawRow of rows) {
    if (!rawRow || typeof rawRow !== 'object') return null;
    const row = rawRow as Record<string, unknown>;
    const moduleId = typeof row.module_id === 'string' && moduleIds.has(row.module_id as ProductModuleId)
      ? row.module_id as ProductModuleId
      : null;
    const count = parseCount(row[field]);
    if (!moduleId || count === null || seen.has(moduleId)) return null;
    seen.add(moduleId);
    modules.push(field === 'total' ? { moduleId, total: count } : { moduleId, total: 0, today: count });
  }
  return modules;
}

export function combineModuleStats(total: ParsedModuleStat[], today: ParsedModuleStat[]): ModuleStat[] {
  const totalByModule = new Map(total.map(module => [module.moduleId, module.total]));
  const todayByModule = new Map(today.map(module => [module.moduleId, module.today ?? 0]));
  return productModules.map(({ id }) => ({
    moduleId: id,
    total: totalByModule.get(id) ?? 0,
    today: todayByModule.get(id) ?? 0,
  }));
}
