# 导航标签可见性调整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the global “概念 / 主题 / 搜索” navigation labels easier to read.

**Architecture:** Keep the existing `BaseLayout` navigation markup unchanged. Adjust only the shared `.nav a:not(.brand)` CSS rule so every page receives the same typography update without changing layout geometry or responsive behavior.

**Tech Stack:** Astro, CSS, TypeScript checks via `astro check`.

---

### Task 1: Increase global navigation label visibility

**Files:**
- Modify: `src/styles/global.css` in the `.nav a:not(.brand)` rule
- Test: `npm run check`

- [ ] **Step 1: Update the shared navigation rule**

Change the rule to:

```css
.nav a:not(.brand) {
  font-size: 16px;
  font-weight: 700;
  color: var(--muted);
}
```

- [ ] **Step 2: Run the Astro checks**

Run: `npm run check`

Expected: the command exits with code 0 and reports no new errors caused by the navigation change.

- [ ] **Step 3: Review the diff and commit**

Run: `git diff --check` and `git diff -- src/styles/global.css`

Expected: only the shared navigation typography and the related design/plan records are changed, with no whitespace errors.

Commit with:

```bash
git add src/styles/global.css docs/superpowers/specs/2026-09-05-nav-label-visibility-design.md docs/superpowers/plans/2026-09-05-nav-label-visibility.md
git commit -m "style: improve navigation label visibility"
```

- [ ] **Step 4: Push the updated main branch**

Run: `git push origin main`

Expected: `origin/main` advances to the new commit and the push succeeds.
