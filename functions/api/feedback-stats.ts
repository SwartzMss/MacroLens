import type { FeedbackReason } from './feedback.ts';

type FeedbackAggregateRow = {
  page_id?: unknown;
  feedback_count?: unknown;
  helpful?: unknown;
  needs_improvement?: unknown;
} & Partial<Record<`reason_${FeedbackReason}`, unknown>>;

type FeedbackAggregateStatement = {
  all<T>(): Promise<{ results?: T[] }>;
};

type FeedbackAggregateDatabase = {
  prepare(query: string): FeedbackAggregateStatement;
};

type Context = {
  request: Request;
  env: { FEEDBACK_DB?: FeedbackAggregateDatabase };
};

export type FeedbackPageStat = {
  pageId: string;
  feedbackCount: number;
  helpful: number;
  needsImprovement: number;
  helpfulRate: number;
  reasons: Record<FeedbackReason, number>;
};

const pageIdPattern = /^(?:learn:)?[a-z0-9]+(?:-[a-z0-9]+)*$/;
const feedbackReasonValues: FeedbackReason[] = [
  'too_complex',
  'sequence_jump',
  'missing_example',
  'missing_step',
  'questionable',
  'unclear_chart',
  'incomplete',
];
const responseHeaders = { 'Cache-Control': 'public, max-age=60, s-maxage=300' };
const unavailable = () => Response.json(
  { available: false },
  { headers: { 'Cache-Control': 'no-store' } },
);

export function feedbackStatsQuery(): string {
  const reasonColumns = feedbackReasonValues
    .map(reason => `SUM(CASE WHEN reason = '${reason}' THEN 1 ELSE 0 END) AS reason_${reason}`)
    .join(',\n      ');
  return `
    SELECT
      page_id,
      COUNT(*) AS feedback_count,
      SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END) AS helpful,
      SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END) AS needs_improvement,
      ${reasonColumns}
    FROM page_feedback
    GROUP BY page_id
    ORDER BY feedback_count DESC, page_id ASC
  `;
}

function parseCount(value: unknown): number | null {
  const count = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

export function parseFeedbackStats(payload: unknown): FeedbackPageStat[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) return null;

  const pages: FeedbackPageStat[] = [];
  const seen = new Set<string>();
  for (const rawRow of results) {
    if (!rawRow || typeof rawRow !== 'object') return null;
    const row = rawRow as FeedbackAggregateRow;
    const pageId = typeof row.page_id === 'string' && pageIdPattern.test(row.page_id) ? row.page_id : null;
    const feedbackCount = parseCount(row.feedback_count);
    const helpful = parseCount(row.helpful);
    const needsImprovement = parseCount(row.needs_improvement);
    if (
      !pageId
      || feedbackCount === null
      || helpful === null
      || needsImprovement === null
      || helpful + needsImprovement !== feedbackCount
      || seen.has(pageId)
    ) return null;

    const reasons = {} as Record<FeedbackReason, number>;
    let reasonTotal = 0;
    for (const reason of feedbackReasonValues) {
      const count = parseCount(row[`reason_${reason}`]);
      if (count === null) return null;
      reasons[reason] = count;
      reasonTotal += count;
    }
    if (reasonTotal > needsImprovement) return null;

    seen.add(pageId);
    pages.push({
      pageId,
      feedbackCount,
      helpful,
      needsImprovement,
      helpfulRate: feedbackCount === 0 ? 0 : Math.round((helpful / feedbackCount) * 1000) / 10,
      reasons,
    });
  }
  return pages;
}

export async function onRequest({ request, env }: Context): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: { Allow: 'GET' } });
  }
  if (!env.FEEDBACK_DB) return unavailable();

  try {
    const payload = await env.FEEDBACK_DB.prepare(feedbackStatsQuery()).all<FeedbackAggregateRow>();
    const pages = parseFeedbackStats(payload);
    if (!pages) return unavailable();

    return Response.json(
      { available: true, pages },
      { headers: responseHeaders },
    );
  } catch {
    return unavailable();
  }
}
