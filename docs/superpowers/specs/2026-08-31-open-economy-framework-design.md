# Open-Economy Framework Design

## Scope

Issue #29 adds a compact China-focused open-economy framework using the existing `exchange` and `external` categories. It adds five concepts and no charts, keeping institutional rules, no-arbitrage pricing, and empirical exchange-rate behavior distinct.

## Concepts

- `capital-controls`: explain capital-flow management as a spectrum of rules, distinguishing current-account convertibility, capital-account convertibility, macroprudential tools, and administrative restrictions.
- `impossible-trinity`: present monetary-policy autonomy, exchange-rate stability, and capital mobility as degrees of a policy trade-off, contextualized by China's managed float and capital-flow management without claiming a fixed corner.
- `interest-rate-parity`: separate CIP no-arbitrage forward pricing from UIP's empirical expected-exchange-rate relationship; UIP is not a guaranteed short-run forecast.
- `usd-cnh`: create the standalone offshore RMB page; distinguish CNH from onshore CNY by market access, hours, liquidity, and temporary spreads, while stating CNH is not a separate currency.
- `carry-trade`: explain borrowing in a lower-yielding currency and investing in a higher-yielding asset, separating hedged/unhedged positions and carrying FX, funding, and tail risk.

Pages use stable metadata, primary or methodological sources, and no `chart` frontmatter.

## Graph

Register indicator nodes for the five concepts and abstract nodes `open-economy-policy-tradeoffs` and `cross-currency-pricing-relations`. Add only:

- `capital-controls --AFFECTS--> cross-border-capital-flows`
- `capital-controls --AFFECTS--> exchange-rate-formation`
- `impossible-trinity --REFLECTS--> open-economy-policy-tradeoffs`
- `interest-rate-parity --REFLECTS--> cross-currency-pricing-relations`
- `usd-cnh --CORRELATES--> usd-cny`
- `carry-trade --AFFECTS--> cross-border-capital-flows`
- `carry-trade --AFFECTS--> exchange-rate`

Framework nodes remain abstract and no deterministic causal claims such as “house prices fall, therefore consumption falls” are added.

## Testing and verification

Add content and relation contract tests. Content tests enforce category/order, source URLs, CIP/UIP separation, non-binary policy language, CNY/CNH distinction, risk coverage, related IDs, and no charts. Relation tests enforce unique nodes/triples, abstract-node behavior, exact approved relation set, and no cluster `CAUSES`. Run Node 20 tests, `npm run check`, `npm run build`, and `git diff --check`.

## Sources

Prefer PBOC/SAFE/CFETS for China’s institutional and RMB-market context, IMF institutional-view material where useful, and BIS or equivalent methodological sources for CIP/UIP.
