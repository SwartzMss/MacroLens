import { parseVisitorStats, visitorStatsQuery } from '../visitor-stats.ts';

type Context = {
  request: Request;
  env: {
    CLOUDFLARE_ACCOUNT_ID?: string;
    CLOUDFLARE_API_TOKEN?: string;
  };
};

const unavailable = (extra?: Record<string, unknown>) => Response.json(
  { available: false, ...extra },
  { headers: { 'Cache-Control': 'no-store' } },
);

export async function onRequest({ request, env }: Context): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: { Allow: 'GET' } });
  }
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    return unavailable({
      error: 'missing credentials',
      accountId: Boolean(env.CLOUDFLARE_ACCOUNT_ID),
      apiToken: Boolean(env.CLOUDFLARE_API_TOKEN),
    });
  }

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

    if (!upstream.ok) {
      return unavailable({
        error: `Cloudflare API ${upstream.status}`,
        detail: await upstream.text(),
      });
    }

    const payload = await upstream.json();
    const stats = parseVisitorStats(payload);
    return stats
      ? Response.json(stats, { headers: { 'Cache-Control': 'no-store' } })
      : unavailable({ error: 'invalid analytics response', payload });
  } catch (error) {
    return unavailable({ error: String(error) });
  }
}
