# Beginner Macroeconomic Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the existing Learning entry into a clear beginner macroeconomic journey while preserving Concept pages, Knowledge Graph data, learning progress, and specialist routes.

**Architecture:** Keep the existing `LearningPath` model and `ConceptReader` flow. Rework only the published foundation route metadata, its chapter grouping, and the `/learn/` entry copy/layout. The eight beginner stages are learning chapters; where no standalone concept is needed, the route uses existing concept pages and plain-language chapter framing rather than adding graph nodes.

**Tech Stack:** Astro 7, TypeScript, Astro content collections, Node test runner, CSS.

---

### Task 1: Add regression coverage for the beginner journey

**Files:**
- Modify: `tests/learning.test.mjs`
- Modify: `tests/information-architecture.test.mjs`

- [ ] **Step 1: Add failing assertions for the foundation route.**

  Assert that the published foundation route remains first, has eight chapters, exposes the eight beginner chapter titles in order, starts with GDP, ends with the recap step, and retains specialist paths. Add source-level assertions that the Learning index contains the beginner journey introduction, recommended-order marker, and specialist-route explanation.

- [ ] **Step 2: Run the focused tests to verify the new assertions fail against the current structure.**

  Run: `node --import tsx --test tests/learning.test.mjs tests/information-architecture.test.mjs`

  Expected: the existing Learning route has different chapter titles/order and the new entry copy is absent.

- [ ] **Step 3: Keep the assertions architecture-focused.**

  Do not assert new Concept IDs or relation data. The tests should verify route ordering, existing concept resolution, and user-facing entry semantics only.

### Task 2: Reorganize the foundation learning route

**Files:**
- Modify: `src/data/learningPaths.ts`

- [ ] **Step 1: Update the foundation route title, description, outcomes, and topic coverage.**

  Position it as the recommended beginner journey. Keep all existing route concepts available, but make the eight-stage narrative explicit.

- [ ] **Step 2: Regroup the existing steps into eight ordered chapters.**

  Use these chapter titles and existing step IDs:

  1. `经济是什么` — GDP, retail sales
  2. `钱与银行` — M0, M1, M2
  3. `信用如何创造` — credit
  4. `利率与货币政策` — monetary-policy, policy-rate, LPR
  5. `什么是通胀` — CPI, PPI
  6. `政策如何进入经济与生活` — employment, unemployment rate, wages, disposable income, fiscal policy, fiscal expenditure, government debt
  7. `经济为什么会有周期与外部联系` — PMI, exchange rate, exports, imports
  8. `把各部分联系起来` — recap
  8. `把各部分联系起来` — recap

  Preserve prerequisite order enforced by `validateLearningPaths`. In particular, keep `monetary-policy` before `policy-rate` and `policy-rate` before `lpr`. The route keeps all existing foundation concepts, but presents them in a beginner sequence; no existing concept content is deleted.

- [ ] **Step 3: Update each affected `nextReason` and recap wording so the new chapter transitions are truthful.**

  Explain why the next chapter follows, distinguish observation from causality, and preserve existing statistical-boundary cautions. The transition into the cycle chapter should use PMI as an early signal and explicitly state that it is not the same as an official cycle index.

- [ ] **Step 4: Run `tests/learning.test.mjs` and confirm route validation passes.**

  Run: `node --import tsx --test tests/learning.test.mjs`

  Expected: all learning tests pass, including prerequisite and chapter-order validation.

### Task 3: Make `/learn/` explain the journey and route hierarchy

**Files:**
- Modify: `src/pages/learn/index.astro`
- Modify: `src/components/learning/LearningCard.astro` only if the route card needs a clearer main-route/specialist label
- Modify: `src/styles/learning.css` only if the new intro or recommended-order block requires responsive spacing

- [ ] **Step 1: Add a plain-language Learning introduction.**

  Explain that MacroLens is a guided way to move from individual concepts to the economic system as a whole. Keep the copy concise and avoid repeating the featured card description.

- [ ] **Step 2: Add a visible recommended-order summary before the route cards.**

  Render the eight chapter titles from the foundation route data so the navigation cannot drift from the actual route. Link the primary action directly to the route overview or first step.

- [ ] **Step 3: Explain specialist routes as optional deep dives.**

  Keep the existing card grid, but label it as “专题深入” and tell beginners to complete or sample the foundation route first. Preserve resume/progress behavior and concept/graph support links.

- [ ] **Step 4: Check the page at desktop and mobile widths.**

  Ensure the introduction, order summary, featured card, specialist cards, and support links use the available width without excessive empty space or horizontal overflow.

### Task 4: Verify the complete change and document the result

**Files:**
- Modify: `docs/learning-mode-implementation.md` if the delivered route structure materially changes the documented published scope

- [ ] **Step 1: Run focused tests.**

  Run: `node --import tsx --test tests/learning.test.mjs tests/information-architecture.test.mjs tests/homepage.test.mjs`

- [ ] **Step 2: Run type and static-output verification.**

  Run: `npm run check`
  Run: `npm run build`
  Run: `npm run test:output`

- [ ] **Step 3: Confirm architecture preservation in the diff.**

  Run: `git diff --check` and inspect that `data/relations/macro.json` and `src/content/concepts/` are unchanged. Confirm no new dependency was added.

- [ ] **Step 4: Record known baseline limitations.**

  Report the pre-existing full-suite PBOC fetch failure caused by unavailable DNS/network if it remains; do not modify unrelated ingestion code for this issue.

- [ ] **Step 5: Commit the implementation as a focused change.**

  Use a message such as `feat: reorganize learning into beginner journey`.
