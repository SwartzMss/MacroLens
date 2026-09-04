# NBS Real-Economy Fetch Reliability Design

## Goal

Make the GDP, industrial-production, retail-sales, and fixed-asset-investment ingestion path discover current official NBS publications and route every live NBS HTTP request through the resilient shared `fetchText` utility.

## Scope

This change is limited to the existing real-economy ingestion adapter, its CLI orchestration, and deterministic offline tests/fixtures. It keeps the current four statistical contracts, source provenance rules, normalization behavior, and all-or-nothing dataset writes unchanged. It does not add live-network dependencies to ordinary CI or change unrelated indicators.

## Design

The real-economy fetch adapter will use `https://www.stats.gov.cn/sj/zxfb/` as the sole official publication index. The existing series-specific title matching, date extraction, official-origin checks, and GDP methodology checks remain in place; only the index source and fixture shapes are updated so the current official release pages can be discovered.

All live requests will use `fetchText` from `scripts/ingest/fetch-text.ts`:

- the CLI will fetch the publication index through the shared utility;
- GDP release pages will be fetched through the shared utility;
- National Data EasyQuery responses will be fetched through the shared utility and parsed as JSON;
- real-economy fetch helpers will contain no direct `fetch()` calls or duplicated retry/error handling.

The fetch helper will expose a small publication-index fetch function so the CLI remains orchestration-only and the shared fetch boundary is easy to test statically and behaviorally. Existing parser functions will continue to accept strings/objects directly, preserving fixture mode and parser isolation.

## Error handling

`FetchTextError` remains the single source of timeout, bounded retry/backoff, URL/status/attempt diagnostics, and nested transport-cause reporting. JSON decoding and parser/validation failures remain non-retryable because they occur after the shared fetch operation has completed. Official-only URL validation and all historical overlap/methodology checks remain unchanged.

## Testing

Add or update offline fixtures to represent the `/sj/zxfb/` index and verify GDP, industrial production, retail sales, and fixed-asset-investment discovery from that shape. Add regression coverage that exercises the live-fetch adapter with an injected shared-fetch boundary, confirms National Data responses are decoded after `fetchText`, and confirms transport failures retain shared retry diagnostics. Keep the existing parser, normalizer, provenance, and validation tests green. No test performs a live NBS request.

## Acceptance criteria

- Publication discovery uses only `https://www.stats.gov.cn/sj/zxfb/`.
- All four real-economy publications are found from the current official index shape.
- Publication index, GDP, National Data, and other real-economy requests use `fetchText`.
- GDP, industrial, retail, and fixed-asset-investment semantics and validations are unchanged.
- `npm test`, `npm run check`, and `npm run build` pass.
- A manual workflow can proceed beyond real-economy publication discovery; no direct main-branch data write is introduced.
