import {
  VISITOR_COOKIE,
  createVisitorId,
  getShanghaiDate,
  isEligibleVisitorRequest,
  normalizePathname,
  parseVisitorCookie,
  visitorDataPoint,
  type VisitorEnv,
} from './visitor.ts';

type Context = {
  request: Request;
  env: VisitorEnv;
  next: () => Promise<Response>;
};

export async function onRequest({ request, env, next }: Context): Promise<Response> {
  const response = await next();
  if (!isEligibleVisitorRequest(request, response)) return response;

  try {
    const existingId = parseVisitorCookie(request);
    const visitorId = existingId ?? createVisitorId();
    const pathname = normalizePathname(new URL(request.url).pathname);

    if (env.ANALYTICS) {
      try {
        env.ANALYTICS.writeDataPoint(visitorDataPoint(visitorId, getShanghaiDate(), pathname));
      } catch {
        // Analytics is optional and must not prevent the visitor identity from being set.
      }
    }

    if (existingId) return response;

    const headers = new Headers(response.headers);
    headers.append(
      'Set-Cookie',
      `${VISITOR_COOKIE}=${visitorId}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`,
    );
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
}
