import { parseVisitorCookie } from '../visitor.ts';

export type FeedbackVote = 'helpful' | 'needs-improvement';
export type FeedbackReason =
  | 'too_complex'
  | 'missing_example'
  | 'unclear_chart'
  | 'incomplete'
  | 'questionable';

type FeedbackStatement = {
  bind(...values: unknown[]): FeedbackStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
};

export type FeedbackDatabase = {
  prepare(query: string): FeedbackStatement;
};

type Context = {
  request: Request;
  env: { FEEDBACK_DB?: FeedbackDatabase };
};

const MAX_BODY_BYTES = 2048;
const pageIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const feedbackReasons = new Set<FeedbackReason>([
  'too_complex',
  'missing_example',
  'unclear_chart',
  'incomplete',
  'questionable',
]);

const voteValues: Record<FeedbackVote, number> = {
  helpful: 1,
  'needs-improvement': -1,
};

const responseHeaders = { 'Cache-Control': 'no-store' };

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: responseHeaders });
}

function isFeedbackVote(value: unknown): value is FeedbackVote {
  return value === 'helpful' || value === 'needs-improvement';
}

function isFeedbackReason(value: unknown): value is FeedbackReason {
  return typeof value === 'string' && feedbackReasons.has(value as FeedbackReason);
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function parsePageId(value: unknown): string | null {
  return typeof value === 'string' && value.length <= 100 && pageIdPattern.test(value) ? value : null;
}

async function readBoundedBody(request: Request): Promise<{ body?: string; status?: number }> {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const length = Number(contentLength);
    if (!Number.isSafeInteger(length) || length < 0) return { status: 400 };
    if (length > MAX_BODY_BYTES) return { status: 413 };
  }

  if (!request.body) return { body: '' };

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return { status: 413 };
      }
      chunks.push(value);
    }
    return { body: chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('') + decoder.decode() };
  } catch {
    return { status: 400 };
  } finally {
    reader.releaseLock();
  }
}

function parseVotePayload(value: unknown): { pageId: string; vote: FeedbackVote; reason: FeedbackReason | null } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  const pageId = parsePageId(payload.pageId);
  if (!pageId || !isFeedbackVote(payload.vote)) return null;

  const reason = payload.reason === undefined || payload.reason === null ? null : payload.reason;
  if (reason !== null && (!isFeedbackReason(reason) || payload.vote !== 'needs-improvement')) return null;
  return { pageId, vote: payload.vote, reason };
}

async function getPageId(request: Request): Promise<string | null> {
  try {
    return parsePageId(new URL(request.url).searchParams.get('pageId'));
  } catch {
    return null;
  }
}

export async function onRequest({ request, env }: Context): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } });
  }
  if (!isSameOrigin(request)) return json({ ok: false }, 403);

  const visitorId = parseVisitorCookie(request);
  if (!visitorId) return json({ ok: false }, 401);
  if (!env.FEEDBACK_DB) return json({ ok: false }, 503);

  if (request.method === 'GET') {
    const pageId = await getPageId(request);
    if (!pageId) return json({ ok: false }, 400);

    try {
      const row = await env.FEEDBACK_DB
        .prepare('SELECT vote, reason FROM page_feedback WHERE page_id = ? AND visitor_id = ?')
        .bind(pageId, visitorId)
        .first<{ vote: number; reason: FeedbackReason | null }>();
      if (!row) return json({ ok: true, vote: null });
      const vote = row.vote === 1 ? 'helpful' : row.vote === -1 ? 'needs-improvement' : null;
      return vote ? json({ ok: true, vote, reason: isFeedbackReason(row.reason) ? row.reason : null }) : json({ ok: true, vote: null });
    } catch {
      return json({ ok: false }, 503);
    }
  }

  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return json({ ok: false }, 415);
  }

  const bounded = await readBoundedBody(request);
  if (bounded.status) return json({ ok: false }, bounded.status);

  let payload: unknown;
  try {
    payload = JSON.parse(bounded.body ?? '');
  } catch {
    return json({ ok: false }, 400);
  }

  const feedback = parseVotePayload(payload);
  if (!feedback) return json({ ok: false }, 400);

  const now = new Date().toISOString();
  try {
    await env.FEEDBACK_DB.prepare(`
      INSERT INTO page_feedback (page_id, visitor_id, vote, reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(page_id, visitor_id)
      DO UPDATE SET
        vote = excluded.vote,
        reason = excluded.reason,
        updated_at = excluded.updated_at
    `).bind(
      feedback.pageId,
      visitorId,
      voteValues[feedback.vote],
      feedback.reason,
      now,
      now,
    ).run();
  } catch {
    return json({ ok: false }, 503);
  }

  return json({ ok: true });
}
