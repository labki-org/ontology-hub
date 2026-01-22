---
phase: 03-entity-browsing
plan: 03
subsystem: relationships
tags: [react-flow, dagre, inheritance, used-by, graph-visualization]

# Dependency graph
requires:
  - phase: 03-01
    provides: Frontend entity pages with TanStack Query
provides:
  - Inheritance graph visualization for categories
  - Used-by references for properties and subobjects
  - Graph explorer page with full inheritance view
  - Clickable graph nodes for navigation
affects: [05-draft-system]

# Tech tracking
tech-stack:
  added: [@xyflow/react@12, @dagrejs/dagre@1]
  patterns: [React Flow custom nodes, dagre hierarchical layout, JSONB string contains query]

key-files:
  created:
    - backend/app/services/inheritance.py
    - frontend/src/components/graph/InheritanceGraph.tsx
    - frontend/src/components/graph/CategoryNode.tsx
    - frontend/src/components/graph/useGraphLayout.ts
    - frontend/src/components/entity/UsedByList.tsx
    - frontend/src/pages/GraphExplorerPage.tsx
  modified:
    - backend/app/routers/entities.py
    - backend/app/schemas/entity.py
    - backend/app/services/__init__.py
    - backend/tests/test_entities_api.py
    - frontend/package.json
    - frontend/src/api/entities.ts
    - frontend/src/api/types.ts
    - frontend/src/pages/CategoryPage.tsx
    - frontend/src/pages/PropertyPage.tsx
    - frontend/src/pages/SubobjectPage.tsx
    - frontend/src/App.tsx

key-decisions:
  - "nodeTypes defined outside component - prevents React Flow re-render performance issues"
  - "cast to String for JSONB contains - cross-database compatibility (SQLite tests, PostgreSQL prod)"
  - "TB (top-to-bottom) layout - parents above children in hierarchy"
  - "compact prop for mini graph - controls visibility in category page section"

patterns-established:
  - "useInheritance(entityId) hook for inheritance graph data"
  - "useUsedBy(entityType, entityId) hook for property/subobject usage"
  - "Query keys: ['inheritance', entityId], ['used-by', type, id]"

# Metrics
duration: 10min
completed: 2026-01-22
---

# Phase 03 Plan 03: Inheritance Graph and Used-By References Summary

**React Flow inheritance graph visualization with dagre layout, used-by reference lists showing categories using properties/subobjects**

## Performance

- **Duration:** 10 min
- **Started:** 2026-01-22T02:36:56Z
- **Completed:** 2026-01-22T02:47:00Z
- **Tasks:** 3
- **Files created:** 6
- **Files modified:** 13

## Accomplishments

- Created inheritance resolution service that traverses parent chain and finds direct children
- Added GET /entities/category/{id}/inheritance endpoint returning nodes/edges for React Flow
- Added GET /entities/{type}/{id}/used-by endpoint returning categories using a property/subobject
- Built InheritanceGraph component with dagre hierarchical layout (parents above children)
- Created CategoryNode custom node with click-to-navigate behavior
- Built GraphExplorerPage for full-page graph exploration
- Added mini inheritance graph section to CategoryPage with link to full view
- Created UsedByList component showing categories using a property/subobject
- Updated PropertyPage and SubobjectPage to show actual used-by data

## Task Commits

1. **Task 1: Backend inheritance and used-by endpoints** - `5c2771e` (feat)
2. **Task 2: React Flow graph visualization** - `66026cf` (feat)
3. **Task 3: Used-by references component** - `4791799` (feat)

## Files Created/Modified

### Backend
- `backend/app/services/inheritance.py` - Inheritance chain resolution with cycle detection
- `backend/app/schemas/entity.py` - InheritanceNode, InheritanceEdge, InheritanceResponse schemas
- `backend/app/routers/entities.py` - /inheritance and /used-by endpoints
- `backend/tests/test_entities_api.py` - 12 new tests for inheritance and used-by

### Frontend
- `frontend/src/components/graph/InheritanceGraph.tsx` - React Flow graph with dagre layout
- `frontend/src/components/graph/CategoryNode.tsx` - Custom node with navigation
- `frontend/src/components/graph/useGraphLayout.ts` - Dagre layout helper
- `frontend/src/components/entity/UsedByList.tsx` - Used-by category list
- `frontend/src/pages/GraphExplorerPage.tsx` - Full-page graph view
- `frontend/src/pages/CategoryPage.tsx` - Added inheritance section
- `frontend/src/pages/PropertyPage.tsx` - Added UsedByList
- `frontend/src/pages/SubobjectPage.tsx` - Added UsedByList
- `frontend/src/api/entities.ts` - useInheritance, useUsedBy hooks
- `frontend/src/api/types.ts` - InheritanceResponse types
- `frontend/src/App.tsx` - /graph/:entityId route

## Decisions Made

1. **nodeTypes outside component** - React Flow requires nodeTypes defined outside to prevent re-registration on every render
2. **Cast to String for JSONB contains** - SQLite and PostgreSQL handle JSONB differently; casting to string enables cross-db compatibility
3. **TB (top-to-bottom) direction** - Standard hierarchical layout with parents above children
4. **compact prop** - Mini graph on category page hides controls, full explorer page shows them

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed JSONB contains query for cross-database compatibility**
- **Found during:** Task 1 test verification
- **Issue:** PostgreSQL's `schema_definition[field].contains([id])` doesn't work in SQLite tests
- **Fix:** Changed to `cast(schema_definition[field], String).contains('"entity_id"')` for text-based matching
- **Files modified:** backend/app/routers/entities.py
- **Verification:** All 39 tests pass

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor query syntax adjustment. No scope creep.

## Issues Encountered

- React Flow requires CSS import (`@xyflow/react/dist/style.css`) for proper rendering
- Container must have explicit height for React Flow to render
- Dagre returns center position; must convert to top-left for React Flow

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Entity browsing complete with inheritance graphs and used-by references
- Phase 3 (Entity Browsing) fully complete
- Ready for Phase 4 (Schema Validation) or Phase 5 (Draft System)
- Graph infrastructure can be extended for future features

---
*Phase: 03-entity-browsing*
*Completed: 2026-01-22*
