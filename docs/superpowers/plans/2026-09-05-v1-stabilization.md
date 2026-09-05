# V1 Stabilization and Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make the existing MacroLens V1 implementation release-ready without expanding feature scope.

**Architecture:** Keep ingestion adapters and product data unchanged in shape, adding a deterministic audit test around the existing indicator registry and workflow invariants. Standardize the runtime and upgrade only the vulnerable Astro dependency path, then correct confirmed provenance metadata and align README/runtime documentation.

**Tech Stack:** Node 24, npm lockfile v3, Astro 7.3.1, Node test runner, Astro check/build, GitHub Actions.

---

### Task 1: Establish runtime and release-readiness regression coverage

**Files:**
- Create: .nvmrc
- Create: tests/release-readiness.test.mjs
- Modify: package.json
- Modify: .github/workflows/ci.yml
- Modify: .github/workflows/update-macro-data.yml
- Modify: README.md

- [ ] **Step 1: Write failing runtime and workflow assertions**

Create a test that reads the checked-in files and asserts the intended release contract:

~~~
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
const updateWorkflow = fs.readFileSync('.github/workflows/update-macro-data.yml', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');

test('release runtime is Node 24 with an Astro-compatible minimum', () => {
  assert.equal(fs.readFileSync('.nvmrc', 'utf8').trim(), '24');
  assert.equal(packageJson.engines.node, '>=22.12.0');
  assert.match(ci, /node-version:\s*24/);
  assert.match(updateWorkflow, /node-version:\s*24/);
  assert.doesNotMatch(ci, /node-version:\s*20/);
  assert.doesNotMatch(updateWorkflow, /node-version:\s*20/);
});

test('README describes the shipped V1 runtime and product boundaries', () => {
  assert.match(readme, /宏观经济教育|宏观经济学习/);
  assert.match(readme, /Node(?:\.js)?\s*24|Node 24/);
  assert.match(readme, /Macro Snapshot/);
  assert.match(readme, /数据 PR|data PR/);
  assert.match(readme, /不提供投资建议|非投资建议/);
  assert.doesNotMatch(readme, /Cytoscape/);
});
~~~

- [ ] **Step 2: Run the new test and confirm it fails against the current Node 20 configuration**

Run:

~~~
node --test tests/release-readiness.test.mjs
~~~

Expected: failure because .nvmrc, packageJson.engines, workflow Node versions, and updated README wording do not yet exist.

- [ ] **Step 3: Add the canonical runtime metadata and update workflow versions**

Create .nvmrc containing 24, add this field to package.json, and change both setup-node steps to node-version: 24:

~~~
"engines": {
  "node": ">=22.12.0"
}
~~~

Keep cache, permissions, workflow triggers, and data PR behavior unchanged.

- [ ] **Step 4: Update README runtime and product wording**

Rewrite the README sections so they describe static-first Astro output, concept/topic/relationship exploration, Dashboard, Macro Snapshot, official-data ingestion, reviewable data PRs, Node 24, and these commands:

~~~
npm ci
npm test
npm run check
npm run build
~~~

Change Cloudflare Pages Node.js version and NODE_VERSION from 20 to 24. Remove the stale Cytoscape reference and explicitly state that MacroLens is educational/exploratory, not investment advice.

- [ ] **Step 5: Run the release-readiness test and commit the runtime/documentation baseline**

Run:

~~~
node --test tests/release-readiness.test.mjs
~~~

Expected: PASS.

Commit:

~~~
git add .nvmrc package.json .github/workflows/ci.yml .github/workflows/update-macro-data.yml README.md tests/release-readiness.test.mjs
git commit -m "chore: standardize V1 Node runtime"
~~~

### Task 2: Upgrade the vulnerable build dependency path

**Files:**
- Modify: package.json
- Modify: package-lock.json
- Conditional create: docs/release/v1-dependency-audit.md

- [ ] **Step 1: Upgrade Astro to the audited secure release**

Run:

~~~
npm install astro@7.3.1
~~~

This must update the direct Astro dependency and lockfile without using npm audit fix --force or unrelated package upgrades.

- [ ] **Step 2: Check the resolved dependency tree and audit result**

Run:

~~~
npm ls astro sharp esbuild
npm audit --json
~~~

Expected: Astro resolves to 7.3.1 or newer within the selected range, the Astro-linked esbuild/sharp findings are absent, and no unresolved high vulnerability remains. If npm reports a remaining vulnerability, create docs/release/v1-dependency-audit.md with the exact package, dependency path, affected surface, and reason it is accepted before continuing.

- [ ] **Step 3: Run the existing tests and build against the upgraded Astro**

Run:

~~~
npm test
npm run check
npm run build
~~~

Expected: all tests pass, Astro check reports 0 errors/warnings/hints, and the static build exits 0. Fix only Astro 7 compatibility issues in existing source files; do not refactor unrelated components.

- [ ] **Step 4: Commit the dependency upgrade**

~~~
git add package.json package-lock.json
if test -f docs/release/v1-dependency-audit.md; then git add docs/release/v1-dependency-audit.md; fi
git commit -m "chore: upgrade secure Astro toolchain"
~~~

### Task 3: Add the full registered-indicator data audit

**Files:**
- Create: tests/indicator-data-integrity.test.mjs
- Modify: tests/ingestion-nbs-prices.test.mjs if a provenance mapping regression is needed
- Modify: data/indicators/*.json only for confirmed metadata corrections

- [ ] **Step 1: Add a deterministic audit for all 11 registered datasets**

Load getIndicatorData() and assert the exact V1 registry set and field matrix:

~~~
const expected = {
  m0: ['monthly', '%', 'yoy', 'published'],
  m1: ['monthly', '%', 'yoy', 'published'],
  m2: ['monthly', '%', 'yoy', 'published'],
  pmi: ['monthly', 'index', 'index', 'published'],
  gdp: ['quarterly', '%', 'yoy', 'published'],
  'industrial-production': ['monthly', '%', 'yoy', 'published'],
  'retail-sales': ['monthly', '%', 'yoy', 'published'],
  'fixed-asset-investment': ['monthly', '%', 'cumulative_yoy', 'published'],
  cpi: ['monthly', '%', 'yoy', 'published'],
  'core-cpi': ['monthly', '%', 'yoy', 'published'],
  ppi: ['monthly', '%', 'yoy', 'published'],
};
~~~

For every dataset, assert:

- JSON ID equals the registry ID;
- frequency, unit, metric, and calculation equal the matrix;
- data is non-empty, dates are unique and strictly ordered;
- dates match the declared frequency, including Q1-Q4 for quarterly data and the existing combined-period notation for NBS monthly cumulative series;
- updatedAt and every sourceDate are valid YYYY-MM-DD dates;
- every source URL uses stats.gov.cn, data.stats.gov.cn, or pbc.gov.cn;
- source coverage and title are non-empty;
- source role is either data or methodology when present;
- no two sources share the same role and coverage key;
- data sources have a source URL/date/coverage tuple that is internally complete.

The test must not fetch the network or rewrite checked-in JSON.

- [ ] **Step 2: Run the audit and record concrete failures**

Run:

~~~
node --test tests/indicator-data-integrity.test.mjs
~~~

Expected: any failure names the dataset and source entry. Use that output to identify actual stale title/URL/coverage mismatches; do not weaken assertions to accommodate a bad entry.

- [ ] **Step 3: Correct only confirmed provenance metadata**

Update the affected files under data/indicators/ so each corrected source has the official publication title, URL, sourceDate, coverage, and role describing the same publication. Do not change observation values or valid historical coverage merely for formatting.

Add a regression assertion for every corrected mapping, using the exact dataset ID, coverage, URL, title, and sourceDate so the mismatch cannot return.

- [ ] **Step 4: Run the audit together with ingestion tests**

Run:

~~~
node --test tests/indicator-data-integrity.test.mjs tests/ingestion-nbs-prices.test.mjs tests/ingestion-nbs-real-economy.test.mjs tests/ingestion-pmi.test.mjs tests/ingestion-pboc-money-supply.test.mjs
~~~

Expected: all static contract/provenance and adapter tests pass.

- [ ] **Step 5: Commit the audit and confirmed data metadata corrections**

~~~
git add tests/indicator-data-integrity.test.mjs tests/ingestion-nbs-prices.test.mjs data/indicators
git commit -m "test: audit V1 indicator provenance"
~~~

### Task 4: Lock automated-update invariants

**Files:**
- Modify: tests/release-readiness.test.mjs
- Modify: tests/ingestion-nbs-prices.test.mjs only if an idempotency gap is found

- [ ] **Step 1: Add workflow invariant assertions**

Extend the release-readiness test to read .github/workflows/update-macro-data.yml and assert:

~~~
assert.match(updateWorkflow, /stats\.gov\.cn|pbc\.gov\.cn/);
assert.match(updateWorkflow, /create-pull-request@v7/);
assert.match(updateWorkflow, /branch:\s*automation\/update-macro-data/);
assert.match(updateWorkflow, /delete-branch:\s*true/);
assert.doesNotMatch(updateWorkflow, /merge|auto-merge/i);
~~~

Also assert the data update workflow still invokes all four ingestion commands: PMI, PBOC money supply, NBS real economy, and NBS prices.

- [ ] **Step 2: Verify the existing unchanged-data idempotency coverage**

The existing PMI, PBOC money-supply, real-economy, and price ingestion suites already exercise second runs with the same fixtures. Confirm those tests assert Changed: false or byte-identical output for every target; add only the missing assertion if one of the four suites does not cover its complete target group. Keep the tests offline and do not add a new runtime fetch path.

- [ ] **Step 3: Run the invariant tests**

Run:

~~~
node --test tests/release-readiness.test.mjs tests/ingestion-nbs-prices.test.mjs
~~~

Expected: all runtime, documentation, workflow, and idempotency assertions pass.

- [ ] **Step 4: Commit the invariant coverage**

~~~
git add tests/release-readiness.test.mjs tests/ingestion-nbs-prices.test.mjs
git commit -m "test: preserve V1 update workflow invariants"
~~~

### Task 5: Run final release verification and prepare the PR

**Files:**
- No additional source files

- [ ] **Step 1: Install exactly from the lockfile**

Run:

~~~
npm ci
~~~

Expected: exit code 0 and no Node engine mismatch warning.

- [ ] **Step 2: Run the required release checks**

Run each command:

~~~
npm audit
npm test
npm run check
npm run build
~~~

Expected: audit has no unresolved high vulnerability, tests have zero failures, Astro check has 0 errors/warnings/hints, and build exits 0.

- [ ] **Step 3: Verify the final source state**

Run:

~~~
git diff --check
git status --short --branch
git log --oneline --decorate -8
~~~

Expected: no whitespace errors and no uncommitted source changes.

- [ ] **Step 4: Push and create the stabilization PR**

~~~
git push -u origin codex/issue-79
gh pr create --base main --head codex/issue-79 --title "chore: stabilize V1 for release" --body "Closes #79. Standardizes Node 24, upgrades the secure Astro toolchain, audits V1 indicator provenance, locks update workflow invariants, and aligns README with the shipped product. Post-merge verification: run Update macro data and confirm unchanged data creates no PR."
~~~

- [ ] **Step 5: After merge, run the operational acceptance checks**

Run:

~~~
gh workflow run update-macro-data.yml --ref main
RUN_ID=$(gh run list --workflow update-macro-data.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
~~~

Confirm all five adapter groups succeed and unchanged official data creates no data PR. Then verify the Cloudflare Pages production deployment from main and manually load the public routes /, /concepts, /topics, /graph, and /search.

- [ ] **Step 6: Record release handoff**

Comment on the PR with the final audit result, workflow run URL, deployment result, and any explicitly accepted dependency finding. Do not tag or merge v1.0.0 in this PR.
