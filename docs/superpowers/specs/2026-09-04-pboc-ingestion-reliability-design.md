# PBOC Money Supply Ingestion Reliability

## Context

The scheduled `Update macro data` workflow already validates and writes M0, M1, and M2 datasets safely, but live PBOC requests can fail with only `TypeError: fetch failed`. The failure hides the source URL and the underlying network cause, and transient failures are not retried.

## Goals

- Make fetch failures actionable by preserving the requested URL, HTTP status when available, attempt information, and the underlying error cause.
- Recover from transient network failures, request timeouts, HTTP 429, and HTTP 5xx responses with bounded exponential backoff.
- Apply one consistent fetch policy to the PBOC and NBS ingestion CLIs.
- Preserve current publication discovery, parsing, methodology checks, historical overlap checks, atomic multi-dataset behavior, and no-change writes.
- Keep the official PBOC endpoint and source provenance unchanged unless live verification demonstrates that the endpoint has moved.

## Non-goals

- Changing the M0/M1/M2 dataset schema, values, or calculation semantics.
- Retrying parser, methodology, validation, or historical-overlap failures.
- Adding a third-party retry dependency.
- Changing the GitHub Actions schedule or pull-request creation workflow.

## Design

Add a small `scripts/ingest/fetch-text.ts` module with a dependency-injected fetch implementation and these responsibilities:

1. Issue a GET request with the existing MacroLens user-agent.
2. Enforce a finite timeout using an abort controller and a timer that is cleared after each request.
3. Retry only transient transport errors, timeouts, HTTP 429, and HTTP 5xx responses. Use a small fixed attempt limit and exponential delays so a scheduled run remains bounded.
4. Throw an error that includes the URL, final attempt count, status when present, and the original error as `cause` for transport failures.
5. Return response text only after an OK response; parsing remains in the caller, so parser errors cannot enter the retry loop.

`scripts/ingest/money-supply-cli.ts` and `scripts/ingest/cli.ts` will call this module. The public fetch helper will accept optional policy and dependency overrides so tests can use deterministic fake responses and a fake sleep function without waiting or accessing the network.

## Error and retry policy

- Retryable HTTP responses: `429` and `500–599`.
- Non-retryable HTTP responses: other non-2xx statuses.
- Retryable thrown errors: transport failures and abort/timeout failures.
- Backoff: exponential delay per retry, capped by the configured policy.
- If all attempts fail, report the last failure while retaining the first transport cause where applicable.
- Do not retry response body reads after an accepted response; a body-read failure is reported as a fetch failure for that URL.

## Testing

Extend the ingestion tests with deterministic cases for:

- an immediate successful response;
- a transient transport failure followed by success;
- a retryable HTTP response followed by success;
- exhausted retries exposing URL, attempt count, status, and cause;
- timeout/abort behavior;
- a non-retryable HTTP response making one request only.

Run the existing full ingestion and site checks, then run the PBOC CLI against the checked-in fixtures to verify that data normalization and idempotent/no-change behavior remain unchanged. Finally run one live PBOC ingestion command against a temporary target directory; this is operational verification only and must not modify tracked datasets.

## Acceptance mapping

- Fetch diagnostics: covered by the shared error type and exhausted-retry tests.
- Network resilience: covered by transport, timeout, HTTP retry, and backoff tests.
- Source stability: covered by the live PBOC command and unchanged official URL/provenance.
- Safety model: covered by the existing PBOC regression tests, including historical mismatch atomicity and idempotency.
