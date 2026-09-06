import { combinePageStats, pageStatsQueries, parsePageStats } from '../visitor-stats.ts';

type Context = {
  request: Request;
  env: {
    CLOUDFLARE_ACCOUNT_ID?: string;
    CLOUDFLARE_API_TOKEN?: string;
  };
};

const responseHeaders = { 'Cache-Control': 'public, max-age=60, s-maxage=300' };
const unavailable = () => Response.json(
  { available: false },
  { headers: { 'Cache-Control': 'no-store' } },
);

export async function onRequest({ request, env }: Context): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: { Allow: 'GET' } });
  }
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) return unavailable();

  try {
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/analytics_engine/sql`;
    const queries = pageStatsQueries();
    const query = async (sql: string) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'text/plain',
        },
        body: sql,
      });
      if (!response.ok) throw new Error('Analytics Engine query failed');
      return response.json();
    };

    const [totalPayload, todayPayload] = await Promise.all([
      query(queries.total),
      query(queries.today),
    ]);
    const total = parsePageStats(totalPayload, 'total');
    const today = parsePageStats(todayPayload, 'today');
    if (!total || !today) return unavailable();

    return Response.json(
      { available: true, pages: combinePageStats(total, today) },
      { headers: responseHeaders },
    );
  } catch {
    return unavailable();
  }
}
