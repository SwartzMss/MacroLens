# GDP Release HTML Text Normalization Design

## Goal

Make GDP methodology and quarterly-table detection robust to official HTML that splits visible phrases across nested tags, while preserving the existing GDP statistical contract.

## Scope

Only `parseNbsGdpPublication()` and its deterministic tests change. The parser will continue to require the same title, GDP year-on-year table, percent unit, constant-price treatment, year-on-year definition, quarter headers, and numeric observations.

## Design

The parser already has `textOf()`, which removes HTML tags, decodes the supported entities, and normalizes whitespace. Use it as the single visible-text boundary:

```text
raw release HTML -> textOf(...) -> canonical(...) -> contract checks
```

Use `canonical(textOf(html))` for page-level methodology checks. When selecting a candidate `<table>`, use `canonical(textOf(tableHtml))` for the table text and `canonical(textOf(precedingHtml))` for the nearby text before it. Keep row and cell extraction unchanged because `cellsOf()` already uses `textOf()` and `canonical()`.

## Failure behavior

The existing `MethodologyMismatchError` remains the response when required visible methodology text is absent. The existing contract errors remain for a missing GDP YoY table, missing quarter headers, unexpected columns, or missing observations. No checks are removed or broadened beyond visible-text normalization.

## Testing

Add an offline regression fixture/test whose required methodology phrases and GDP YoY table labels are split across elements such as `<span>GDP</span><span>同比增长速度</span>`. Assert that the correct quarterly observations are still returned. Retain and run the existing tests for a level-only page, missing methodology metadata, and malformed table structure to prove the contract remains strict.

