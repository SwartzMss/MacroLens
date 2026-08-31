# Labor-Market Foundation Implementation Plan

**Goal:** Add the `labor` category, five labor-market concept pages, and cautious relationship context without charts.

**Architecture:** Register the category in the existing TypeScript category map, author Markdown collection entries, and extend the existing macro relationship graph. Drive each slice with focused Node contract tests before running Astro integration validation.

**Tech Stack:** Astro 5, TypeScript, Markdown content collections, JSON relationship data, Node 20 test runner, `tsx`, Pagefind.

## Task 1: Register the labor category

**Files:** `tests/labor-market-content.test.mjs`, `src/data/categories.ts`

1. Add a failing contract requiring `labor` after `external`, with label, description, and order 80.
2. Run the focused test and confirm RED.
3. Add the minimal category entry.
4. Run the focused test and confirm GREEN.

## Task 2: Add employment and unemployment pages

**Files:** `tests/labor-market-content.test.mjs`, `src/content/concepts/employment.md`, `src/content/concepts/unemployment-rate.md`

1. Add failing existence, frontmatter, terminology, source, and no-chart contracts.
2. Author the pages using NBS definitions and methodology.
3. Verify the focused contracts pass.

## Task 3: Add youth unemployment and participation pages

**Files:** `tests/labor-market-content.test.mjs`, `src/content/concepts/youth-unemployment.md`, `src/content/concepts/labor-force-participation.md`

1. Add failing contracts for student treatment, the methodology break, non-splicing warning, labor-force identity, and denominator.
2. Author both pages with conditional interpretation.
3. Verify the focused contracts pass.

## Task 4: Add the wages page

**Files:** `tests/labor-market-content.test.mjs`, `src/content/concepts/wages.md`

1. Add a failing contract for average/median, nominal/real, compensation/income, coverage, and primary sources.
2. Author the page without adding a chart.
3. Verify the focused contract passes.

## Task 5: Add graph relationships

**Files:** `tests/labor-market-relations.test.mjs`, `data/relations/macro.json`

1. Add failing contracts for the five concept nodes, two abstract nodes, seven exact edges, endpoint/type validity, uniqueness, abstract-node behavior, and no unsupported `CAUSES` edges.
2. Add the minimal graph nodes and relations.
3. Run relationship and full unit contracts.

## Task 6: Verify and deliver

1. Run `npm test` under the project Node environment and explicit Node 20 where available.
2. Run `npm run check`.
3. Run `npm run build` and confirm all five routes are generated and indexed.
4. Review the diff against issue #24 and run `git diff --check`.
5. Commit, push `codex/issue-24-labor-market`, and open a PR that closes #24.
