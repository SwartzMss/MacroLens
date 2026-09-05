const DEFAULT_WEBSITE_ID = 'e5b57255-bb27-4381-bd05-21bc5e30166a';
const DEFAULT_API_ENDPOINT = 'https://api.umami.is/v1';
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export type UmamiEnv = {
  UMAMI_API_KEY?: string;
  UMAMI_WEBSITE_ID?: string;
  UMAMI_API_ENDPOINT?: string;
};

export type VisitorStats = {
  totalVisitors: number;
  todayVisitors: number;
};

type Fetcher = typeof fetch;
type JsonRecord = Record<string, unknown>;

function startOfShanghaiDay(now: number): number {
  const shifted = new Date(now + SHANGHAI_OFFSET_MS);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - SHANGHAI_OFFSET_MS;
}

function asRecord(value: unknown, message: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as JsonRecord;
}

function asNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid Umami ${field}`);
  }
  return value;
}

async function getJson(url: string, apiKey: string, fetcher: Fetcher): Promise<unknown> {
  const response = await fetcher(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`Umami request failed with status ${response.status}`);
  return response.json();
}

function dateRangeFrom(value: unknown): { startAt: number; endAt: number } {
  const record = asRecord(value, 'Invalid Umami date range');
  const startAt = Date.parse(String(record.startDate ?? ''));
  const endAt = Date.parse(String(record.endDate ?? ''));
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt < startAt) {
    throw new Error('Invalid Umami date range');
  }
  return { startAt, endAt };
}

function visitorsFrom(value: unknown): number {
  return asNonNegativeInteger(asRecord(value, 'Invalid Umami stats').visitors, 'visitor count');
}

export async function fetchVisitorStats(
  env: UmamiEnv,
  fetcher: Fetcher = fetch,
  now = Date.now(),
): Promise<VisitorStats> {
  const apiKey = env.UMAMI_API_KEY?.trim();
  if (!apiKey) throw new Error('Umami configuration is unavailable');

  const websiteId = env.UMAMI_WEBSITE_ID?.trim() || DEFAULT_WEBSITE_ID;
  const endpoint = (env.UMAMI_API_ENDPOINT?.trim() || DEFAULT_API_ENDPOINT).replace(/\/+$/, '');
  const baseUrl = `${endpoint}/websites/${encodeURIComponent(websiteId)}`;
  const dateRange = dateRangeFrom(await getJson(`${baseUrl}/daterange`, apiKey, fetcher));
  const fullRangeEnd = Math.min(now, dateRange.endAt);
  const todayStart = startOfShanghaiDay(now);

  const [total, today] = await Promise.all([
    getJson(`${baseUrl}/stats?startAt=${dateRange.startAt}&endAt=${fullRangeEnd}`, apiKey, fetcher),
    getJson(`${baseUrl}/stats?startAt=${todayStart}&endAt=${now}`, apiKey, fetcher),
  ]);

  return {
    totalVisitors: visitorsFrom(total),
    todayVisitors: visitorsFrom(today),
  };
}

export const onRequestGet = async ({ env }: { env: UmamiEnv }): Promise<Response> => {
  try {
    const stats = await fetchVisitorStats(env);
    return new Response(JSON.stringify(stats), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (error) {
    const status = error instanceof Error && error.message === 'Umami configuration is unavailable' ? 503 : 502;
    return new Response(JSON.stringify({ error: 'Visitor stats unavailable' }), {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }
};
