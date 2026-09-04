import assert from 'node:assert/strict';
import test from 'node:test';
import { FetchTextError, fetchText } from '../scripts/ingest/fetch-text.ts';

const url = 'https://example.test/source.html';
const response = (body, status = 200) => new Response(body, { status });

test('returns response text and sends the MacroLens user agent', async () => {
  let request;
  const body = await fetchText(url, {
    fetchImpl: async (input, init) => {
      request = { input, init };
      return response('official body');
    },
  });

  assert.equal(body, 'official body');
  assert.equal(request.input, url);
  assert.equal(request.init.headers['user-agent'], 'MacroLens-data-ingestion/1.0');
  assert.ok(request.init.signal instanceof AbortSignal);
});

test('passes adapter-scoped POST request options through the shared fetch boundary', async () => {
  let request;
  const body = await fetchText(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      referer: 'https://data.stats.gov.cn/dg/website/page.html',
    },
    body: '{"ok":true}',
    fetchImpl: async (input, init) => {
      request = { input, init };
      return response('{"success":true}');
    },
  });

  assert.equal(body, '{"success":true}');
  assert.equal(request.input, url);
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.body, '{"ok":true}');
  assert.equal(request.init.headers.accept, 'application/json');
  assert.equal(request.init.headers.referer, 'https://data.stats.gov.cn/dg/website/page.html');
  assert.equal(request.init.headers['user-agent'], 'MacroLens-data-ingestion/1.0');
});

test('retries a transport failure and returns the next successful response', async () => {
  let attempts = 0;
  const delays = [];
  const body = await fetchText(url, {
    maxAttempts: 3,
    backoffMs: 100,
    maxBackoffMs: 500,
    sleep: async (milliseconds) => delays.push(milliseconds),
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('ECONNRESET');
      return response('recovered');
    },
  });

  assert.equal(body, 'recovered');
  assert.equal(attempts, 2);
  assert.deepEqual(delays, [100]);
});

test('retries HTTP 429 and 5xx responses but not a 4xx response', async () => {
  let retryableAttempts = 0;
  const retryableDelays = [];
  const body = await fetchText(url, {
    maxAttempts: 3,
    backoffMs: 25,
    sleep: async (milliseconds) => retryableDelays.push(milliseconds),
    fetchImpl: async () => {
      retryableAttempts += 1;
      return retryableAttempts === 1 ? response('busy', 503) : response('ok');
    },
  });
  assert.equal(body, 'ok');
  assert.equal(retryableAttempts, 2);
  assert.deepEqual(retryableDelays, [25]);

  let clientErrorAttempts = 0;
  await assert.rejects(
    () => fetchText(url, {
      maxAttempts: 3,
      sleep: async () => assert.fail('4xx responses must not sleep'),
      fetchImpl: async () => {
        clientErrorAttempts += 1;
        return response('not found', 404);
      },
    }),
    (error) => error instanceof FetchTextError
      && error.status === 404
      && error.attempts === 1
      && error.message.includes(url),
  );
  assert.equal(clientErrorAttempts, 1);
});

test('reports the final HTTP failure with URL, status, and attempt count', async () => {
  let attempts = 0;
  await assert.rejects(
    () => fetchText(url, {
      maxAttempts: 3,
      backoffMs: 10,
      sleep: async () => {},
      fetchImpl: async () => {
        attempts += 1;
        return response('upstream unavailable', 503);
      },
    }),
    (error) => error instanceof FetchTextError
      && error.url === url
      && error.status === 503
      && error.attempts === 3
      && error.message.includes(url)
      && error.message.includes('503'),
  );
  assert.equal(attempts, 3);
});

test('retains an earlier transport cause when the final failure is an HTTP response', async () => {
  const firstCause = new Error('ECONNRESET');
  let attempts = 0;
  await assert.rejects(
    () => fetchText(url, {
      maxAttempts: 2,
      sleep: async () => {},
      fetchImpl: async () => {
        attempts += 1;
        if (attempts === 1) throw firstCause;
        return response('upstream unavailable', 503);
      },
    }),
    (error) => error instanceof FetchTextError
      && error.status === 503
      && error.attempts === 2
      && error.cause === firstCause
      && error.firstCause === firstCause
      && error.message.includes('ECONNRESET'),
  );
  assert.equal(attempts, 2);
});

test('preserves the underlying transport cause after retries are exhausted', async () => {
  const firstCause = new Error('ECONNRESET');
  const finalCause = new Error('fetch failed', {
    cause: new Error('getaddrinfo EAI_AGAIN pbc.gov.cn'),
  });
  let attempts = 0;
  await assert.rejects(
    () => fetchText(url, {
      maxAttempts: 2,
      sleep: async () => {},
      fetchImpl: async () => {
        attempts += 1;
        throw attempts === 1 ? firstCause : finalCause;
      },
    }),
    (error) => error instanceof FetchTextError
      && error.url === url
      && error.attempts === 2
      && error.cause === finalCause
      && error.firstCause === firstCause
      && error.message.includes('EAI_AGAIN'),
  );
  assert.equal(attempts, 2);
});

test('converts an aborted request timeout into a diagnostic fetch error', async () => {
  await assert.rejects(
    () => fetchText(url, {
      timeoutMs: 1,
      maxAttempts: 1,
      fetchImpl: async (_input, init) => {
        await new Promise((resolve) => {
          init.signal.addEventListener('abort', () => resolve(), { once: true });
        });
        throw new Error('request aborted');
      },
    }),
    (error) => error instanceof FetchTextError
      && error.url === url
      && error.attempts === 1
      && error.message.includes('timeout'),
  );
});

test('does not retry an accepted response whose body read fails', async () => {
  let attempts = 0;
  await assert.rejects(
    () => fetchText(url, {
      maxAttempts: 3,
      sleep: async () => assert.fail('body-read failures must not retry'),
      fetchImpl: async () => {
        attempts += 1;
        return { ok: true, status: 200, text: async () => { throw new Error('body stream failed'); } };
      },
    }),
    (error) => error instanceof FetchTextError
      && error.url === url
      && error.attempts === 1
      && error.cause?.message === 'body stream failed',
  );
  assert.equal(attempts, 1);
});
