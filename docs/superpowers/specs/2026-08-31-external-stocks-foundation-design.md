# External Balance-Sheet Foundation Design

## Scope

Issue #28 adds the second external-sector batch: point-in-time external stocks and balance-sheet concepts, without adding charts or expanding into company-level external vulnerability analysis. It uses the `external` category already established by Issue #23.

## Concepts

- `international-investment-position`: define IIP as residents' external financial assets and liabilities at a point in time; separate transactions, valuation changes, and other-volume changes, and distinguish IIP from BOP flows.
- `external-debt`: explain gross external debt by debtor/sector/maturity where official data permits; separate it from government debt, foreign-currency debt, total foreign liabilities, and net foreign position; state original versus remaining maturity conventions.
- `reserve-assets`: explain the BPM6 reserve-assets category, including foreign-exchange reserves, monetary gold, SDR holdings, and IMF reserve position where applicable; distinguish the broader category from the existing foreign-exchange-reserves page.
- `capital-account`: create the standalone BPM6 capital-account page for capital transfers and acquisition/disposal of nonproduced nonfinancial assets; distinguish it from the financial account and note its usually small scale.
- `net-foreign-assets`: define external assets minus external liabilities and state the exact NIIP/net-IIP relationship used; do not present it as direct national wealth.

All five pages use `category: external`, `graph: macro`, stable related IDs, SAFE/IMF primary methodology sources, and no `chart` frontmatter.

## Graph

Register five indicator nodes plus abstract nodes `external-financial-position` and `external-liabilities`. Add only these accounting-semantic relations:

- `capital-account --COMPONENT_OF--> balance-of-payments`
- `international-investment-position --MEASURES--> external-financial-position`
- `external-debt --COMPONENT_OF--> external-liabilities`
- `reserve-assets --COMPONENT_OF--> international-investment-position`
- `foreign-exchange-reserves --COMPONENT_OF--> reserve-assets`
- `net-foreign-assets --DERIVED_FROM--> international-investment-position`

Do not encode stock-flow accounting as causal relationships.

## Testing and verification

Add content and relation contract tests. Content tests assert exact frontmatter, required stock/flow/valuation and category-boundary language, authoritative source URLs, valid related IDs, and absence of charts. Relation tests assert unique nodes/triples, endpoint validity, abstract-node behavior, approved relation set, and no external-stocks `CAUSES` edges. Run the full Node 20 test suite, `npm run check`, `npm run build`, and `git diff --check`.

## Sources

Prefer SAFE and IMF BPM6 / External Debt Statistics methodology. Use PBOC only when a specific official series originates there. Cite primary release or methodology URLs directly in each page.
