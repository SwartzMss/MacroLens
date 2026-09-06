import { parseVisitorCount, visitorStatsQueries } from '../visitor-stats.ts';

type Context = {
  request: Request;
  env: {
    CLOUDFLARE_ACCOUNT_ID?: string;
    CLOUDFLARE_API_TOKEN?: string;
  };
};

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
    const queries = visitorStatsQueries();

    const query = async (sql: string) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'text/plain',
        },
        body: sql,
      });

      if (!response.ok) {
        throw new Error(`Cloudflare API ${response.status}: ${await response.text()}`);
      }

      return response.json();
    };

    const [totalPayload, todayPayload] = await Promise.all([
      query(queries.total),
      query(queries.today),
    ]);

    const total = parseVisitorCount(totalPayload, 'total');
    const today = parseVisitorCount(todayPayload, 'today');

    if (total === null || today === null) return unavailable();

    return Response.json(
      { available: true, total, today },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return unavailable();
  }
}
