---
phase: 22-entity-lifecycle-fixes
plan: 01
subsystem: api
tags: [react-query, graph, cache-invalidation, draft-overlay]

# Dependency graph
requires:
  - phase: 20-entity-management
    provides: Entity creation mutation hooks
  - phase: 18-graph-visualization
    provides: Graph query service and neighborhood traversal
provides:
  - Graph cache invalidation on entity mutations
  - Isolated draft-created entity handling in graph queries
affects: [22-02, entity-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Broad query key invalidation for graph refresh"
    - "Early return for isolated draft nodes in graph queries"

key-files:
  created: []
  modified:
    - frontend/src/api/draftApiV2.ts
    - backend/app/services/graph_query.py

key-decisions:
  - "Use broad ['graph'] invalidation to catch all graph query variants"
  - "Return early with single-node graph for isolated draft entities"

patterns-established:
  - "Graph cache invalidation: invalidateQueries(['graph']) after entity mutations"
  - "Isolated draft node handling: check draft_creates when CTE returns no rows"

# Metrics
duration: 8min
completed: 2026-01-25
---

# Phase 22 Plan 01: Graph Cache Invalidation Summary

**Graph auto-refreshes on entity mutations, isolated draft-created entities render as single nodes with 'added' badge**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-25T08:30:00Z
- **Completed:** 2026-01-25T08:38:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Graph view automatically refreshes when entities are created, deleted, or restored
- Isolated draft-created entities (no parents/relationships) appear as single nodes instead of "No graph data"
- All draft-created entities show "added" change_status badge in graph view
- Closes BUG-001 from v2.1 audit

## Task Commits

Each task was committed atomically:

1. **Task 1: Add graph cache invalidation to entity mutations** - `37c1b3c` (feat)
2. **Task 2: Handle isolated draft-created entities in graph query** - `c7d6193` (feat)

## Files Created/Modified
- `frontend/src/api/draftApiV2.ts` - Added graph cache invalidation to useCreateEntityChange, useDeleteEntityChange, and useUndoDeleteChange
- `backend/app/services/graph_query.py` - Added isolated draft node handling when CTE returns no rows (GRAPH-05)

## Decisions Made
- **Broad graph invalidation:** Used `['graph']` query key to invalidate all graph query variants without needing specific entity keys
- **Early return pattern:** Return single-node GraphResponse immediately when draft entity is isolated, avoiding unnecessary processing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in unrelated files (DraftDiffViewerV2.tsx, hullStore.ts) prevented full build verification but are not related to this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Graph view now properly reflects all entity mutations
- Ready for Plan 02 (delete functionality fixes for newly created entities)
- GRAPH-05 concern resolved

---
*Phase: 22-entity-lifecycle-fixes*
*Completed: 2026-01-25*
