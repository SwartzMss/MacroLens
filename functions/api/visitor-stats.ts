import { parseVisitorStats, visitorStatsQuery } from '../visitor-stats.ts';

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
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'text/plain',
      },
      body: visitorStatsQuery(),
    });
    if (!upstream.ok) return unavailable();
    const stats = parseVisitorStats(await upstream.json());
    return stats
      ? Response.json(stats, { headers: { 'Cache-Control': 'no-store' } })
      : unavailable();
  } catch {
    return unavailable();
  }
}
