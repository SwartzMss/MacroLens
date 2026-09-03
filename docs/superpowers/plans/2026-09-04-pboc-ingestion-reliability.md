# PBOC Money Supply Ingestion Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make official NBS and PBOC ingestion requests observable and resilient to bounded transient network failures while preserving all existing dataset and safety contracts.

**Architecture:** Add one dependency-injected `fetchText` utility under `scripts/ingest` that owns timeout, retry, backoff, and fetch error formatting. Both ingestion CLIs call this utility; parsing and validation remain outside it, so parser failures are never retried. Tests exercise the utility with fake fetch responses and a fake sleep function.

**Tech Stack:** TypeScript, Node 20 native `fetch`, `AbortController`, Node `node:test`, Astro checks.

---

## File map

- Create `scripts/ingest/fetch-text.ts`: shared HTTP text fetcher, retry policy, timeout, and `FetchTextError`.
- Modify `scripts/ingest/cli.ts`: remove the local NBS fetch implementation and import the shared utility.
- Modify `scripts/ingest/money-supply-cli.ts`: remove the local PBOC fetch implementation and import the shared utility.
- Create `tests/ingestion-fetch-text.test.mjs`: deterministic unit tests for success, timeout, retry classification, backoff, and diagnostics.
- Create `docs/superpowers/plans/2026-09-04-pboc-ingestion-reliability.md`: this implementation plan.

### Task 1: Define and verify the shared fetch contract

**Files:**
- Create: `scripts/ingest/fetch-text.ts`
- Create: `tests/ingestion-fetch-text.test.mjs`

- [ ] **Step 1: Write the failing tests for the public fetch behavior.**

Create `tests/ingestion-fetch-text.test.mjs` with fake `Response` values and a fake sleep function. The tests must assert observable behavior rather than implementation details:

```js
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

test('preserves the underlying transport cause after retries are exhausted', async () => {
  const firstCause = new Error('ECONNRESET');
  const finalCause = new Error('getaddrinfo ENOTFOUND pbc.gov.cn');
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
      && error.message.includes('ENOTFOUND'),
  );
  assert.equal(attempts, 2);
});

test('converts an aborted request timeout into a diagnostic fetch error', async () => {
  await assert.rejects(
    () => fetchText(url, {
      timeoutMs: 1,
      maxAttempts: 1,
      fetchImpl: async (_input, init) => new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('request aborted')), { once: true });
      }),
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
```

- [ ] **Step 2: Run the focused test and verify it fails for the missing module.**

Run:

```bash
node --import tsx --test tests/ingestion-fetch-text.test.mjs
```

Expected: FAIL because `scripts/ingest/fetch-text.ts` does not exist yet; do not change the tests to make this initial failure pass.

- [ ] **Step 3: Implement the minimal shared fetcher.**

Create `scripts/ingest/fetch-text.ts` with the exact contract used by the tests:

```ts
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

function messageForFailure(
  url: string,
  attempts: number,
  status: number | undefined,
  timedOut: boolean,
  cause: unknown,
): string {
  const statusText = status === undefined ? '' : ` HTTP ${status}`;
  const timeoutText = timedOut ? ' timeout' : '';
  const causeText = cause instanceof Error ? `: ${cause.message}` : cause === undefined ? '' : `: ${String(cause)}`;
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
          headers: { 'user-agent': USER_AGENT },
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
          messageForFailure(url, attempt, response.status, false, undefined),
          { url, attempts: attempt, status: response.status },
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
          { url, attempts: attempt, cause },
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('Unreachable fetch retry state');
}
```

- [ ] **Step 4: Run the focused tests and the type checker.**

Run:

```bash
node --import tsx --test tests/ingestion-fetch-text.test.mjs
npm run check
```

Expected: all focused fetch tests pass and `astro check` exits 0. If TypeScript rejects the fake response type, update only the test helper or the `FetchImplementation` type while preserving the public behavior above.

- [ ] **Step 5: Commit the shared fetch contract.**

```bash
git add scripts/ingest/fetch-text.ts tests/ingestion-fetch-text.test.mjs
git commit -m "test: define resilient ingestion fetch contract"
```

### Task 2: Route both ingestion CLIs through the shared fetcher

**Files:**
- Modify: `scripts/ingest/cli.ts`
- Modify: `scripts/ingest/money-supply-cli.ts`

- [ ] **Step 1: Replace the duplicated NBS fetch helper.**

In `scripts/ingest/cli.ts`, add:

```ts
import { fetchText } from './fetch-text.ts';
```

Delete the local `async function fetchText(url: string)` implementation. Keep `loadPublication` unchanged except that its existing `fetchText(NBS_PUBLICATION_INDEX)` and `fetchText(publication.url)` calls now resolve to the imported helper.

- [ ] **Step 2: Replace the duplicated PBOC fetch helper.**

In `scripts/ingest/money-supply-cli.ts`, add:

```ts
import { fetchText } from './fetch-text.ts';
```

Delete the local `async function fetchText(url: string)` implementation. Keep `loadIndex` and `loadReports` unchanged so fixtures still use local files and live mode uses the official PBOC index and publication URLs.

- [ ] **Step 3: Run ingestion regression tests against fixtures.**

Run:

```bash
node --import tsx --test tests/ingestion-fetch-text.test.mjs tests/ingestion-pboc-money-supply.test.mjs tests/ingestion-pmi.test.mjs
```

Expected: all fetch, PBOC, and PMI tests pass; the fixture CLI still reports `Changed: true` on the first run and `Changed: false` on the idempotent second run, and historical mismatch tests still leave all targets unchanged.

- [ ] **Step 4: Commit the CLI integration.**

```bash
git add scripts/ingest/cli.ts scripts/ingest/money-supply-cli.ts
git commit -m "fix: harden official macro data fetches"
```

### Task 3: Validate the complete change and prepare the PR

**Files:**
- Modify: none beyond the files above unless verification exposes a concrete regression.

- [ ] **Step 1: Run the complete automated checks.**

Run:

```bash
npm test
npm run check
npm run build
git diff --check HEAD~2..HEAD
git status --short
```

Expected: all Node tests pass, Astro check passes, the production build completes, the diff check is clean, and the branch contains only the intended design/plan, fetch utility, tests, and CLI integration files.

- [ ] **Step 2: Run the fixture PBOC CLI explicitly.**

Run:

```bash
target_dir=$(mktemp -d /tmp/macrolens-pboc-live-check-XXXXXX)
cp data/indicators/m0.json "$target_dir/m0.json"
cp data/indicators/m1.json "$target_dir/m1.json"
cp data/indicators/m2.json "$target_dir/m2.json"
npm run ingest:pboc-money-supply -- \
  --fixture-index tests/fixtures/pboc/publication-index.html \
  --fixture-dir tests/fixtures/pboc \
  --target-dir "$target_dir"
```

Expected: the command succeeds and does not modify tracked `data/indicators` files.

- [ ] **Step 3: Run one live PBOC verification into a temporary directory.**

Run:

```bash
target_dir=$(mktemp -d /tmp/macrolens-pboc-live-check-XXXXXX)
cp data/indicators/m0.json "$target_dir/m0.json"
cp data/indicators/m1.json "$target_dir/m1.json"
cp data/indicators/m2.json "$target_dir/m2.json"
npm run ingest:pboc-money-supply -- --target-dir "$target_dir"
```

Expected: the official index and report URLs either ingest successfully or fail with a message naming the exact URL, status/timeout, attempt count, and underlying cause. No tracked data file may change during this check.

- [ ] **Step 4: Push the branch and create the pull request.**

```bash
git push -u https://github.com/SwartzMss/MacroLens.git codex/issue-55-pboc-reliability
gh pr create \
  --repo SwartzMss/MacroLens \
  --base main \
  --head codex/issue-55-pboc-reliability \
  --title "fix: improve PBOC money supply ingestion reliability" \
  --body-file /tmp/macrolens-issue-55-pr-body.md
```

Create `/tmp/macrolens-issue-55-pr-body.md` immediately before the command with:

```markdown
## Summary

- add bounded timeout/retry/backoff handling for official macro-data fetches
- include source URL, status, attempt count, and underlying causes in fetch errors
- route both NBS and PBOC ingestion CLIs through the shared fetcher
- add deterministic regression coverage for transient and terminal failures

## Validation

- `npm test`
- `npm run check`
- `npm run build`
- fixture PBOC ingestion
- live PBOC ingestion into a temporary target directory

Closes #55
```

Expected: GitHub returns a new PR URL targeting `main`, and the PR body references Issue #55.
