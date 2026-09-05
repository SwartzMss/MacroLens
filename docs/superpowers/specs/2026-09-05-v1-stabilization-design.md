# V1 Stabilization and Release Readiness Design

## Goal

Prepare the existing MacroLens V1 implementation for release by removing runtime and dependency risk, validating all registered indicator datasets and provenance, aligning documentation with the shipped product, and preserving automated update invariants.

## Scope

This stabilization remains one PR for issue #79, organized into independent commits:

- standardize CI and release runtime on Node 24;
- upgrade Astro to the first available secure release and regenerate the lockfile;
- add a full registered-indicator contract and provenance consistency audit;
- correct only confirmed stale or mismatched provenance metadata;
- update README and committed release-facing documentation;
- run npm ci, npm audit, tests, check, and build before PR creation.

Out of scope are new indicators, new concept families, dashboard redesign, Snapshot redesign, backend work, runtime browser fetching, and multi-month price catch-up.

## Runtime and dependency design

The canonical CI and macro-data workflow runtime will be Node 24. Cloudflare Pages documentation will use the same production version. .nvmrc will select Node 24, and package.json will declare Node >=22.12.0, which is the minimum supported by the selected Astro release.

Astro will be upgraded to 7.3.1, the first version reported by the current audit as fixing the direct Astro and transitive esbuild/sharp findings. The lockfile will be regenerated deterministically and validated with npm audit, tests, check, and build.

## Dataset audit design

The registered V1 set is the 11 datasets imported by src/data/indicatorRegistry.ts:

- m0, m1, m2, pmi;
- gdp, industrial-production, retail-sales, fixed-asset-investment;
- cpi, core-cpi, ppi.

A deterministic test will load the registry data and assert registry IDs, contract fields, valid dates, ordered and continuous observations, approved official hosts, non-empty coverage, valid roles, no duplicate role and coverage, and coherent source metadata.

## Documentation design

README will describe the current product as a static-first macroeconomic education and exploration site, not an investment-advice product. It will document concepts, topics, the readable relationship explorer, dashboard, Macro Snapshot, official-data ingestion, reviewable data PRs, Node 24, and primary verification commands. Stale Cytoscape/force-graph references will be removed.

## Verification and release invariants

The PR must pass npm ci, npm audit, npm test, npm run check, and npm run build. Workflow invariants remain official-source-only retrieval, explicit parser/methodology/overlap failures, grouped atomic writes, unchanged-data idempotency, reviewable data PRs, and no automatic merge.

Post-merge, manually run the full Update macro data workflow and verify Cloudflare Pages production deployment from main.
