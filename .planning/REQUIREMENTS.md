# Requirements: Ontology Hub

**Defined:** 2025-01-20
**Core Value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Browsing

- [ ] **BRWS-01**: User can view entity detail page for any category, property, or subobject
- [ ] **BRWS-02**: User can search entities by name, description, and field definitions
- [ ] **BRWS-03**: User can view inheritance graph for categories (parent/child relationships)
- [ ] **BRWS-04**: User can see "used by" references (which categories use which properties/subobjects)
- [ ] **BRWS-05**: Entity pages show ID, label, description, module membership, and schema definition

### Modules and Profiles

- [ ] **MODL-01**: User can browse list of modules with included entities and dependencies
- [ ] **MODL-02**: User can browse list of profiles with module composition
- [ ] **MODL-03**: User can view module dependency visualization (which modules depend on which)
- [ ] **MODL-04**: Module pages show overlap warnings when entities appear in multiple modules

### Versioning

- [ ] **VERS-01**: User can view list of releases with dates and version labels
- [ ] **VERS-02**: User can view field-level diff between any two versions
- [ ] **VERS-03**: Diffs categorize changes by entity type and change type (add/modify/delete)

### Draft System

- [ ] **DRFT-01**: Platform accepts draft proposals via POST API (no auth required)
- [ ] **DRFT-02**: Drafts are accessible only via capability URL (token-protected)
- [ ] **DRFT-03**: Drafts expire automatically after TTL (default 7 days)
- [ ] **DRFT-04**: Draft review UI shows field-level diffs grouped by entity type
- [ ] **DRFT-05**: User can assign new entities to modules during draft review
- [ ] **DRFT-06**: User can create/edit module membership (categories only) as part of draft
- [ ] **DRFT-07**: User can create/edit profile module lists as part of draft
- [ ] **DRFT-08**: Module/profile editing shows dependency feedback (missing deps, redundancy)

### Validation

- [ ] **VALD-01**: Validation checks that referenced IDs exist (parents, properties, module members)
- [ ] **VALD-02**: Validation detects circular category inheritance
- [ ] **VALD-03**: Validation checks datatypes are in allowed set
- [ ] **VALD-04**: Validation detects breaking changes (datatype changes, multiplicity changes, removals)
- [ ] **VALD-05**: Validation suggests semver classification (major/minor/patch) per change
- [ ] **VALD-06**: Validation feedback displays inline in draft review UI

### GitHub Integration

- [ ] **GHUB-01**: GitHub OAuth login triggered only when user clicks "Open PR"
- [ ] **GHUB-02**: Platform creates branch, commits changes, and opens PR via GitHub API
- [ ] **GHUB-03**: PR body includes structured summary of changes categorized by type
- [ ] **GHUB-04**: PR body includes validation report and suggested semver bump
- [ ] **GHUB-05**: PR body references originating wiki and base schema version (if provided)

### Infrastructure

- [ ] **INFR-01**: Platform runs as Docker container for local development
- [ ] **INFR-02**: Platform indexes GitHub repo content for browsing
- [ ] **INFR-03**: Rate limiting on draft creation (per IP)
- [ ] **INFR-04**: Capability tokens never logged; stored as hashes only

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Export

- **EXPT-01**: User can download entity/module/profile as JSON
- **EXPT-02**: User can download artifact bundles for SemanticSchemas consumption

### Enhanced Browsing

- **BRWS-06**: Interactive graph visualization (WebVOWL-style, click-to-navigate)
- **BRWS-07**: Faceted search with filters by entity type, module, version

### Draft Enhancements

- **DRFT-09**: Canonical vs local overlay toggle for each change
- **DRFT-10**: Download patch file from draft

### Advanced Visualization

- **MODL-05**: Profile coverage matrix (visual comparison of profiles)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Platform user accounts | GitHub OAuth at PR-time is sufficient; accounts add friction and maintenance |
| Social features (comments, likes) | GitHub is the discussion venue; platform is for schema, not community |
| Schema creation from scratch | MediaWiki is the authoring tool; platform is for review and PR |
| Mobile-first design | Desktop workflow; responsive enough to not break but not optimized |
| Notification system | Requires accounts; users watch GitHub repo instead |
| Real-time collaborative editing | Overkill for ephemeral drafts; adds significant complexity |
| Query execution (SPARQL) | Out of scope per original spec; high complexity |
| Multiple schema formats | SemanticSchemas JSON only; no Avro/Protobuf/OWL |
| Draft history/undo | Drafts are ephemeral with TTL; create new draft if needed |

## Design Notes

### Module/Profile Entity Inclusion

- Modules explicitly include **categories** only
- Properties and subobjects are **transitively included** based on category dependencies
- UI shows all entity types for browsing, but editing is restricted to category membership
- This simplifies the mental model: "modules contain categories, categories define what properties/subobjects they need"

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (Populated during roadmap creation) | | |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 0
- Unmapped: 25 ⚠️

---
*Requirements defined: 2025-01-20*
*Last updated: 2025-01-20 after initial definition*
