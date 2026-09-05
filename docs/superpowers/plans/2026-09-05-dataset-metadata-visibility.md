# Dataset Metadata Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reviewable V1 policy that defines which dataset metadata MacroLens exposes to users and which engineering metadata remains internal.

**Architecture:** Keep the deliverable documentation-only. Use one product-facing policy document as the source of truth, with a short design record and this execution plan documenting the decision and implementation boundary. Ground the policy in the current Astro surfaces and explicitly record UI follow-ups without changing runtime code.

**Tech Stack:** Markdown, Astro/TypeScript repository inspection, Node test runner.

---

### Task 1: Record the approved information architecture

**Files:**
- Create: `docs/superpowers/specs/2026-09-05-dataset-metadata-visibility-design.md`

- [ ] **Step 1: State the problem and scope**

Document that Issue #81 is an information-architecture decision and that this PR does not implement UI changes.

- [ ] **Step 2: State the visibility decision**

Document the three boundaries: concise indicator cards, transparent detail pages, and internal engineering metadata.

- [ ] **Step 3: State acceptance criteria**

Include the required distinctions between update time, source publication time, coverage, indicator-specific comparison semantics, and current implementation gaps.

- [ ] **Step 4: Commit the design record**

Run:

```bash
git add docs/superpowers/specs/2026-09-05-dataset-metadata-visibility-design.md
git commit -m "docs: specify dataset metadata visibility"
```

Expected: one commit containing only the design record.

### Task 2: Add the product-facing metadata visibility policy

**Files:**
- Create: `docs/dataset-metadata-visibility-policy.md`

- [ ] **Step 1: Define policy principles**

Explain that metadata is exposed when it improves understanding, trust, or reproducibility for a normal user, and remains internal when it describes implementation rather than the indicator.

- [ ] **Step 2: Define the UI information hierarchy**

Use a table covering indicator cards, indicator detail pages, and the engineering-only boundary. Specify exact fields and presentation constraints for each surface.

- [ ] **Step 3: Define recent-change semantics**

State that recent change is the latest observation minus the comparable prior observation defined by the indicator methodology. Require indicator-specific labels and examples for GDP and CPI.

- [ ] **Step 4: Define provenance fields**

Distinguish data source, source publication date, dataset update time, and coverage period. Require the detail page to explain what each date means.

- [ ] **Step 5: Record current gaps and non-goals**

Identify the currently visible rule version, static-generation note, card-level provenance, and generic comparison wording as follow-up UI work; do not modify those surfaces in this PR.

### Task 3: Validate and prepare the PR

**Files:**
- Verify: `docs/dataset-metadata-visibility-policy.md`
- Verify: `docs/superpowers/specs/2026-09-05-dataset-metadata-visibility-design.md`

- [ ] **Step 1: Self-review the documents**

Search for placeholders and contradictory statements:

```bash
rg -n "TODO|TBD|待补充|待定|上一观测期" docs/dataset-metadata-visibility-policy.md docs/superpowers/specs/2026-09-05-dataset-metadata-visibility-design.md
```

Expected: no placeholders; any mention of an ambiguous phrase appears only as a prohibited or legacy example.

- [ ] **Step 2: Run repository verification**

Run:

```bash
npm test
npm run check
npm run build
```

Expected: all tests pass, Astro check reports no errors, and the static build completes successfully.

- [ ] **Step 3: Review the final diff**

Run:

```bash
git diff --check
git status --short
git diff --stat origin/main...HEAD
```

Expected: only the design record, policy document, and their commits are present; no source or data files change.

- [ ] **Step 4: Create the linked pull request**

Push the branch and create a PR whose body includes `Closes #81`, summarizes the documentation-only scope, and lists the verification commands.
