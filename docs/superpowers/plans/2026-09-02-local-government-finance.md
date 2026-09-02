# Local Government Finance Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a China-focused local-government finance, statutory debt, special-bond, land-transfer revenue, and LGFV concept cluster with tested accounting and legal boundaries.

**Architecture:** Add five fiscal concept pages and one topic entry, then register the concepts and three abstract graph nodes in the existing macro graph. Keep LGFV liabilities separate from official local-government debt and use only cautious directional or structural relations. Add focused content and graph regression tests before implementing the pages and data.

**Tech Stack:** Astro content collections, Markdown frontmatter, TypeScript graph registry, Node.js `node:test`, npm.

---

### Task 1: Define regression contracts

**Files:**
- Create: `tests/local-government-finance-content.test.mjs`
- Create: `tests/local-government-finance-relations.test.mjs`

- [ ] **Step 1: Write the failing content and graph tests**

Test the five expected pages, metadata, prerequisite order, official source URLs, budget/debt/LGFV boundaries, approved graph nodes, and exact relation set. Include negative assertions that the content does not equate LGFV debt with official local-government debt and that the graph has no `CAUSES` relation in this cluster.

- [ ] **Step 2: Run the focused tests and verify the expected failure**

Run: `node --import tsx tests/local-government-finance-content.test.mjs tests/local-government-finance-relations.test.mjs`

Expected: FAIL because the five pages, topic entry, abstract nodes, and relations do not yet exist.

### Task 2: Add the local-government finance topic and concept pages

**Files:**
- Modify: `src/data/topics.ts`
- Create: `src/content/concepts/local-government-finance.md`
- Create: `src/content/concepts/local-government-debt.md`
- Create: `src/content/concepts/local-government-special-bonds.md`
- Create: `src/content/concepts/land-transfer-revenue.md`
- Create: `src/content/concepts/lgfv.md`

- [ ] **Step 1: Register the topic**

Add `local-government-finance` after `fiscal-policy` with fiscal category metadata and a description covering local budgets, statutory debt, land revenue, and LGFVs.

- [ ] **Step 2: Add the five pages with stable prerequisites**

Use `country: CN`, `category: fiscal`, `graph: macro`, `updatedAt: 2026-09-02`, `featured: false`, `level: basic|advanced`, and `topics: [local-government-finance]`. Use prerequisites exactly as follows:

```text
local-government-finance: [fiscal-policy]
local-government-debt: [local-government-finance]
local-government-special-bonds: [local-government-debt]
land-transfer-revenue: [local-government-finance]
lgfv: [local-government-finance]
```

Each page must explain its own object before discussing interactions, cite the official sources listed in the design, and explicitly preserve the budget, legal-entity, stock-flow, and statistical boundaries from the specification.

- [ ] **Step 3: Run the focused content tests**

Run: `node --import tsx tests/local-government-finance-content.test.mjs`

Expected: PASS.

### Task 3: Add graph nodes and non-deterministic relations

**Files:**
- Modify: `data/relations/macro.json`

- [ ] **Step 1: Register five concept nodes and three abstract nodes**

Register the five concept IDs with their Chinese labels and no `kind: indicator`; register `local-fiscal-space`, `market-financing`, and `local-fiscal-and-investment-conditions` as abstract nodes without concept pages.

- [ ] **Step 2: Add only the approved relations**

Add these exact relation triples:

```text
local-government-finance --COMPONENT_OF--> fiscal-conditions
land-market --AFFECTS--> land-transfer-revenue
land-transfer-revenue --AFFECTS--> local-government-finance
local-government-debt --AFFECTS--> local-fiscal-space
local-government-special-bonds --COMPONENT_OF--> local-government-debt
lgfv --USES--> market-financing
lgfv --CORRELATES--> local-fiscal-and-investment-conditions
```

Do not add LGFV debt as a component of local-government debt, land-sale mechanics, or an automatic GDP effect.

- [ ] **Step 3: Run the focused graph tests**

Run: `node --import tsx tests/local-government-finance-relations.test.mjs`

Expected: PASS.

### Task 4: Run complete verification and inspect the diff

**Files:**
- Modify: none beyond Tasks 1–3.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run Astro validation and build**

Run: `npm run check && npm run build`

Expected: Astro reports zero errors, warnings, and hints; static build and Pagefind complete successfully.

- [ ] **Step 3: Check formatting and repository state**

Run: `git diff --check && git status --short`

Expected: no whitespace errors and only the intended topic, concept, graph, test, spec, and plan files are changed.

- [ ] **Step 4: Commit the implementation**

```bash
git add src/data/topics.ts src/content/concepts data/relations/macro.json tests/local-government-finance-content.test.mjs tests/local-government-finance-relations.test.mjs docs/superpowers/specs/2026-09-02-local-government-finance-design.md docs/superpowers/plans/2026-09-02-local-government-finance.md
git commit -m "feat: add local government finance framework"
```

### Task 5: Push and create the pull request

- [ ] **Step 1: Push the feature branch**

Run: `git push -u origin codex/issue-43-local-government-finance`

- [ ] **Step 2: Create the PR linked to Issue #43**

Use title `feat: add local government finance framework` and body:

```markdown
## Summary

- Add five China-focused concepts covering local finance, statutory local-government debt, special bonds, land-transfer revenue, and LGFVs.
- Distinguish general public budget, government-managed funds, official debt, corporate LGFV liabilities, and stock/flow measures.
- Add cautious graph relations and regression contracts for the legal/accounting boundaries.

Closes #43

## Test plan

- `npm test`
- `npm run check`
- `npm run build`
```

