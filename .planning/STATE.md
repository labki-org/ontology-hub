# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-23)

**Core value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.
**Current focus:** Phase 14 - Validation + Workflow + PR

## Current Position

Phase: 14 of 14 (Validation + Workflow + PR)
Plan: 5 of 10 in current phase
Status: In progress
Last activity: 2026-01-25 -- Completed 14-05-PLAN.md

Progress: [##########################] 98% (v1.0 complete, v2.0 phases 8-13 complete, phase 14: 5/10 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 50 (20 v1.0 + 30 v2.0)
- Average duration: ~30 min (v1.0 estimate)
- Total execution time: ~11h 33m

**By Phase (v2.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 08-database-foundation | 3/3 | 9m | 3m |
| 09-ingest-pipeline | 4/4 | 9m | 2m |
| 10-query-layer | 3/3 | 9m | 3m |
| 11-draft-system | 5/5 | 16m | 3m |
| 12-frontend-graph-visualization | 6/6 | 15m | 2m |
| 13-entity-detail-pages | 9/9 | 36m | 4m |
| 14-validation-workflow-pr | 5/10 | 12m | 2m |

**Recent Trend:**
- v1.0 completed in 2 days
- v2.0 phase 8 plan 1: 3 minutes
- v2.0 phase 8 plan 2: 2 minutes
- v2.0 phase 8 plan 3: 4 minutes
- v2.0 phase 9 plan 1: 2 minutes
- v2.0 phase 9 plan 2: 2 minutes
- v2.0 phase 9 plan 3: 2 minutes
- v2.0 phase 9 plan 4: 3 minutes
- v2.0 phase 10 plan 1: 3 minutes
- v2.0 phase 10 plan 2: 4 minutes
- v2.0 phase 10 plan 3: 2 minutes
- v2.0 phase 11 plan 1: 4 minutes
- v2.0 phase 11 plan 2: 4 minutes
- v2.0 phase 11 plan 3: 2 minutes
- v2.0 phase 11 plan 4: 4 minutes
- v2.0 phase 11 plan 5: 2 minutes (gap closure)
- v2.0 phase 12 plan 1: 2 minutes (frontend infrastructure)
- v2.0 phase 12 plan 2: 1 minute (graph stores + API client)
- v2.0 phase 12 plan 3: 3 minutes (sidebar & draft UI)
- v2.0 phase 12 plan 4: 2 minutes (force-directed graph canvas)
- v2.0 phase 12 plan 5: 2 minutes (module hull overlays)
- v2.0 phase 12 plan 6: 3 minutes (unified browse/draft integration)
- v2.0 phase 13 plan 1: 5 minutes (entity detail infrastructure)
- v2.0 phase 13 plan 2: 3 minutes (entity form components)
- v2.0 phase 13 plan 3: 7 minutes (entity detail modal infrastructure)
- v2.0 phase 13 plan 4: 4 minutes (category detail page)
- v2.0 phase 13 plan 5: 5 minutes (property and subobject detail pages)
- v2.0 phase 13 plan 6: 5 minutes (module and bundle detail pages)
- v2.0 phase 13 plan 7: 4 minutes (template detail page)
- v2.0 phase 13 plan 8: 4 minutes (browse integration with modal)
- v2.0 phase 13 plan 9: 3 minutes (gap closure: ModuleDetail + BundleDetail edit mode)
- v2.0 phase 14 plan 1: 4 minutes (v2 validation service)
- v2.0 phase 14 plan 2: 1 minute (draft workflow transitions)
- v2.0 phase 14 plan 3: 1 minute (validation endpoint)
- v2.0 phase 14 plan 4: 2 minutes (PR builder v2 services)
- v2.0 phase 14 plan 5: 4 minutes (PR submission endpoint)

*Metrics updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.0 start]: Full rebuild approach -- replace v1.0 implementation completely, reuse working code where appropriate
- [v2.0 start]: Hybrid patch format -- JSON Patch for updates, full replacement for creates
- [v2.0 start]: Materialized inheritance tables -- precompute category_property_effective at ingest
- [Phase 8 context]: Latest-only versioning -- Ontology Hub retains only current version; labki-schemas repo is the version archive
- [Phase 8 context]: Webhook-triggered ingest -- repo push triggers ingest, no manual refresh
- [Phase 8 context]: Draft auto-rebase -- when new canonical is ingested, in-progress drafts rebase automatically
- [Phase 8 context]: GitHub Actions version bumping -- auto-generate tarballs and bump semver on PR merge
- [08-01]: Unique constraint on entity_key per table rather than composite key
- [08-01]: OntologyVersion stored as table (not singleton) for flexibility
- [08-01]: Entity model pattern: Base -> Table -> Public for all entity types
- [08-02]: Foreign keys use plural table names (categories.id, not category.id)
- [08-02]: ModuleEntity uses entity_key for polymorphic membership across 6 entity types
- [08-02]: CategoryPropertyEffective is read-only SQLModel for materialized view queries
- [08-03]: Draft uses singular table name (draft) matching model convention
- [08-03]: New enums use _v2 suffix (draftstatus_v2) to avoid collision with v1.0
- [08-03]: Rebase tracking fields stored as strings for flexibility
- [09-01]: Used requirements.txt instead of pyproject.toml for dependencies (project convention)
- [09-02]: PendingRelationship uses extra dict for type-specific fields (is_required, entity_type)
- [09-02]: Parse methods return tuple of (entity, relationships) for types with relationships
- [09-03]: FK deletion order: relationships first, then entities, then OntologyVersion
- [09-03]: Entities flushed for UUID generation before relationship resolution
- [09-03]: Mat view refresh in separate transaction after main commit
- [09-04]: Keep v1.0 trigger_sync_background for backward compatibility
- [09-04]: Mark drafts stale only for DRAFT and VALIDATED statuses
- [10-01]: Application-layer overlay computation using Python jsonpatch library
- [10-01]: deepcopy before applying JSON Patch to avoid mutating cached data
- [10-01]: validation_alias for underscore-prefixed fields (_change_status -> change_status)
- [10-02]: Closure computed via recursive CTEs rather than application-layer graph traversal
- [10-02]: Module closure returns ancestor categories; bundle closure returns dependent modules
- [10-02]: Draft-created entities have empty closure (no canonical relationships yet)
- [10-03]: Path array in recursive CTE prevents infinite loops from circular inheritance
- [10-03]: Cycle detection uses separate CTE query with has_cycle flag propagation
- [11-01]: Separate Pydantic schemas from SQLModel models for API contract decoupling
- [11-01]: Return 503 when no OntologyVersion exists (graceful handling of empty database)
- [11-01]: VALIDATED->DRAFT transition allowed for rework scenarios
- [11-02]: JSON Patch validation via jsonpatch.JsonPatch constructor
- [11-02]: Entity existence check: UPDATE/DELETE require canonical entity, CREATE requires entity not exist
- [11-02]: Changes only allowed when draft status is DRAFT
- [11-03]: Original draft_change.patch never modified during rebase - preserves for manual resolution
- [11-03]: Deprecated mark_drafts_stale (kept for backward compatibility)
- [11-04]: Explicit action field on MediaWiki changes (not inferred from entity existence)
- [11-04]: Each MediaWiki push creates NEW draft (not appended to existing)
- [11-05]: Draft-aware inheritance via recursive parent walk with visited set
- [11-05]: Empty list from get_draft_aware_inherited_properties signals fallback to canonical
- [12-01]: Use d3-force@3.0.0 (not v7) to avoid breaking changes
- [12-01]: Vertical split layout: graph top (60%), detail bottom (40%)
- [12-01]: Persist panel sizes via localStorage with autoSaveId='browse-layout'
- [12-01]: Separate v2 API hooks file for clean separation from v1 hooks
- [12-03]: EntitySearch component with live filtering and 150ms debounce
- [12-03]: Draft title uses wiki_url from payload or falls back to draft ID
- [12-03]: Simple dropdown pattern for DraftSelector (no Radix popover needed)
- [12-03]: Change badges use green/yellow/red with +/~/- symbols
- [12-05]: Expand hull by padding from centroid before computing convex hull
- [12-05]: Empty visibleModules Set means show all (default behavior)
- [12-05]: 12-color Tailwind-inspired palette with hash-based assignment
- [12-05]: Position ModuleHullControls below GraphControls in top-right
- [12-06]: EntityDetailPanel focuses on categories initially (other entity types in Phase 13)
- [12-06]: BrowsePage syncs entity selection bidirectionally with URL
- [12-06]: Draft mode activated purely via URL parameter (no global state)
- [12-06]: /browse route separate from / to maintain v1 backward compatibility
- [13-01]: useAutoSave uses request ID tracking to handle race conditions from rapid edits
- [13-01]: 500ms debounce default for auto-save balances responsiveness and API load
- [13-01]: EntityDetailV2 union type enables type-safe entity detail discrimination
- [13-02]: VisualChangeMarker uses yellow shading + left border for modified fields per CONTEXT.md
- [13-02]: ESC key reverts field to original value in edit mode
- [13-02]: Enter key saves single-line inputs (multiline uses Textarea without Enter-to-save)
- [13-03]: Edit mode toggle only shown when draft context is active (draftId present)
- [13-03]: Breadcrumb navigation allows clicking back through entity chain
- [13-03]: AccordionSection with count badge for collapsible sections
- [13-03]: Node types added to tsconfig for NodeJS.Timeout support
- [13-04]: PropertiesSection groups inherited properties by source category with depth info
- [13-04]: Type guard used to narrow union type from useCategory hook
- [13-04]: Parents rendered as clickable badges for navigation
- [13-05]: Select component for enum-like fields (datatype, cardinality) provides better UX than text input
- [13-05]: Property where-used shows categories using the property with change status badges
- [13-05]: Subobject where-used placeholder since backend API doesn't exist yet
- [13-06]: Closure visualization separates direct members from transitive dependencies
- [13-06]: Entity grouping by type with count badges for clarity
- [13-06]: Version information section only shown in draft context (when draftId present)
- [13-08]: Double-click on EntityDetailPanel opens entity in full detail modal
- [13-08]: Maximize2 button provides explicit affordance for opening detail modal
- [13-08]: Modal and panel coexist - panel for quick preview, modal for full detail and editing
- [13-08]: openDetail from detailStore is the canonical way to navigate to entity detail modal
- [13-09]: EntityHeader component pattern for consistent header layout across all detail pages
- [13-09]: ModuleDetail and BundleDetail upgraded from view-only stubs to full edit mode
- [14-01]: ValidationResultV2 uses entity_key field (not entity_id) to match v2 model
- [14-01]: JSON Schema validation loads _schema.json from GitHub canonical repo
- [14-01]: Effective entity reconstruction pattern: load canonical, apply CREATE/UPDATE/DELETE changes
- [14-01]: Validation pipeline includes JSON Schema validation against _schema.json definitions
- [14-01]: Datatype validation reuses ALLOWED_DATATYPES from v1 validation
- [14-03]: Validation endpoint returns full report even when validation fails (transparency)
- [14-03]: Terminal status drafts (SUBMITTED/MERGED/REJECTED) cannot be re-validated (400 error)
- [14-03]: Rebase conflicts add warning to report without blocking validation
- [14-05]: Re-validate draft before PR creation to ensure canonical hasn't changed
- [14-05]: OAuth flow accepts pr_title and user_comment as query params stored in session
- [14-05]: Submit endpoint uses token from request body (not OAuth session)
- [14-05]: OAuth callback uses v2 services: build_files_from_draft_v2, generate_pr_body_v2

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-01-25
Stopped at: Completed plan 14-05 (PR submission endpoint)
Resume file: None
