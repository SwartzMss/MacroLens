# External Balance-Sheet Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five external balance-sheet concepts and six BPM6 accounting-semantic graph relations for Issue #28.

**Architecture:** Extend the existing `external` concept collection and `macro.json` graph without changing prior external pages. Use TDD contract tests to enforce point-in-time stock versus period flow, valuation/other-volume changes, official-source provenance, and no causal accounting edges.

**Tech Stack:** Astro Markdown content collections, TypeScript category registry (unchanged), JSON graph data, Node 20 test runner with `tsx`, npm check/build.

---

### Task 1: Define failing content and relation contracts

**Files:**
- Create: `tests/external-stocks-content.test.mjs`
- Create: `tests/external-stocks-relations.test.mjs`

- [ ] **Step 1: Write content contract**

  Assert five IDs use `category: external`, `graph: macro`, exact stable metadata/orders 6–10, valid related IDs, no chart, SAFE/IMF URLs, and required terms: IIP point-in-time stock versus BOP transaction flow plus valuation/other-volume changes; external-debt gross/debtor/sector/maturity and government-debt/FX-debt/net-position distinctions with original/remaining maturity; BPM6 reserve-assets, FX reserves, monetary gold, SDR, IMF reserve position and no duplication; capital transfers/nonproduced nonfinancial assets and financial-account distinction; external assets minus liabilities, NIIP definition and not national wealth. Run `node --import tsx tests/external-stocks-content.test.mjs`; expect missing-page failures.

- [ ] **Step 2: Write relation contract**

  Assert five indicator nodes, abstract `external-financial-position` and `external-liabilities` without pages, unique nodes/triples, and exactly: capital-account→balance-of-payments COMPONENT_OF; international-investment-position→external-financial-position MEASURES; external-debt→external-liabilities COMPONENT_OF; reserve-assets→international-investment-position COMPONENT_OF; foreign-exchange-reserves→reserve-assets COMPONENT_OF; net-foreign-assets→international-investment-position DERIVED_FROM. Assert no cluster CAUSES. Run `node --import tsx tests/external-stocks-relations.test.mjs`; expect missing-node failures.

- [ ] **Step 3: Commit tests**

  `git add tests/external-stocks-content.test.mjs tests/external-stocks-relations.test.mjs && git commit -m "test: define external balance-sheet contracts"`

### Task 2: Add five external concepts

**Files:**
- Create: `src/content/concepts/international-investment-position.md`
- Create: `src/content/concepts/external-debt.md`
- Create: `src/content/concepts/reserve-assets.md`
- Create: `src/content/concepts/capital-account.md`
- Create: `src/content/concepts/net-foreign-assets.md`

- [ ] **Step 1: Write IIP and external-debt pages**

  Use `external` metadata and `updatedAt: 2026-08-31`. Cite SAFE/IMF primary methodology. Explain IIP as end-period assets/liabilities and reconcile changes using transactions, valuation, and other-volume changes. Explain external debt as gross debt liabilities by sector and maturity where available; explicitly separate it from government debt, FX debt, total liabilities, net position, original maturity, and remaining maturity.

- [ ] **Step 2: Write reserve-assets and capital-account pages**

  Explain the broader BPM6 reserve-assets category and its FX-reserve, monetary-gold, SDR-holding, and IMF-reserve-position components; distinguish it from the existing `foreign-exchange-reserves` page. Explain capital transfers and acquisition/disposal of nonproduced nonfinancial assets, its small scale, and why it is not the financial account.

- [ ] **Step 3: Write net-foreign-assets page**

  Define external assets minus external liabilities and relate NIIP/net IIP terminology to the cited source. Explain sign interpretation and why net foreign assets are not a direct measure of national wealth.

- [ ] **Step 4: Run content tests and commit**

  Run `node --import tsx tests/external-stocks-content.test.mjs` and `npm run check`; expect all focused tests and zero diagnostics. Commit with `git add src/content/concepts/*.md && git commit -m "feat: add external balance-sheet concepts"`.

### Task 3: Add accounting graph nodes and relations

**Files:**
- Modify: `data/relations/macro.json`

- [ ] **Step 1: Register nodes**

  Add five indicator nodes with page labels and abstract nodes `external-financial-position` (`对外金融头寸`) and `external-liabilities` (`对外负债`). Keep abstract nodes without `kind` and without concept pages.

- [ ] **Step 2: Register six relations**

  Add only the six approved relations from Task 1. Preserve existing edges and do not encode any stock-flow relation as `CAUSES`.

- [ ] **Step 3: Run tests and commit**

  Run `node --import tsx tests/external-stocks-relations.test.mjs` and `npm test`; expect all tests to pass. Commit with `git add data/relations/macro.json && git commit -m "feat: connect external balance-sheet relations"`.

### Task 4: Verify, review, and create PR

**Files:**
- Verify only; no additional production files expected.

- [ ] **Step 1: Full verification**

  Run Node 20 `tests/*.test.mjs`, `npm run check`, `npm run build`, and `git diff --check origin/main...HEAD`. Confirm zero failures/diagnostics and five new routes.

- [ ] **Step 2: Independent review**

  Review against Issue #28/spec. Fix Critical or Important findings with a regression test, rerun all verification, and document any accepted Minor note in the PR.

- [ ] **Step 3: Push and open PR**

  Push `codex/issue-28-external-stocks`, create `Build external balance-sheet foundation`, include verification evidence and `Closes #28`, and preserve the worktree.
