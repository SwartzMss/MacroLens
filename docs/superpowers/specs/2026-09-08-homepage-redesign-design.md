# MacroLens Homepage Redesign Design

## Goal

Turn the homepage into a concise entry point for macroeconomic understanding. The page should introduce MacroLens, summarize the current macro state, surface a small set of notable signals, make canonical relationships visible, and offer guided learning paths. The complete deterministic Snapshot remains available at `/snapshot`.

## Product boundaries

- Keep all Snapshot rules, domain classifications, evidence, risks, watch-next items, observation periods, and freshness semantics unchanged.
- Keep the graph taxonomy and relationship records unchanged. The homepage may curate a readable preview only by resolving existing graph edges through the registry.
- Keep indicator datasets, concept page semantics, and ingestion unchanged.
- Preserve the warm-paper, dark-green, editorial visual language and improve hierarchy with fewer repeated card grids.
- Do not add a macro score, AI commentary, investment signal, authentication, personalization, or a new graph engine.

## Page architecture

### Homepage

The homepage composition, implemented in `src/pages/index.astro`, will follow this order:

1. `HomeHero`: product statement “看懂经济，而不只是看数据。” with supporting copy, a primary anchor CTA to the current state section, a secondary CTA to `/graph`, and a lightweight relationship chain visual. “看懂钱，如何流动。” is a small brand line attached to the relationship visual rather than a competing heading.
2. `MacroStateSummary`: the Snapshot synthesis paragraph followed by all six domain summaries. Each domain renders its canonical `label`, `state`, and `explanation`; the view does not infer or rename the state.
3. `NotableSignals`: four to six explicitly configured high-information indicators. Values, changes, labels, and concept links come from existing dashboard/Snapshot data. The homepage does not implement a second risk-ranking or interpretation algorithm.
4. `RelationshipPreview`: a strong editorial section explaining transmission and rendering a short curated chain from canonical graph relations. The chain links to concept pages when a node is a concept and to `/graph` for the full explorer.
5. `LearningPaths`: four compact routes that orient visitors without enumerating the entire concept catalogue. Each route contains a title, description, and concept entry links resolved against the existing collection.

The full `MacroDashboard`, full `MacroSnapshot`, and long `TransmissionPaths` presentation are removed from the homepage so that the page is not a dashboard/report index.

### `/snapshot`

Create `src/pages/snapshot.astro`. It builds the same `MacroSnapshot` with `buildMacroSnapshot()` and renders the existing `MacroSnapshot` component inside `BaseLayout`. The page title and description identify the route as the complete Macro Snapshot. The component remains the source of truth for synthesis, six domains, evidence, risks, watch-next content, freshness, and disclaimer.

## Data flow and component boundaries

Create a small homepage data module, `src/data/home.ts`, for stable presentation configuration and view-model helpers:

- `notableSignalIds`: a fixed tuple of four to six existing indicator IDs.
- `learningPaths`: titles, descriptions, and concept IDs only; no new economic claims or relation semantics.
- `getHomepageRelationshipPreview()`: resolves configured source/target/type triples through `requireRelation('macro', ...)`, throwing if a canonical edge is removed.
- `getNotableSignals(snapshot)`: selects configured evidence from the canonical Snapshot where possible and returns the existing concept href/value/change fields needed by the component.

Homepage components live under `src/components/home/` and own markup plus focused styles. They receive already-resolved data through Astro props. They do not import or reimplement Snapshot analyzers, graph JSON, or indicator parsing.

`MacroStateSummary` uses a small presentation-only state label map for readable Chinese labels and CSS tone classes. The map is a rendering concern, not a classification rule; the underlying `domain.state` remains intact in markup/data attributes.

## Visual system

- Keep `--paper`, `--card`, `--green`, `--amber`, `--blue`, serif display type, sans body type, light borders, and generous whitespace.
- Use a two-column hero on desktop with a narrow relationship chain panel; collapse it to a single-column reading order on small screens.
- Replace equal-weight walls with varied compositions: a synthesis panel, compact domain matrix, signal list, relationship chain, and path cards.
- Use semantic accent colors only for state chips, connectors, and attention cues. Avoid gradients, glass, heavy shadows, terminal styling, and decorative charts.
- Every interactive card/CTA has a real link, visible hover state, and `:focus-visible` outline.

## Responsive behavior

At `max-width: 760px`:

- Hero copy, CTAs, and chain stack in a readable order.
- CTAs become full-width or wrap without overflow.
- Domain summaries use a single-column or compact two-column label/value layout with long labels allowed to wrap.
- Notable signals use one column at narrow widths and a readable two-column grid only when space permits.
- Relationship connectors become a vertical chain with explicit arrows.
- Learning paths stack and preserve tap targets.
- Navigation and all page content remain within the existing shell width.

## Accessibility

- Keep one page `h1`, then use ordered `h2`/`h3` headings for sections and cards.
- Use semantic links for navigation and CTAs; do not make non-interactive containers clickable with JavaScript.
- Provide an `aria-labelledby` target for each major section.
- Preserve or add visible `:focus-visible` outlines and sufficient color/label contrast.
- Relationship previews include readable text labels; arrows are decorative only.

## Validation strategy

Add focused tests that verify:

- homepage composition order and removal of the full Snapshot/dashboard wall;
- all six Snapshot domains are rendered by `MacroStateSummary` and `/snapshot` renders `MacroSnapshot`;
- homepage relationship preview resolves only canonical graph nodes and relations;
- notable signal and learning-path concept IDs resolve to checked-in concept pages;
- homepage and new route preserve accessibility hooks and responsive CSS;
- existing `npm test`, `npm run check`, `npm run build`, and `npm run test:output` remain green.

The implementation will follow red-green-refactor cycles for the new data helpers and route/composition assertions before polishing styles.
