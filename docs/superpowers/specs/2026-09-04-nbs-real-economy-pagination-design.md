# NBS Real-Economy Pagination Design

## Goal

Make real-economy publication discovery robust to the official NBS release-index pagination and support official retail half-year publication titles without changing any dataset semantics.

## Scope

This change is limited to the NBS real-economy publication discovery adapter, its live CLI orchestration, and deterministic offline fixtures/tests. It does not change GDP, industrial production, retail-sales, or fixed-asset-investment data contracts, parsers, normalization, methodology checks, provenance checks, historical overlap validation, or atomic writes.

## Design

Keep `/sj/zxfb/` as the official index root. Add a bounded page URL generator for `/sj/zxfb/index.html`, `/sj/zxfb/index_1.html`, and subsequent pages, with a maximum of eight pages. Every page is fetched through the existing shared `fetchText` function.

The adapter will expose one shared scan that fetches each listing page at most once and accumulates candidates for all four dataset IDs. It stops as soon as every required ID has a candidate, then selects the newest candidate by publication date for each ID. If the bounded page budget is exhausted before all IDs are found, it throws an `IngestionContractError` naming the missing IDs and scanned-page count. Existing malformed-date and official-origin checks remain active for every matching anchor.

The CLI will run this scan once before its four-dataset loop and pass the resulting publication map into each loader. Fixture mode remains unchanged, so ordinary tests never access NBS networking and never write live indicator data.

Retail publication coverage parsing will explicitly accept `YYYY年上半年社会消费品零售总额...` and map it to `YYYY-06 to YYYY-06`. Numeric month and Jan–Feb title forms retain their current validation and mappings. The retail dataset remains monthly nominal YoY; the half-year wording describes only the publication anchor.

## Error handling

Pagination is finite and sequential. A fetch failure is propagated as the shared `FetchTextError` with its URL, retry attempts, status, timeout, and transport cause. Parser/validation failures are not hidden or retried by the pagination layer. A missing required publication after the page limit produces a clear contract error.

## Testing

Add separate page-0/page-1 fixtures where recent monthly releases are on page 0 and GDP is only on page 1; include older duplicate matches on page 1. Tests will verify one shared scan, early stop after all IDs resolve, newest-candidate selection, bounded exhaustion, explicit half-year retail coverage, and existing Jan–Feb/negative-growth behavior. Existing parser, normalizer, CLI fixture, workflow, and shared-fetch tests remain green.

## Acceptance criteria

- GDP can be discovered when absent from page 0 but present on page 1.
- One bounded scan serves all four real-economy datasets without duplicate page requests.
- Retail half-year titles map to June publication coverage without changing retail data semantics.
- All listing and publication HTTP continues to use shared `fetchText`.
- `npm test`, `npm run check`, and `npm run build` pass without live NBS networking.
