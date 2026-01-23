# Domain Pitfalls

**Domain:** Ontology Hub v2.0 - Platform Rebuild with Graph Visualization and Draft-as-Deltas
**Researched:** 2026-01-23
**Confidence:** HIGH (multiple authoritative sources + v1.0 codebase analysis)

---

## Critical Pitfalls

Mistakes that cause rewrites, security incidents, or major architectural rework.

---

### Pitfall 1: Graph Visualization Performance Collapse

**What goes wrong:** React Flow renders become janky with 100+ nodes, especially when using custom nodes with complex styling. Layout recalculations cause visible "jumping" where nodes shift positions between renders. Module hull overlays compound the problem with expensive polygon calculations on every frame.

**Why it happens:**
- React Flow's default behavior re-renders all nodes when any node state changes
- Custom nodes that aren't memoized create new component references every render
- Dagre layout algorithm is deterministic but unstable - small changes to node IDs or edges cause cascading position shifts
- Hull polygon calculation is O(n log n) per module, multiplied across multiple visible modules
- CSS animations, shadows, and gradients significantly impact canvas performance

**Consequences:**
- Users report "laggy" or "janky" graph interaction
- Large ontologies (500+ categories) become unusable
- Module hull boundaries flicker during interaction
- Users abandon graph view for list-based navigation

**Warning signs:**
- Frame rate drops during pan/zoom (observe via DevTools Performance panel)
- Node positions change unexpectedly when adding/removing edges
- Custom nodes not wrapped in React.memo()
- Hull polygons recalculating on every mouse move
- No virtualization for off-screen nodes

**Prevention:**
1. **Memoize all custom components:** Use `React.memo()` on node and edge components, define outside parent component
2. **Stable node IDs:** Use entity keys (e.g., `categories/Person`) not auto-generated IDs that change between renders
3. **Batch state updates:** Update nodes/edges in single setState call, not separately
4. **Debounce hull calculations:** Only recalculate module hulls after layout stabilizes (300-500ms debounce)
5. **Canvas rendering for hulls:** Render hull polygons to HTML5 canvas, not SVG, for better performance
6. **Virtualization for large graphs:** Consider progressive loading - render visible subgraph, load on expand
7. **Simplify node styles:** Remove shadows, gradients, complex animations on nodes in large graphs

**Detection:**
- Performance budget: Graph interaction should maintain 60fps with 200 nodes
- Automated performance tests with realistic ontology sizes (500+ categories)
- User testing with actual labki-schemas data

**Phase mapping:** Graph visualization phase. Performance must be designed in from the start - retrofitting virtualization is a major refactor.

**Sources:**
- [React Flow Performance Guide](https://reactflow.dev/learn/advanced-use/performance)
- [React Flow Layout Discussion](https://github.com/xyflow/xyflow/discussions/2973) - nodes jumping issue
- [React Flow Large Graph Discussion](https://github.com/xyflow/xyflow/discussions/4975) - 500+ node performance
- [Dagre Wiki](https://github.com/dagrejs/dagre/wiki) - layout algorithm details

---

### Pitfall 2: Module Hull Overlap Rendering Complexity

**What goes wrong:** When multiple modules contain overlapping entities, hull boundaries cross and intersect in confusing ways. Naive convex hull algorithms produce visually misleading boundaries. Z-ordering of overlapping regions is inconsistent.

**Why it happens:**
- Convex hulls can only represent convex shapes - modules with scattered entities produce hulls that include non-member nodes
- Multiple hulls intersecting create visual noise without clear semantics
- No standard algorithm for "multi-hull with meaningful overlaps"
- Entity membership in multiple modules creates ambiguous visual representation

**Consequences:**
- Users can't tell which entities belong to which modules
- Overlapping regions have unclear meaning
- Hull boundaries include white space that contains non-member entities
- Visual complexity defeats the purpose of grouping

**Warning signs:**
- Hulls containing large empty spaces
- More than 3 modules visible simultaneously creating "spaghetti" of boundaries
- No interaction affordance for hull regions
- Hulls computed without considering visual clustering

**Prevention:**
1. **Concave hulls or alpha shapes:** Use alpha shape algorithm instead of convex hull for tighter boundaries
2. **Layer-based display:** Only show one module hull at a time with toggle, not all simultaneously
3. **Heatmap alternative:** Use node coloring/icons instead of boundary hulls for multi-membership
4. **Interactive disambiguation:** On hover over intersection, highlight which modules claim the node
5. **Layout-aware grouping:** Influence dagre layout to cluster module members together before computing hulls
6. **Sutherland-Hodgman for intersections:** If showing overlaps, compute actual intersection polygons with [Sutherland-Hodgman](https://en.wikipedia.org/wiki/Sutherland%E2%80%93Hodgman_algorithm)

**Detection:**
- Visual review with real module data showing 3+ modules with entity overlaps
- User testing: "Which module does this entity belong to?"
- Measure hull "efficiency" - percentage of hull area actually containing member nodes

**Phase mapping:** Graph visualization phase, specifically the module overlay feature. Design decision needed early: hulls vs alternative representations.

**Sources:**
- [Convex Hull Algorithms - Wikipedia](https://en.wikipedia.org/wiki/Convex_hull_algorithms)
- [Clipping Convex Hulls with Sutherland-Hodgman](https://www.petecorey.com/blog/2019/07/29/clipping-convex-hulls-with-thing/)
- [yWorks Graph Clustering](https://www.yworks.com/pages/clustering-graphs-and-networks)

---

### Pitfall 3: Materialized View Staleness and Re-materialization Performance

**What goes wrong:** Precomputed relationship tables (category_property_effective, where_used) become stale after partial updates. Full re-materialization is too slow. Inconsistencies between canonical and materialized tables cause confusing query results.

**Why it happens:**
- PostgreSQL materialized views require complete refresh, not incremental updates (native feature)
- Trigger-based refresh causes INSERT/UPDATE statements to become drastically slower
- Inheritance chains mean a single category change can invalidate hundreds of computed relationships
- No built-in mechanism in Postgres for incremental materialized view maintenance

**Consequences:**
- "Effective properties" shown for a category don't match actual inheritance chain
- Re-materialization during draft editing causes multi-second delays
- Queries return different results depending on whether materialized view is fresh
- Users see stale data without knowing it

**Warning signs:**
- No timestamp tracking when materialized views were last refreshed
- Full table refresh on any change (instead of localized)
- Queries sometimes hitting materialized view, sometimes computing fresh
- No validation that materialized data matches computed-on-demand data

**Prevention:**
1. **Localized re-materialization:** Track dirty entities and only recompute affected rows, not full table
2. **Invalidation flags:** Mark rows as "potentially stale" immediately, refresh lazily
3. **Version stamps:** Every materialized row has source_version; queries filter for current version
4. **Async refresh with staleness indicator:** Show "computing..." while background job updates
5. **pg_ivm extension (if available):** Consider [pg_ivm](https://github.com/sraoss/pg_ivm) for incremental view maintenance
6. **Computed-on-demand fallback:** If materialized view is stale, compute from base tables with caching

**Detection:**
- Automated test: modify category parent, verify effective_properties updates within X seconds
- Compare materialized result vs computed-on-demand result
- Monitor materialized view refresh duration and frequency

**Phase mapping:** Foundation phase for database schema. Materialization strategy must be designed into schema from the start.

**Sources:**
- [PostgreSQL REFRESH MATERIALIZED VIEW](https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html)
- [Materialized Views in Postgres: Our Experience](https://senacor.blog/materialized-views-in-postgres-our-experience-and-insights/)
- [pg_ivm - Incremental View Maintenance](https://github.com/sraoss/pg_ivm)
- [PostgreSQL Wiki: Incremental View Maintenance](https://wiki.postgresql.org/wiki/Incremental_View_Maintenance)

---

### Pitfall 4: JSON Patch Array Index Instability

**What goes wrong:** JSON Patch operations on arrays use numeric indices that become invalid after insertions/deletions. Patches generated for one version of a document fail or produce wrong results when applied to a different version.

**Why it happens:**
- RFC 6902 specifies array operations by index: `/properties/3` refers to 4th element
- When element 2 is removed, element 3 becomes element 2 - stored patch now points to wrong element
- Diff generation is non-deterministic for arrays - equivalent transformations produce different patch sequences
- No semantic identity for array elements in standard JSON Patch

**Consequences:**
- Patches applied in wrong order corrupt data
- Concurrent edits on same array cause merge failures
- Test operations fail unexpectedly
- Generated patches work in dev but fail in production with different base state

**Warning signs:**
- Storing patches for later application (not immediate)
- Multiple users editing same draft
- Arrays with add/remove operations (not just updates)
- No objectHash function configured in diff library

**Prevention:**
1. **Avoid array-index patches:** Use replace on entire array for small arrays, or use object maps with stable keys
2. **objectHash for array diffing:** Configure jsondiffpatch with objectHash that uses entity IDs, not positions
3. **Apply patches immediately:** Don't store patches for later - apply at generation time
4. **Version-locked patches:** Store base version with patch; refuse to apply if base changed
5. **Test operation guards:** Include "test" operations before critical patches to verify expected state
6. **Hybrid approach:** Use JSON Patch only for object property changes; handle array changes differently

**Detection:**
- Test: generate patch, modify array in base, apply patch - should fail gracefully or produce correct result
- Review all array-type fields in schema for patch safety
- Concurrent edit testing with array modifications

**Phase mapping:** Draft system phase. Patch format decision affects entire draft storage and application logic.

**Sources:**
- [RFC 6902 - JSON Patch](https://www.rfc-editor.org/rfc/rfc6902.html)
- [jsondiffpatch - objectHash for arrays](https://github.com/benjamine/jsondiffpatch)
- [JSON Patch Array Operations Discussion](https://github.com/json-patch/json-patch2/issues/18)

---

### Pitfall 5: Draft Overlay Complexity Explosion

**What goes wrong:** Computing "effective" entity state (canonical + draft deltas) becomes exponentially complex when drafts modify entities that reference other modified entities. Circular dependencies in draft changes create infinite loops. "Phantom" entities (referenced but not yet created) break reference resolution.

**Why it happens:**
- Inheritance resolution requires walking parent chain - if parents are also modified, must merge patches recursively
- Property membership computation depends on category effective state, which depends on patches
- Deleted entities may still be referenced by other draft entities
- Forward references to entities that will be created in same draft

**Consequences:**
- "Effective properties" computation times out or hangs
- Validation reports wrong errors because it can't resolve draft state
- Users create drafts that can't be applied due to dependency cycles
- Order of entity creation in draft becomes significant (shouldn't be)

**Warning signs:**
- O(n^2) or worse complexity in effective state computation
- No cycle detection in draft reference resolution
- Draft changes applied in declaration order (not dependency order)
- Validation errors for valid but forward-referencing drafts

**Prevention:**
1. **Topological sort on apply:** Sort draft changes by dependency graph before applying
2. **Cycle detection:** Use TopologicalSorter (v1.0 already uses this) for circular reference detection
3. **Memoized effective state:** Cache computed effective state for each entity, invalidate on dependency change
4. **Two-pass validation:** First pass validates syntax, second pass validates with full effective state
5. **Explicit creation order:** If forward references exist, surface them to user for explicit ordering
6. **Limit draft scope:** Max entities per draft to bound complexity

**Detection:**
- Test: draft that modifies parent and child category together
- Test: draft that creates property and category referencing each other
- Profile effective state computation time with realistic draft sizes

**Phase mapping:** Draft system phase. Complexity bounds must be established in design.

**Sources:**
- [Python graphlib.TopologicalSorter](https://docs.python.org/3/library/graphlib.html) - v1.0 already uses this
- [Dependency Graph - Wikipedia](https://en.wikipedia.org/wiki/Dependency_graph)
- [Dependency Resolving Algorithm](https://www.electricmonk.nl/docs/dependency_resolving_algorithm/dependency_resolving_algorithm.html)

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or degraded user experience.

---

### Pitfall 6: Layout Instability (Nodes Jumping)

**What goes wrong:** Dagre layout produces different node positions when graph content changes slightly. Adding one node causes multiple unrelated nodes to shift position. Users lose mental map of graph structure.

**Why it happens:**
- Dagre orders nodes by ID within each rank/column
- Adding node with alphabetically-early ID shifts all later nodes
- Edge routing affects node positioning in unpredictable ways
- Dagre is deterministic but not stable (same input = same output, but small input change = large output change)

**Consequences:**
- Users can't track changes visually ("where did that node go?")
- Animation between states is jarring rather than smooth
- Comparison between draft and canonical becomes difficult
- Graph feels "alive" in unsettling way

**Warning signs:**
- Node positions significantly different after minor edit
- No animation/transition between layout states
- Using auto-generated node IDs instead of stable entity IDs

**Prevention:**
1. **Stable node IDs:** Use entity keys (categories/Person) not runtime-generated IDs
2. **Incremental layout algorithms:** Consider ElkJS which supports incremental layout hints
3. **Pin important nodes:** Allow users to fix positions of key nodes
4. **Smooth transitions:** Animate position changes rather than snapping
5. **Layout caching:** Store last-known-good positions, use as starting point for new layout
6. **Constrain rank changes:** When possible, keep node at same rank even if edges change

**Detection:**
- Visual comparison: layout before/after adding single node
- Measure total node movement distance for single-node additions
- User testing: "Can you find what changed?"

**Phase mapping:** Graph visualization phase. Layout algorithm choice affects entire graph UX.

**Sources:**
- [Dagre Node Ordering](https://medium.com/@angeloarcillas64/understanding-how-dagre-js-layout-works-ranker-network-simplex-5a4459c011c2)
- [ElkJS - Incremental Layout](https://www.eclipse.org/elk/)
- [React Flow Layouting Guide](https://reactflow.dev/learn/layouting/layouting)

---

### Pitfall 7: Draft Context Invalidation Cascade

**What goes wrong:** Changing canonical data while a draft exists invalidates draft context in unpredictable ways. Draft was valid when created but becomes invalid when base changes.

**Why it happens:**
- Draft stores deltas against specific canonical version
- Canonical can change (new commit) after draft created
- Merge conflicts not detected until PR creation
- Validation results from draft creation time become stale

**Consequences:**
- Draft shows as "valid" but PR fails with conflicts
- Validation must re-run on every canonical sync
- Users don't understand why previously-valid draft is now invalid
- Stale draft creates confusion about actual state

**Warning signs:**
- Draft stores changes without base version reference
- No automatic re-validation when canonical changes
- No "base version changed" indicator for users

**Prevention:**
1. **Version-pinned drafts:** Store canonical commit SHA with draft, clearly indicate when base changed
2. **Conflict detection on canonical update:** When canonical syncs, check all active drafts for conflicts
3. **Automatic re-validation:** Trigger validation job when canonical changes affect draft entities
4. **Visual indicator:** Show "base changed" warning with diff of what changed
5. **Rebase capability:** Allow user to "rebase" draft onto new canonical

**Detection:**
- Test: create draft, update canonical, verify draft shows "base changed"
- Test: draft modifying entity X, canonical also modifies X - detect conflict

**Phase mapping:** Draft system phase. Base version tracking is foundational.

---

### Pitfall 8: Phantom Entity References

**What goes wrong:** Draft creates entity A that references entity B. Entity B is also being created in same draft but processed later. Validation fails because B "doesn't exist" at validation time.

**Why it happens:**
- Reference validation checks against canonical + applied-so-far
- If B hasn't been applied yet, reference appears broken
- No concept of "will exist in this draft" vs "should already exist"

**Consequences:**
- Valid drafts rejected by validation
- Users must carefully order entity creation
- Bulk imports fail due to forward references
- Validation messages confusing ("Entity not found" for entity that's in the draft)

**Warning signs:**
- Validation order-dependent
- Draft changes processed sequentially without look-ahead
- Reference errors for entities that are in the draft

**Prevention:**
1. **Two-phase validation:** First gather all draft entities into "pending" set, then validate references against canonical + pending
2. **Draft entity index:** Build index of all entities in draft before validating references
3. **Clear error messages:** "Entity B referenced but not yet created - will be created in this draft" vs "Entity B does not exist"
4. **Dependency graph validation:** Before reference validation, verify draft is internally consistent

**Detection:**
- Test: draft creating A referencing B, and B in same draft
- Test: circular reference A -> B -> A within single draft

**Phase mapping:** Validation phase. Two-phase approach needed from design.

---

### Pitfall 9: Migration Feature Parity Gaps

**What goes wrong:** Rebuild loses features that existed in v1.0. Users report regression. "Simple" features turn out to have edge cases only discovered after launch.

**Why it happens:**
- v1.0 accumulated features over time, some undocumented
- Rebuild team assumes they understand all features
- Testing against new implementation, not against v1.0 behavior
- Edge cases handled in v1.0 code not obvious from reading it

**Consequences:**
- User complaints about missing features
- Parallel running v1.0 and v2.0 extends timeline
- Emergency patches to add forgotten features
- Trust erosion with existing users

**Warning signs:**
- No comprehensive v1.0 feature audit
- Testing only new code, not comparing to old code output
- Assumptions about v1.0 behavior not verified
- No user acceptance testing before cutover

**Prevention:**
1. **Feature audit:** Document every v1.0 feature with test cases
2. **Behavior comparison testing:** For each API endpoint, compare v1.0 and v2.0 responses
3. **User shadow testing:** Route % of traffic to v2.0, compare results
4. **Incremental rollout:** Soft launch with rollback capability
5. **v1.0 code review:** Read v1.0 implementation for each feature being rebuilt
6. **Edge case documentation:** For each v1.0 feature, document known edge cases

**Detection:**
- Feature matrix: v1.0 features vs v2.0 coverage
- API response diff testing
- User acceptance testing with v1.0 power users

**Phase mapping:** Every phase. Feature parity tracking throughout rebuild.

**Sources:**
- [Google Cloud: Database Migration Concepts](https://cloud.google.com/architecture/database-migration-concepts-principles-part-1)
- [Data Migration Challenges](https://www.datafold.com/blog/data-migration-challenges)

---

### Pitfall 10: Data Migration Schema Mismatch

**What goes wrong:** v1.0 data structures don't map cleanly to v2.0 schema. Migration script handles happy path but fails on edge cases. Production data has inconsistencies that test data didn't.

**Why it happens:**
- v2.0 schema designed without examining all v1.0 data variations
- Test data doesn't cover v1.0 edge cases
- v1.0 schema evolved over time with legacy artifacts
- Nullable fields, missing data, encoding issues

**Consequences:**
- Migration fails partway through, leaving inconsistent state
- Migrated data looks correct but has subtle corruption
- Edge case entities lost or incorrectly transformed
- Rollback difficult once migration started

**Warning signs:**
- Migration tested only on fresh data, not production dump
- No data validation step after migration
- Schema changes that lose information
- No rollback plan

**Prevention:**
1. **Production data analysis:** Profile actual v1.0 data before designing v2.0 schema
2. **Reversible migration:** Design migration that can be rolled back
3. **Validation step:** Post-migration validation comparing counts, checksums
4. **Feature flags:** Run v1.0 and v2.0 in parallel, switch via feature flag
5. **Incremental migration:** Migrate in batches with verification between batches
6. **Data integrity constraints:** v2.0 schema should enforce invariants v1.0 allowed to violate

**Detection:**
- Run migration on production data copy, compare pre/post statistics
- Query for NULL values, empty strings, unexpected types
- Spot-check sample of migrated entities

**Phase mapping:** Foundation phase (schema design) and dedicated migration phase.

---

## Minor Pitfalls

Mistakes that cause annoyance, edge-case bugs, or minor technical debt.

---

### Pitfall 11: Capability URL Token Leakage (carried from v1.0)

**What goes wrong:** Bearer tokens embedded in URLs leak through multiple vectors: server logs, Referer headers, browser history, and redirect chains.

**v2.0 consideration:** v1.0 already uses fragment-based tokens. Verify this pattern is preserved in rebuild.

**Prevention:**
1. Fragment-based tokens (`#token=xyz`) - already implemented in v1.0
2. Verify no logging of URL fragments
3. Verify OAuth redirects don't leak fragments

**Phase mapping:** All phases - maintain v1.0 security patterns.

---

### Pitfall 12: GitHub Rate Limit Exhaustion (carried from v1.0)

**What goes wrong:** Application hits GitHub rate limits during sync or PR creation.

**v2.0 consideration:** Full rebuild sync may be more aggressive than incremental v1.0 sync.

**Prevention:**
1. Caching of GitHub responses
2. Conditional requests (If-None-Match)
3. Rate limit monitoring before hitting limit
4. Batch GraphQL queries instead of multiple REST calls

**Phase mapping:** GitHub integration phase.

---

### Pitfall 13: Validation False Positives (carried from v1.0)

**What goes wrong:** Breaking change detection flags non-breaking changes, eroding trust.

**v2.0 consideration:** New effective property computation may change validation results.

**Prevention:**
1. Compare v2.0 validation results to v1.0 for same inputs
2. Tiered severity levels
3. User acknowledgment workflow

**Phase mapping:** Validation phase.

---

## Phase-Specific Warnings

| Phase | Topic | Likely Pitfall | Mitigation | Priority |
|-------|-------|----------------|------------|----------|
| Foundation | Materialized views | Staleness and refresh performance | Localized re-materialization, version stamps | CRITICAL |
| Foundation | Schema design | v1.0 data doesn't fit v2.0 schema | Production data analysis before design | HIGH |
| Draft System | JSON Patch | Array index instability | objectHash, version-locked patches, hybrid approach | CRITICAL |
| Draft System | Effective state | Complexity explosion with nested changes | Topological sort, memoization, cycle detection | CRITICAL |
| Draft System | Base version | Draft invalidation on canonical change | Version-pinned drafts, conflict detection | HIGH |
| Draft System | Phantom entities | Forward reference validation failure | Two-phase validation, draft entity index | MEDIUM |
| Graph | Performance | Janky rendering with 100+ nodes | Memoization, stable IDs, virtualization | CRITICAL |
| Graph | Layout stability | Nodes jumping on changes | Stable IDs, layout caching, smooth transitions | HIGH |
| Graph | Module hulls | Overlap confusion | Layer-based display, concave hulls, disambiguation | MEDIUM |
| Validation | Reference resolution | Errors for entities in draft | Two-phase validation | MEDIUM |
| Migration | Feature parity | Missing v1.0 features | Comprehensive feature audit, behavior comparison | HIGH |
| Migration | Data integrity | Production data doesn't migrate cleanly | Production data profiling, validation step | HIGH |

---

## Prevention Strategy Summary

### Performance Pitfalls
- **Graph rendering:** Memoize components, stable IDs, debounce expensive operations, consider virtualization
- **Materialized views:** Localized refresh, async with staleness indicator, pg_ivm if available
- **Effective state computation:** Memoization, complexity bounds, cycle detection

### Data Integrity Pitfalls
- **JSON Patch:** Avoid array index operations, use objectHash, version-lock patches
- **Draft context:** Pin to canonical version, detect conflicts on base change
- **Migration:** Production data analysis, validation step, rollback plan

### UX Pitfalls
- **Layout stability:** Stable node IDs, smooth transitions, constrain rank changes
- **Module hulls:** One-at-a-time display, interactive disambiguation
- **Feature parity:** Comprehensive audit, behavior comparison testing

---

## Confidence Assessment

| Area | Confidence | Reasoning |
|------|------------|-----------|
| Graph Performance | HIGH | React Flow official docs, GitHub discussions with similar issues |
| JSON Patch Arrays | HIGH | RFC 6902 specification, jsondiffpatch documentation |
| Materialized Views | HIGH | PostgreSQL documentation, multiple implementation experience reports |
| Layout Stability | MEDIUM | Dagre documentation, but algorithm details less documented |
| Module Hull Rendering | MEDIUM | Algorithm research exists, specific UX recommendations less clear |
| Draft Complexity | MEDIUM | General CS concepts apply, specific to this domain |
| Migration Parity | HIGH | Common pattern, well-documented approaches |

---

## Sources

### Graph Visualization
- [React Flow Performance Guide](https://reactflow.dev/learn/advanced-use/performance)
- [React Flow Layout Discussion #2973](https://github.com/xyflow/xyflow/discussions/2973)
- [React Flow Large Graph Discussion #4975](https://github.com/xyflow/xyflow/discussions/4975)
- [Dagre GitHub Wiki](https://github.com/dagrejs/dagre/wiki)

### JSON Patch
- [RFC 6902 - JSON Patch](https://www.rfc-editor.org/rfc/rfc6902.html)
- [jsondiffpatch GitHub](https://github.com/benjamine/jsondiffpatch)
- [JSON Patch Overview](https://jsonpatch.com/)

### Materialized Views
- [PostgreSQL REFRESH MATERIALIZED VIEW](https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html)
- [Materialized Views in Postgres Experience](https://senacor.blog/materialized-views-in-postgres-our-experience-and-insights/)
- [pg_ivm Extension](https://github.com/sraoss/pg_ivm)

### Graph Algorithms
- [Convex Hull Algorithms - Wikipedia](https://en.wikipedia.org/wiki/Convex_hull_algorithms)
- [Network Clustering with KeyLines](https://cambridge-intelligence.com/keylines-network-clustering/)
- [Dependency Graph - Wikipedia](https://en.wikipedia.org/wiki/Dependency_graph)

### Migration
- [Google Cloud Database Migration](https://cloud.google.com/architecture/database-migration-concepts-principles-part-1)
- [Data Migration Challenges - Datafold](https://www.datafold.com/blog/data-migration-challenges)
