const USER_AGENT = 'MacroLens-data-ingestion/1.0';
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = 500;
const DEFAULT_MAX_BACKOFF_MS = 4_000;

type FetchImplementation = typeof fetch;
type Sleep = (milliseconds: number) => Promise<void>;

export type FetchTextOptions = {
  fetchImpl?: FetchImplementation;
  sleep?: Sleep;
  timeoutMs?: number;
  maxAttempts?: number;
  backoffMs?: number;
  maxBackoffMs?: number;
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
};

export class FetchTextError extends Error {
  readonly url: string;
  readonly attempts: number;
  readonly status?: number;
  readonly firstCause?: unknown;

  constructor(
    message: string,
    details: { url: string; attempts: number; status?: number; cause?: unknown; firstCause?: unknown },
  ) {
    super(message, { cause: details.cause });
    this.name = 'FetchTextError';
    this.url = details.url;
    this.attempts = details.attempts;
    this.status = details.status;
    this.firstCause = details.firstCause;
  }
}

const sleepFor = (milliseconds: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function delayFor(attempt: number, base: number, maximum: number): number {
  return Math.min(base * 2 ** (attempt - 1), maximum);
}

function describeCause(cause: unknown): string {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current = cause;

  while (current !== undefined && current !== null && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      const errorWithCode = current as Error & { code?: unknown };
      const code = errorWithCode.code === undefined ? '' : ` [${String(errorWithCode.code)}]`;
      messages.push(`${current.message}${code}`);
      current = current.cause;
    } else {
      messages.push(String(current));
      break;
    }
  }

  return messages.join(' <- ');
}

function messageForFailure(
  url: string,
  attempts: number,
  status: number | undefined,
  timedOut: boolean,
  cause: unknown,
): string {
  const statusText = status === undefined ? '' : ` HTTP ${status}`;
  const timeoutText = timedOut ? ' timeout' : '';
  const causeText = cause instanceof Error
    ? `: ${describeCause(cause)}`
    : cause === undefined
      ? ''
      : `: ${describeCause(cause)}`;
  return `Fetch${timeoutText} failed${statusText} for ${url} after ${attempts} attempt${attempts === 1 ? '' : 's'}${causeText}`;
}

export async function fetchText(url: string, options: FetchTextOptions = {}): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? sleepFor;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  const maxBackoffMs = options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
  let firstCause: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: options.method ?? 'GET',
          headers: { 'user-agent': USER_AGENT, ...options.headers },
          body: options.body,
          signal: controller.signal,
        });
      } catch (cause) {
        firstCause ??= cause;
        if (attempt < maxAttempts) {
          await sleep(delayFor(attempt, backoffMs, maxBackoffMs));
          continue;
        }
        throw new FetchTextError(
          messageForFailure(url, attempt, undefined, timedOut, cause),
          { url, attempts: attempt, cause, firstCause },
        );
      }

      if (!response.ok) {
        const error = new FetchTextError(
          messageForFailure(url, attempt, response.status, false, firstCause),
          { url, attempts: attempt, status: response.status, cause: firstCause, firstCause },
        );
        if (isRetryableStatus(response.status) && attempt < maxAttempts) {
          await sleep(delayFor(attempt, backoffMs, maxBackoffMs));
          continue;
        }
        throw error;
      }

      try {
        return await response.text();
      } catch (cause) {
        throw new FetchTextError(
          messageForFailure(url, attempt, undefined, false, cause),
          { url, attempts: attempt, cause, firstCause },
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('Unreachable fetch retry state');
}
