# Housing Foundation Design

## Scope

Issue #27 adds a focused China housing/real-estate macro cluster without turning MacroLens into a property-company database. The change adds a `housing` category and five foundational concept pages, with no new charts.

## Concepts

- `real-estate-investment`: explain National Bureau of Statistics real-estate development investment scope, cumulative versus monthly semantics, and why nominal investment growth is not direct real construction volume.
- `property-sales`: separate floor area, sales value, implied average price, and contract sales; explain cumulative statistics and base effects; do not mix primary new-home sales with secondary transactions.
- `house-price-index`: explain official 70-city price indexes, month-on-month versus year-on-year changes, new versus second-hand homes, and why city indexes are not a national transaction-price average.
- `mortgage`: distinguish mortgage rates, outstanding mortgage stock, new mortgage lending, repayments, LPR pricing, and general household-loan growth.
- `land-market`: distinguish land conveyance, land-transfer revenue, transaction value, real-estate investment, and the government-fund-budget boundary; land-transfer revenue must remain outside general public budget revenue and link conceptually to `fiscal-revenue`.

All five pages use `category: housing`, `graph: macro`, stable related IDs, official primary sources, and no `chart` frontmatter.

## Graph

Register indicator nodes for the five pages and abstract nodes for housing-market prices and fiscal conditions. Add only these directional, non-deterministic relationships:

- `mortgage --AFFECTS--> property-sales`
- `property-sales --AFFECTS--> real-estate-investment`
- `house-price-index --REFLECTS--> housing-market-prices`
- `real-estate-investment --COMPONENT_OF--> investment-activity`
- `land-market --AFFECTS--> fiscal-conditions`
- `property-sales --AFFECTS--> economic-activity`

Do not encode deterministic claims such as house prices falling causing consumption to fall.

## Testing and verification

Add content and relation contract tests. Content tests assert exact frontmatter, required statistical-boundary language, authoritative source URLs, valid related IDs, and absence of charts. Relation tests assert unique nodes/triples, endpoint validity, approved relation set, abstract-node behavior, and no unapproved housing `CAUSES` edges. Run the complete test suite under Node 20, `npm run check`, `npm run build`, and `git diff --check`.

## Sources

Prefer primary releases and methodology from the National Bureau of Statistics, the People's Bank of China, the Ministry of Finance, and the Ministry of Natural Resources. Where a source has multiple releases, cite the stable official landing or release URL in the concept page.
