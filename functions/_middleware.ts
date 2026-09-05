import {
  VISITOR_COOKIE,
  createVisitorId,
  getShanghaiDate,
  isEligibleVisitorRequest,
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
  if (!isEligibleVisitorRequest(request, response) || !env.ANALYTICS) return response;

  try {
    const existingId = parseVisitorCookie(request);
    const visitorId = existingId ?? createVisitorId();
    env.ANALYTICS.writeDataPoint(visitorDataPoint(visitorId, getShanghaiDate()));
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
