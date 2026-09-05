export const VISITOR_COOKIE = 'macrolens_visitor';
export const VISITOR_INDEX = 'macrolens';

export type AnalyticsBinding = {
  writeDataPoint(point: { blobs: string[]; indexes: string[] }): void;
};

export type VisitorEnv = { ANALYTICS?: AnalyticsBinding };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseVisitorCookie(request: Request): string | null {
  const raw = request.headers.get('cookie') ?? '';
  const part = raw.split(';').map((value) => value.trim()).find((value) => value.startsWith(`${VISITOR_COOKIE}=`));
  const value = part?.slice(VISITOR_COOKIE.length + 1) ?? '';
  return uuidPattern.test(value) ? value : null;
}

export function createVisitorId(): string {
  return crypto.randomUUID();
}

export function getShanghaiDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function isEligibleVisitorRequest(request: Request, response: Response): boolean {
  const acceptsHtml = (request.headers.get('accept') ?? '')
    .split(',')
    .some((value) => value.trim().toLowerCase() === 'text/html');
  return request.method === 'GET'
    && acceptsHtml
    && response.ok
    && (response.headers.get('content-type') ?? '').toLowerCase().startsWith('text/html');
}

export function visitorDataPoint(visitorId: string, shanghaiDate: string) {
  return { blobs: [visitorId, shanghaiDate], indexes: [VISITOR_INDEX] };
}
