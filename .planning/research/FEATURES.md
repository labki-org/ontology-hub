# Feature Landscape: Ontology Hub v2.0 Graph Visualization

**Domain:** Graph-based ontology/schema browsers
**Researched:** 2026-01-23
**Overall Confidence:** MEDIUM-HIGH (verified against established tools and academic patterns)

## Executive Summary

Research surveyed ontology visualization tools (WebVOWL, OWLGrEd, Protege), graph libraries (Cytoscape.js, ReactFlow, D3), and knowledge graph explorers (Neo4j, Stardog, Open Semantic). The graph visualization space has mature patterns for navigation, grouping, and filtering, but **draft overlay visualization** is a novel domain requiring original design.

Key insight: Graph browsers excel at exploration but rarely integrate with edit workflows. Ontology Hub's strength is combining **browse + draft + PR** in one flow. v2.0 should enhance exploration without compromising the core draft-to-PR value proposition.

---

## Context: v1.0 Existing Features

Before defining v2.0 features, documenting what already exists (based on codebase review):

| Feature | Implementation | Status |
|---------|----------------|--------|
| Inheritance graph (category-centric) | ReactFlow + dagre layout | Complete |
| Module dependency graph | ReactFlow + dagre layout | Complete |
| Click-to-navigate (graph nodes) | React Router integration | Complete |
| Circular detection badges | Frontend warning display | Complete |
| Version diff viewer | JSON diff with field-level highlighting | Complete |
| Draft inline editing | Field-level edit mode | Complete |

**v1.0 Graph Limitations:**
- Static dagre layout (no force-directed interaction)
- No edge filtering (shows all relationships)
- No module hull overlays (modules shown as separate graphs)
- No draft overlay on graph (draft mode uses list/detail views only)

---

## Table Stakes

Features expected for graph-based ontology browsers. Missing these makes v2.0 feel incomplete.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Neighborhood expansion** | WebVOWL, Neo4j Browser all support "expand from node"; users expect click-to-expand | Medium | Existing graph components | "Show 1-hop neighbors" button on node hover |
| **Edge type filtering** | Gephi, Cytoscape standard; users need to show only inheritance vs all relationships | Low-Medium | Graph state management | Checkbox/toggle for edge types (inherits, uses property, etc.) |
| **Node type filtering** | Standard in all graph browsers; filter by category/property/subobject | Low | Graph state management | Already have entity types; add filter UI |
| **Zoom controls** | ReactFlow already provides; ensure visible and intuitive | Low | Already implemented | Verify current Controls component suffices |
| **Pan/drag navigation** | ReactFlow already provides | Low | Already implemented | Existing fitView behavior |
| **Search-to-highlight** | Neo4j, Stardog all have search-to-graph integration; find and center on node | Medium | Search API + graph state | Type entity name, graph centers on matching node |
| **Minimap/overview** | Standard for large graphs; orientation aid | Low | ReactFlow MiniMap component | Easy addition with existing library |
| **Node detail on hover/click** | WebVOWL shows details on selection; already implemented via navigation | Low | Already implemented | Click navigates to detail page; consider hover preview |
| **Module scope filtering** | Per PRD: module page shows module-scoped slice | Medium | Module API + graph filtering | Filter graph to show only entities in module X |
| **Layout direction toggle** | Top-down vs left-right orientation | Low | dagre direction parameter | Already supported in useGraphLayout.ts |

### Rationale

These features appear in **every** surveyed ontology browser:
- WebVOWL has zoom, pan, node details, filtering by ontology elements
- Neo4j Browser has expand neighbors, search highlighting, minimap
- Cytoscape has all filtering/expansion primitives built-in
- OWLGrEd has scope controls and layout customization

Sources:
- [WebVOWL GitHub](https://github.com/VisualDataWeb/WebVOWL)
- [Neo4j Graph Visualization Docs](https://neo4j.com/docs/getting-started/graph-visualization/graph-visualization/)
- [Cytoscape.js API](https://js.cytoscape.org/)
- [OWLGrEd Features](https://owlgred.lumii.lv/online_visualization)

---

## Differentiators

Features that would make Ontology Hub v2.0 stand out. Not expected, but create competitive advantage.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Multi-hull module overlays** | Show multiple modules simultaneously with color-coded convex hulls; unique to this space | High | Module data + hull calculation library | Per PRD: "multi-hull module overlays" |
| **Draft change highlighting on graph** | Nodes badge as added/modified/deleted in draft mode; no competitor does this | High | Draft state + graph integration | Green/yellow/red badges or outlines on affected nodes |
| **Impact radius visualization** | "What else is affected by this change?" Show ripple effect of draft changes | High | Validation engine + graph traversal | Breaking change detection already exists; visualize impact |
| **Draft-only filter** | In graph view, toggle to show only entities touched by current draft | Medium | Draft state + graph filtering | "Show changes only" toggle |
| **Side-by-side graph diff** | Two graphs: canonical vs draft, synced navigation | High | Dual graph instances + sync | Alternative to overlay approach |
| **Force-directed layout option** | Beyond dagre hierarchy; D3 force simulation for organic exploration | Medium | D3-force or Cytoscape headless | WebVOWL uses force-directed; adds exploration feel |
| **Animated layout transitions** | Smooth transitions when filtering/expanding; reduces cognitive load | Medium | ReactFlow animation APIs | yFiles and Cytoscape support this |
| **Graph export (SVG/PNG)** | Save current graph view for documentation | Low | html2canvas or SVG export | WebVOWL has this; useful for wiki embedding |
| **Keyboard navigation** | Arrow keys to traverse graph; accessibility + power users | Medium | Focus management | Neo4j Browser supports keyboard nav |
| **Saved views/presets** | Remember common filter combinations | Medium | Local storage or backend | "Show inheritance only" as saved preset |
| **Impacted-entities-only PR summary** | PR description includes visual of impacted graph region | High | Graph + validation + GitHub integration | Generated graph image embedded in PR body |

### Competitive Landscape for Graph Features

| Tool | Graph Features | What We Could Match/Beat |
|------|----------------|--------------------------|
| WebVOWL | Force-directed, hover details, SVG export | Match layout; beat with draft integration |
| Neo4j Browser | Expand neighbors, search-to-graph, minimap | Match exploration; beat with PR workflow |
| Protege OWLViz | Static hierarchy, zoom/pan | Already beyond this with ReactFlow |
| OWLGrEd | Module scope, layout customization | Match scoping; beat with draft overlay |
| Cytoscape | Compound nodes, edge filtering, algorithms | Consider migration for advanced features |

Our unique position: **Graph visualization integrated with draft review and PR creation**. No surveyed tool combines exploration with contribution workflow.

Sources:
- [WZB Overlapping Groups Visualization](https://datascience.blog.wzb.eu/2018/05/11/visualizing-graphs-with-overlapping-node-groups/)
- [Cytoscape.js expand-collapse extension](https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse)
- [Cambridge Intelligence Graph UX](https://cambridge-intelligence.com/graph-visualization-ux-how-to-avoid-wrecking-your-graph-visualization/)

---

## Anti-Features

Things to deliberately NOT build. Common mistakes or features that conflict with project goals.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full 3D visualization** | OntoTrek does this; high complexity, limited value for ontology review | Stay 2D; depth is visual noise for schema review |
| **SPARQL query integration** | Protege has this; out of scope per PROJECT.md; adds complexity | Static browsing; link to external query tools |
| **Real-time collaborative graph editing** | Complexity of multi-cursor on canvas; drafts are single-user | Sequential draft ownership; parallel drafts are separate URLs |
| **Graph-based schema creation** | Visual authoring tools exist (OWLGrEd); we are review-focused | Accept imports only; link to authoring tools |
| **Animation-heavy effects** | Particle effects, glow animations distract from data | Subtle transitions only; focus on information |
| **Complex multi-select gestures** | Lasso select, shift-click regions add cognitive load | Single-node focus; filters for bulk |
| **Graph persistence/serialization** | Saving custom layouts for later | Algorithmic layouts are reproducible; no persistence needed |
| **Touch-first gestures** | Pinch-zoom, two-finger pan for tablets | Desktop-first per constraints; basic touch support is fine |
| **Custom node styling per user** | User preferences for colors/sizes | Consistent styling; entity-type-based colors only |
| **Social features on graph** | Comments, reactions, annotations on nodes | GitHub is discussion venue |

### Rationale

These anti-features stem from:
1. **Scope control** (3D, SPARQL, authoring, collaboration)
2. **Complexity avoidance** (animation, multi-select, persistence)
3. **Desktop-first constraint** (touch gestures)
4. **Core value protection** (social features belong on GitHub)

Sources:
- [OntoTrek 3D Ontology Visualization](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0286728) - Example of what NOT to build
- v1.0 FEATURES.md anti-features section

---

## Feature Details by Question Area

### 1. Graph Navigation Patterns

**Question:** How do users navigate large ontologies via graph?

**Findings:**

| Pattern | Description | Adoption | Recommendation |
|---------|-------------|----------|----------------|
| **Neighborhood expansion** | Click node to reveal immediate connections | Universal (WebVOWL, Neo4j, Cytoscape) | MUST HAVE: Add expand/collapse per node |
| **Progressive disclosure** | Start with overview, drill down on demand | Common (yFiles, Cambridge Intelligence) | SHOULD HAVE: Start collapsed, expand on click |
| **Scope filtering** | Show only entities in module/namespace X | Common (OWLGrEd, TopBraid) | MUST HAVE: Module scope filter for module pages |
| **Edge type filtering** | Toggle relationship types on/off | Common (Gephi, Cytoscape, Neo4j) | MUST HAVE: Inheritance-only toggle minimum |
| **Semantic zoom** | Different detail levels at different zoom levels | Advanced (yFiles, Ogma) | NICE TO HAVE: Show labels at high zoom only |
| **Breadcrumb trail** | Visual history of navigation path | Moderate (some file browsers) | DEFER: URL-based history suffices |

**Implementation priority:**
1. Edge type filter (inherits, uses-property, has-subobject)
2. Module scope filter (on module detail page)
3. Neighborhood expansion (1-hop, 2-hop buttons)
4. Search-to-center (type name, graph zooms to node)

Sources:
- [Gephi Filters Tutorial](https://seinecle.github.io/gephi-tutorials/generated-html/using-filters-en.html)
- [yFiles Collapsing Groups](https://www.yworks.com/pages/collapsing-groups-in-diagrams)
- [graph-tool Filtering](https://graph-tool.skewed.de/doc/quickstart.html)

### 2. Module Grouping Visualization

**Question:** How do tools show logical groupings?

**Findings:**

| Technique | Description | Pros | Cons | Tools Using |
|-----------|-------------|------|------|-------------|
| **Compound nodes** | Cytoscape-style parent container | Clear hierarchy, collapsible | Layout complexity, nesting limits | Cytoscape, yFiles |
| **Convex hulls** | Polygon wrapping group members | Shows overlapping groups | Overlaps can confuse | D3, R/ggplot |
| **Color coding** | Node fill/border by group | Simple, parallel groups | Limited distinct colors | All tools |
| **Background regions** | Shaded areas behind nodes | Non-intrusive grouping | Can obscure node detail | Neo4j Bloom |
| **Edge bundling** | Group edges by module | Reduces clutter | Hides individual relationships | Gephi, D3 |

**Recommendation for multi-hull overlays:**
- Use **convex hulls with semi-transparent fills**
- Different hue per module, 20-30% opacity
- Nodes in multiple modules: show as intersection area OR duplicate with visual links
- Hull computation: use [d3-polygon](https://github.com/d3/d3-polygon) or [concaveman](https://github.com/mapbox/concaveman)

**Implementation approach:**
```
1. Calculate convex hull for each selected module's entities
2. Render hulls as SVG polygons behind graph
3. Color-code with module palette
4. Legend showing module-to-color mapping
```

Sources:
- [Visualizing Overlapping Node Groups (WZB)](https://datascience.blog.wzb.eu/2018/05/11/visualizing-graphs-with-overlapping-node-groups/)
- [Cytoscape.js Compound Nodes Demo](https://js.cytoscape.org/demos/compound-nodes/)
- [Survey: Visualizing Group Structures in Graphs](https://onlinelibrary.wiley.com/doi/abs/10.1111/cgf.12872)

### 3. Draft Overlay Patterns

**Question:** How do tools show changes visually?

**Findings:**

This is the least standardized area. Most graph tools are read-only; schema diff tools (pgAdmin, SQL Server) use table/text views. Novel design needed.

| Pattern | Description | Where Seen | Applicability |
|---------|-------------|-----------|---------------|
| **Color-coded badges** | Green (added), Yellow (modified), Red (deleted) | Git diff, gsgdt-rs | HIGH: Simple, familiar |
| **Node border styling** | Dashed border for deleted, thick for modified | Nx proposed feature | MEDIUM: Subtle distinction |
| **Dual-pane diff** | Side-by-side graphs (before/after) | Design diff tools (Cliosoft) | MEDIUM: More space, clear separation |
| **Ghost nodes** | Deleted items shown at 50% opacity with strikethrough | Figma version history | MEDIUM: Shows removals in context |
| **Change list overlay** | Sidebar list of changes, click to highlight on graph | SQL Server Schema Compare | HIGH: Combines list + graph |
| **Filter to changes** | "Show changes only" toggle | pgAdmin Schema Diff | HIGH: Focus on what matters |

**Recommendation for draft overlay:**
1. **Default view:** Full graph with change badges on affected nodes
2. **Badge design:** Corner icon (+ for added, pencil for modified, - for deleted)
3. **Color scheme:** Green (#22c55e), Amber (#f59e0b), Red (#ef4444) - familiar from git
4. **Filter toggle:** "Show changes only" reduces to subgraph of affected entities
5. **Click interaction:** Click badge shows change details in side panel
6. **Edge changes:** Dashed edge for removed relationships, thick for new

**Implementation approach:**
```
1. Compute diff between draft entities and indexed canonical
2. Annotate graph nodes with changeType: added | modified | deleted | unchanged
3. Custom node component renders appropriate badge
4. Filter function creates subgraph of changeType !== 'unchanged'
```

Sources:
- [gsgdt-rs Graph Diff](https://github.com/vn-ki/gsgdt-rs) - Green/red node coloring
- [Cliosoft Visual Design Diff](https://www.cliosoft.com/2020/05/19/visual-design-diff/) - Diff highlighting in schematics
- [Nx graph diff proposal](https://github.com/nrwl/nx/issues/12060) - Color scheme recommendations

### 4. Canonical Versioning UX

**Question:** How do users browse different versions?

**Findings:**

| Pattern | Description | Tools Using | Recommendation |
|---------|-------------|-------------|----------------|
| **Dropdown version selector** | Select version from list, view updates | Swagger, Incorta, pgAdmin | MUST HAVE: Already have version selector |
| **Version comparison picker** | "Compare A to B" dual-select | Incorta Schema Version Compare | SHOULD HAVE: Source/target dropdowns |
| **Timeline/slider** | Visual timeline of versions | GitHub file history, some analytics tools | DEFER: Overkill for schema diffs |
| **"What changed" summary** | Changelog/release notes per version | GitHub releases, Confluence | SHOULD HAVE: Already have in v1.0 |
| **Diff mode toggle** | Switch between "current view" and "diff view" | Most diff tools | SHOULD HAVE: Explicit mode switching |

**Current v1.0 implementation:**
- Version listing exists
- Version diff viewer with field-level highlighting exists
- No version selector on graph (graph shows current canonical)

**v2.0 enhancements:**
1. **Version selector on graph page:** Dropdown to view graph as-of version X
2. **Diff view on graph:** Compare graph between two versions (like draft overlay but for released versions)
3. **Version badge:** Show which version is currently displayed

Sources:
- [Incorta Schema Version Compare](https://docs.incorta.com/latest/tools-schema-version-compare/)
- [pgAdmin Schema Diff](https://www.pgadmin.org/docs/pgadmin4/latest/schema_diff.html)
- [Microsoft Schema Compare](https://learn.microsoft.com/en-us/sql/tools/sql-database-projects/concepts/schema-comparison)

---

## Feature Dependencies

```
Legend:
  A -> B means B requires A (build A first)
  A <-> B means mutual dependency (build together)

Graph Enhancement Layer (extends v1.0 graph)
+-- Edge type filter -> Existing graph components
+-- Node type filter -> Existing graph components
+-- Minimap -> ReactFlow MiniMap (drop-in)
+-- Module scope filter -> Module API + graph state

Navigation Layer (builds on enhancement)
+-- Neighborhood expansion -> Graph state + API for neighbors
+-- Search-to-center -> Search API + graph focus
+-- Force-directed layout -> D3-force or Cytoscape headless

Module Visualization Layer (parallel to navigation)
+-- Multi-hull overlays -> Module API + hull calculation (d3-polygon)
+-- Hull legend -> Multi-hull overlays
+-- Module selection panel -> Hull overlays + UI

Draft Integration Layer (builds on graph)
+-- Change badges on nodes -> Draft state + graph node decoration
+-- Change-only filter -> Change badges + filter mechanism
+-- Side panel change details -> Change badges + click handling
+-- Impact visualization -> Validation engine + graph traversal

Version Integration Layer (extends existing diff)
+-- Version selector on graph -> Version API + graph reload
+-- Graph version diff -> Two graph instances + sync
```

### Recommended Build Order

**Phase A: Graph Enhancement (Low complexity, high value)**
1. Edge type filtering
2. Module scope filtering (for module pages)
3. Minimap addition
4. Search-to-center

**Phase B: Module Visualization (Medium complexity)**
1. Multi-hull calculation and rendering
2. Module selection panel
3. Hull legend

**Phase C: Draft Graph Integration (High complexity, core differentiator)**
1. Change badge system
2. Change-only filter
3. Side panel integration
4. Impact radius visualization

**Phase D: Version Graph Integration (Medium complexity)**
1. Version selector on graph
2. Graph version diff mode

---

## Complexity Assessment

| Feature Category | Overall Complexity | Key Drivers |
|------------------|-------------------|-------------|
| **Edge/node filtering** | LOW | ReactFlow filtering is straightforward |
| **Module scope filter** | LOW-MEDIUM | Need to filter graph data by module membership |
| **Minimap** | LOW | Drop-in ReactFlow component |
| **Search-to-center** | MEDIUM | Graph focus + animation |
| **Neighborhood expansion** | MEDIUM | API for neighbors, graph state updates, animation |
| **Force-directed layout** | MEDIUM | Requires Cytoscape headless or D3-force integration |
| **Multi-hull overlays** | HIGH | Hull calculation, SVG rendering, overlap handling |
| **Draft change badges** | MEDIUM | Diff computation + node decoration |
| **Change-only filter** | MEDIUM | Depends on change badge infrastructure |
| **Impact visualization** | HIGH | Validation engine integration + graph traversal |
| **Graph version diff** | HIGH | Dual graph instances + synchronized navigation |

### Risk Areas

1. **Multi-hull overlays** - Overlapping hulls can become visually confusing; need careful color/opacity tuning
2. **Force-directed layout** - Performance concerns with large graphs (>500 nodes); may need WebGL
3. **Draft change visualization** - Novel pattern; needs user testing to validate approach
4. **ReactFlow vs Cytoscape decision** - Current ReactFlow works; migration to Cytoscape would enable advanced features but is significant effort

---

## MVP Recommendation for v2.0

### Must Have (v2.0 MVP)

1. **Edge type filtering** - Toggle inheritance vs all relationships (table stakes)
2. **Module scope filtering** - Module page shows module entities only (PRD requirement)
3. **Search-to-center** - Find and focus on entity in graph (table stakes)
4. **Draft change badges** - Visual indication of added/modified/deleted on graph (core differentiator)
5. **Change-only filter** - "Show changes only" toggle (core differentiator)

### Should Have (v2.0)

1. **Multi-hull module overlays** - PRD explicitly mentions this
2. **Neighborhood expansion** - 1-hop expand on node click
3. **Minimap** - Orientation for large graphs
4. **Graph export** - SVG/PNG for documentation

### Nice to Have (Post v2.0)

1. Force-directed layout option
2. Impact radius visualization
3. Graph version diff mode
4. Animated transitions
5. Keyboard navigation

### Defer Indefinitely

All anti-features listed above (3D, SPARQL, collaborative editing, etc.)

---

## Library Considerations

### Current Stack (v1.0)

- **ReactFlow** (@xyflow/react) - Node-based graph visualization
- **dagre** (@dagrejs/dagre) - Hierarchical layout algorithm

### Options for v2.0 Enhancements

| Feature | ReactFlow Approach | Cytoscape Approach | Recommendation |
|---------|-------------------|-------------------|----------------|
| Edge filtering | Filter edges array, re-render | cy.elements().filter() | Either works |
| Neighborhood expansion | Manual neighbor calculation | ele.neighborhood() built-in | Cytoscape advantage |
| Force-directed layout | d3-force integration | CoSE/fcose layout built-in | Cytoscape advantage |
| Convex hulls | Custom SVG rendering | cytoscape-popper + custom overlay | Similar complexity |
| Compound nodes | Limited support | Native support | Cytoscape advantage |
| React integration | Native | react-cytoscapejs wrapper | ReactFlow advantage |

**Recommendation:** Stay with ReactFlow for v2.0 MVP. Consider Cytoscape migration for post-MVP if advanced graph algorithms become essential. Reasons:
1. ReactFlow already integrated and working
2. Most v2.0 features achievable with ReactFlow
3. Migration cost is significant
4. Cytoscape's React wrapper adds complexity

---

## Sources

### Ontology Visualization Tools (HIGH confidence)
- [WebVOWL GitHub](https://github.com/VisualDataWeb/WebVOWL)
- [OWLGrEd Online Visualization](https://owlgred.lumii.lv/online_visualization)
- [Protege Visualization](https://protege.stanford.edu/)
- [VOWL Specification (Semantic Web Journal)](https://www.semantic-web-journal.net/system/files/swj1114.pdf)

### Graph Libraries (HIGH confidence)
- [Cytoscape.js](https://js.cytoscape.org/)
- [ReactFlow](https://reactflow.dev/)
- [Cytoscape.js expand-collapse extension](https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse)

### Graph UX Patterns (MEDIUM confidence)
- [Cambridge Intelligence Graph Visualization UX](https://cambridge-intelligence.com/graph-visualization-ux-how-to-avoid-wrecking-your-graph-visualization/)
- [Gephi Filters Tutorial](https://seinecle.github.io/gephi-tutorials/generated-html/using-filters-en.html)
- [yFiles Collapsing Groups](https://www.yworks.com/pages/collapsing-groups-in-diagrams)

### Group Visualization (MEDIUM confidence)
- [Visualizing Overlapping Node Groups (WZB)](https://datascience.blog.wzb.eu/2018/05/11/visualizing-graphs-with-overlapping-node-groups/)
- [Survey: Visualizing Group Structures in Graphs](https://onlinelibrary.wiley.com/doi/abs/10.1111/cgf.12872)

### Schema Diff Patterns (MEDIUM confidence)
- [Incorta Schema Version Compare](https://docs.incorta.com/latest/tools-schema-version-compare/)
- [pgAdmin Schema Diff](https://www.pgadmin.org/docs/pgadmin4/latest/schema_diff.html)
- [Cliosoft Visual Design Diff](https://www.cliosoft.com/2020/05/19/visual-design-diff/)

### Knowledge Graph Explorers (MEDIUM confidence)
- [Neo4j Graph Visualization](https://neo4j.com/docs/getting-started/graph-visualization/graph-visualization/)
- [Stardog Explorer](https://www.stardog.com/platform/features/navigate-your-data-with-pathfinder/)
- [Open Semantic Visual Graph Explorer](https://opensemanticsearch.org/graph-explorer/)

### Comparison Resources (MEDIUM confidence)
- [npm trends: Cytoscape vs ReactFlow](https://npmtrends.com/cytoscape-vs-d3-vs-react-flow-renderer)
- [Open Source Data Visualization Tools Comparison](https://cambridge-intelligence.com/open-source-data-visualization/)
