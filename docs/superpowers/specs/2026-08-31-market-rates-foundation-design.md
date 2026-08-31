# Market-Rates Foundation Design

## Goal

Create MacroLens's first coherent market-rates cluster so readers can distinguish central-bank policy anchors from market funding rates, bond yields, real rates, and credit spreads.

## Scope

The change adds a `markets` category and these stable concept IDs:

- `interbank-rate`
- `government-bond-yield`
- `yield-curve`
- `real-interest-rate`
- `credit-spread`

The pages will not include charts. This keeps the batch focused on definitions and interpretation until each potential series has an explicit provider, frequency, transaction or valuation basis, maturity convention, and update process.

The change will not add equity valuation, stock indexes, options or implied volatility, swap curves, repo microstructure, corporate default statistics, or a market-data ingestion pipeline.

## Architecture

The implementation uses the existing Astro content architecture:

- Extend `src/data/categories.ts` with `markets`, ordered after `labor` with order 90.
- Add five Markdown entries under `src/content/concepts/` using the current schema.
- Extend `data/relations/macro.json` with five concept nodes, two abstract nodes, and seven typed relationships.
- Leave the indicator registry, chart component, routes, and other UI components unchanged.
- Add focused Node contract tests. The existing `npm test` glob will execute them in Node 20 CI.

## Content Design

### Interbank funding rates

`interbank-rate` will distinguish the People's Bank of China's 7-day reverse-repurchase operation rate from transaction-based market rates. It will explain that DR007 covers seven-day pledged repo transactions between depository institutions using rate bonds as collateral, while R007 has broader participant and collateral scope. Differences may reflect participant mix, collateral, liquidity demand, and risk premiums. Neither rate will be described as mechanically identical to a policy operation rate.

### Government-bond yields

`government-bond-yield` will distinguish coupon rate, issuance yield, secondary-market price, and yield to maturity. It will explain the inverse price-yield relationship, maturity and remaining maturity, basis-point changes, and why a published curve point may be an evaluated or fitted reference rather than the last trade of one bond.

### Yield curves

`yield-curve` will describe term structure across comparable maturities and distinguish yield-to-maturity, spot, and forward curves. It will explain steepening, flattening, and inversion without treating any shape as a deterministic forecast. Expected future short rates, term premium, liquidity, bond supply and demand, market segmentation, and curve-construction methodology will all remain explicit contributors.

### Real interest rates

`real-interest-rate` will distinguish ex-ante real rates, based on expected inflation over a matching horizon, from ex-post real rates, based on realized inflation. The simple difference between a nominal rate and current CPI inflation will be labeled as an approximation whose meaning depends on the nominal instrument, inflation measure, horizon, annualization, and expectation convention.

### Credit spreads

`credit-spread` will define a yield spread over an explicit benchmark with comparable maturity or duration. It will distinguish government, policy-bank, financial, and corporate curves and explain that spreads may reflect expected credit loss, liquidity, risk appetite, embedded options, tax or regulatory treatment, issuance supply, and technical factors. A spread change will not be equated one-for-one with default risk.

## Sources and Provenance

Primary and authoritative sources take precedence:

- People's Bank of China for the policy-rate framework and financial-market context.
- China Foreign Exchange Trade System / National Interbank Funding Center for DR, R, and repo benchmark definitions.
- Ministry of Finance and China Central Depository & Clearing for government-bond yield curves, benchmark maturities, inputs, and construction methodology.
- Official methodology documents for curve and valuation definitions.

The content will cite the specific methodology page used. It will not combine values from incompatible curve providers or imply that similarly named curve points share identical construction rules.

## Relationship Design

The graph adds these linking concept nodes:

- `interbank-rate`
- `government-bond-yield`
- `yield-curve`
- `real-interest-rate`
- `credit-spread`

It also adds two abstract, non-linking nodes:

- `rate-expectations-and-term-premium`
- `credit-risk-and-risk-appetite`

Canonical relationships:

```text
policy-rate --AFFECTS--> interbank-rate
interbank-rate --AFFECTS--> financing-conditions
government-bond-yield --REFLECTS--> financing-conditions
yield-curve --REFLECTS--> rate-expectations-and-term-premium
real-interest-rate --AFFECTS--> economic-activity
credit-spread --REFLECTS--> credit-risk-and-risk-appetite
credit-spread --AFFECTS--> financing-conditions
```

The graph will add no `CAUSES` relation for these nodes. It will not encode curve inversion as a deterministic cause or guarantee of recession, nor a spread widening as proof of a specific default outcome.

## Data Flow and Rendering

Astro's content collection validates the new entries against the category union. The concept index groups them under `markets`; stable IDs create their routes and related links; the existing graph registry supplies relationship cards; and Pagefind indexes the rendered pages during the production build. Because no page declares chart frontmatter, no indicator registry lookup or market-data fetch occurs.

## Validation and Failure Handling

`tests/market-rates-content.test.mjs` will enforce:

- category order and metadata;
- exact stable frontmatter for all five pages;
- no chart frontmatter;
- valid related IDs;
- the policy-versus-market distinction;
- DR007/R007 scope differences;
- coupon, price, issuance, and yield distinctions;
- non-deterministic curve interpretation;
- ex-ante/ex-post real-rate conventions;
- credit-spread benchmark and maturity comparability;
- authoritative source links.

`tests/market-rates-relations.test.mjs` will enforce unique graph nodes and relation triples, valid endpoints and relation types, the exact seven canonical relationships, non-linking abstract nodes, and absence of unsupported `CAUSES` relations.

Full verification will run:

```text
npm test
npm run check
npm run build
git diff --check
```

The build must generate all five concept routes and include them in Pagefind. Content-schema, missing-related-ID, and graph-contract failures must stop CI rather than degrade silently.

## Acceptance Mapping

This design satisfies issue #25 by adding the category and all five concepts; making policy and market rates distinct; explaining bond coupon, price, issuance, yield, curve, real-rate, and spread conventions; preserving conditional rather than deterministic interpretation; using official or authoritative sources; keeping relationship direction explicit; and retaining the existing content, relationship, search, and CI architecture without premature chart integration.
