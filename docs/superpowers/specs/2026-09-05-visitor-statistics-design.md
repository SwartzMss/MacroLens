# Visitor Statistics Design

## Goal

Add optional website visitor statistics backed by Cloudflare Analytics Engine. The site will display cumulative unique visitors and today's unique visitors, where each visitor is identified only by an anonymous cookie.

## Scope and semantics

- Only HTML `GET` responses are eligible for visitor recording.
- A visitor is identified by a random `visitor_id` stored in an `HttpOnly; Secure; SameSite=Lax` cookie.
- The implementation does not collect IP addresses, user-agent strings, or page-view metrics.
- “Cumulative visitors” means unique visitors in the data retained by the Analytics Engine dataset. It is not a permanent all-time historical total because Analytics Engine retention is limited.
- “Today's visitors” uses the `Asia/Shanghai` calendar date.
- Visitor statistics are optional. Missing bindings, missing query credentials, API failures, or malformed responses must not make the site page request fail and must cause the footer statistics to remain hidden.

## Architecture

### Collection middleware

Create a root Pages Function middleware at `functions/_middleware.ts`. It calls `next()` first, then checks the request and response:

1. The request method must be `GET`.
2. The request `Accept` header must include `text/html`.
3. The downstream response `Content-Type` must begin with `text/html`.

Only when all three conditions pass does the middleware create or reuse the anonymous visitor cookie and write one Analytics Engine data point. It returns the downstream response unchanged when the Analytics binding is missing or the write operation throws. When a new cookie is needed, it clones the response so the `Set-Cookie` header can be added without changing the HTML body or status.

### Analytics Engine data model

The binding name is `ANALYTICS` and the dataset name is `macrolens_visitors`.

Each eligible HTML response writes:

```text
blob1: visitor_id
blob2: Shanghai date (YYYY-MM-DD)
index1: macrolens
```

No IP, user-agent, path, referrer, or page-view count is written. The `index1` value is a fixed dataset sampling key, not the visitor identity. Queries deduplicate with `COUNT(DISTINCT blob1)` as required by the data model.

### Statistics API

Create `functions/api/visitor-stats.ts` with a `GET` handler. It queries the Cloudflare Analytics Engine SQL API using server-side `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` values. The API token is never sent to the browser.

The handler runs one query that returns two rows:

```sql
SELECT 'total' AS metric, count(DISTINCT blob1) AS visitors
FROM macrolens_visitors
UNION ALL
SELECT 'today' AS metric, count(DISTINCT blob1) AS visitors
FROM macrolens_visitors
WHERE blob2 = '<Shanghai date>'
```

The handler validates the response shape and converts numeric strings to non-negative integers. A successful response is:

```json
{"available":true,"total":123,"today":4}
```

Configuration or query failures return a non-throwing unavailable response:

```json
{"available":false}
```

The endpoint is read-only and sends `Cache-Control: no-store` so the displayed count is not cached across users.

### Footer display

Create a small `src/components/VisitorStats.astro` component and render it from `BaseLayout.astro`. The component renders hidden, accessible placeholders and fetches `/api/visitor-stats` after the page is available. It reveals the statistics only for a valid `available: true` response; network errors, non-OK responses, unavailable responses, and invalid values leave it hidden.

Add focused styles in `src/styles/global.css` next to the existing footer rules. The statistics must remain visually secondary and must not affect page layout when unavailable.

## Configuration and documentation

Add `wrangler.toml` with the Analytics Engine dataset binding:

```toml
name = "macrolens"
compatibility_date = "2026-09-05"

[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "macrolens_visitors"
```

Update `README.md` with the Pages deployment requirements:

- bind `ANALYTICS` to the `macrolens_visitors` dataset;
- configure `CLOUDFLARE_ACCOUNT_ID` as a Pages Function variable;
- configure `CLOUDFLARE_API_TOKEN` as a Pages Function secret with Account Analytics Read permission;
- explain that cumulative visitors are unique visitors within Analytics Engine's retention period, not permanent historical cumulative visitors;
- explain that collection intentionally excludes IP, user-agent, and page-view data.

## Testing

Add unit tests for the pure visitor helpers and handler behavior using mocked Pages Function contexts and `fetch`:

- HTML `GET` records exactly once and sets the required cookie when absent.
- Existing valid cookies are reused; no new `Set-Cookie` header is added.
- non-GET, non-HTML requests, and non-HTML responses do not write data points.
- the Analytics data point uses `blob1` for the visitor ID, `blob2` for Shanghai date, and `index1: macrolens`.
- the stats handler posts the distinct-`blob1` query, parses valid rows, and returns total/today counts.
- missing configuration, failed fetches, malformed responses, and negative/non-integer counts return `available: false` without throwing.
- the existing project test suite, `astro check`, and production build continue to pass.
