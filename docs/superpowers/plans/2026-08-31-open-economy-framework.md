# Open-Economy Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five China-focused open-economy concepts and their approved graph relations for Issue #29, with regression contracts wired into the existing Node 20 validation flow.

**Architecture:** Keep the existing Astro content-collection model and `exchange`/`external` categories. Each concept gets a focused Markdown page with institutional or methodological provenance; graph nodes and triples are registered centrally in `data/relations/macro.json`. Two Node test files validate frontmatter, semantics, and the exact relation allow-list without adding charts or causal claims.

**Tech Stack:** Astro content collections, Markdown frontmatter, JSON graph data, Node 20 test runner with `tsx`, npm scripts, Astro check/build.

---

### Task 1: Add failing content and relation contracts

**Files:**
- Create: `tests/open-economy-content.test.mjs`
- Create: `tests/open-economy-relations.test.mjs`

- [ ] **Step 1: Write the content contract**

Import the concept collection through `../src/data/categories.ts` and read the five Markdown files. Assert stable IDs, categories/orders (`capital-controls` external/11; `impossible-trinity` exchange/6; `interest-rate-parity` exchange/7; `usd-cnh` exchange/8; `carry-trade` exchange/9), non-empty source URLs, no `chart` frontmatter, and related IDs that resolve. Assert text contains the required distinctions: current vs capital account and macroprudential vs administrative controls; trinity degrees and China managed float; CIP no-arbitrage forward pricing vs UIP empirical/non-guaranteed forecasting; CNH offshore access/hours/liquidity/spreads and not a separate currency; carry borrowing/investment plus FX, funding, tail, hedged and unhedged risk.

- [ ] **Step 2: Write the relation contract**

Load `data/relations/macro.json`, assert each of the five indicator nodes and two abstract nodes exists, every node ID is unique, and the only new triples are the seven approved triples from the spec. Assert triples are unique, abstract nodes have no concept page, and no new triple uses `CAUSES`.

- [ ] **Step 3: Run the contracts and verify the expected failure**

Run `node --import tsx --test tests/open-economy-content.test.mjs tests/open-economy-relations.test.mjs`. Expected: FAIL because the five pages and seven graph relations do not yet exist.

- [ ] **Step 4: Commit the red tests**

```bash
git add tests/open-economy-content.test.mjs tests/open-economy-relations.test.mjs
git commit -m "test: define open economy content and relation contracts"
```

### Task 2: Create the five concept pages

**Files:**
- Create: `src/content/concepts/capital-controls.md`
- Create: `src/content/concepts/impossible-trinity.md`
- Create: `src/content/concepts/interest-rate-parity.md`
- Create: `src/content/concepts/usd-cnh.md`
- Create: `src/content/concepts/carry-trade.md`

- [ ] **Step 1: Add complete frontmatter and sourced content**

Use the exact IDs/categories/orders from Task 1, stable `related` IDs, and primary or methodological source URLs (PBOC/SAFE/CFETS, IMF, BIS). Write concise Chinese sections matching the contract. In particular, describe controls as a spectrum; trinity vertices as degrees rather than a binary corner selection; CIP as the covered no-arbitrage forward relation and UIP as an empirical expected-rate relation; CNH as offshore RMB rather than a separate currency; and carry as a risky, potentially hedged or unhedged return differential. Do not add chart frontmatter.

- [ ] **Step 2: Run the content contract**

Run `node --import tsx --test tests/open-economy-content.test.mjs`. Expected: PASS for all five pages.

- [ ] **Step 3: Commit the concept pages**

```bash
git add src/content/concepts/capital-controls.md src/content/concepts/impossible-trinity.md src/content/concepts/interest-rate-parity.md src/content/concepts/usd-cnh.md src/content/concepts/carry-trade.md
git commit -m "feat: add open economy framework concepts"
```

### Task 3: Register the approved graph model

**Files:**
- Modify: `data/relations/macro.json`

- [ ] **Step 1: Add indicator and abstract nodes**

Add nodes for `capital-controls`, `impossible-trinity`, `interest-rate-parity`, `usd-cnh`, `carry-trade`, `open-economy-policy-tradeoffs`, and `cross-currency-pricing-relations`, preserving the file’s existing node shape and marking only the last two as abstract.

- [ ] **Step 2: Add exactly the seven approved relations**

Append these directed triples, using the existing relation labels: `capital-controls AFFECTS cross-border-capital-flows`; `capital-controls AFFECTS exchange-rate-formation`; `impossible-trinity REFLECTS open-economy-policy-tradeoffs`; `interest-rate-parity REFLECTS cross-currency-pricing-relations`; `usd-cnh CORRELATES usd-cny`; `carry-trade AFFECTS cross-border-capital-flows`; `carry-trade AFFECTS exchange-rate`. Do not add deterministic `CAUSES` edges.

- [ ] **Step 3: Run relation and full validation**

Run `node --import tsx --test tests/open-economy-relations.test.mjs`, then `npm run check` and `npm run build`. Expected: relation contract passes, Astro reports zero diagnostics, and the production build completes with Pagefind output.

- [ ] **Step 4: Commit graph changes**

```bash
git add data/relations/macro.json
git commit -m "feat: connect open economy framework relations"
```

### Task 4: Review, verify, and prepare the pull request

**Files:**
- Modify only if review finds a concrete defect in the five pages, tests, or graph JSON.

- [ ] **Step 1: Run the complete verification suite**

Run `node --import tsx --test tests/*.test.mjs && npm run check && npm run build && git diff --check origin/main...HEAD`. Expected: all tests pass, Astro has no diagnostics, build succeeds, and diff check is clean.

- [ ] **Step 2: Inspect the final diff and history**

Run `git diff --stat origin/main...HEAD`, `git diff --check origin/main...HEAD`, and `git log --oneline origin/main..HEAD`. Confirm no unrelated files, no charts, no extra relations, and no placeholder text.

- [ ] **Step 3: Commit any review correction**

If and only if a concrete defect is found, amend it with a focused commit and rerun Step 1; otherwise leave the three focused commits intact.

- [ ] **Step 4: Push and create the PR**

Push `codex/issue-29-open-economy` to origin and create a PR targeting `main` with title `feat: build open-economy framework (#29)`, body linking `Closes #29`, summarizing the five concepts, seven relations, and verification commands.
