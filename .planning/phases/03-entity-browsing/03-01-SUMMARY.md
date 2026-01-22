---
phase: 03-entity-browsing
plan: 01
subsystem: ui
tags: [react, vite, tanstack-query, shadcn-ui, react-router, tailwind]

# Dependency graph
requires:
  - phase: 02-github-integration
    provides: Entity API endpoints with cursor pagination
provides:
  - React frontend with entity browsing pages
  - TanStack Query API layer with entity hooks
  - Sidebar navigation with collapsible entity tree
  - Detail pages for categories, properties, subobjects
  - Structured schema table display (not raw JSON)
affects: [03-02-search, 03-03-relationships, 05-draft-system]

# Tech tracking
tech-stack:
  added: [react@19, vite@7, @tanstack/react-query@5, react-router-dom@7, shadcn-ui, tailwindcss@4, lucide-react]
  patterns: [TanStack Query hooks, React Router nested routes, shadcn/ui components]

key-files:
  created:
    - frontend/src/App.tsx
    - frontend/src/main.tsx
    - frontend/src/api/client.ts
    - frontend/src/api/entities.ts
    - frontend/src/api/types.ts
    - frontend/src/components/layout/Sidebar.tsx
    - frontend/src/components/layout/MainLayout.tsx
    - frontend/src/components/entity/EntityDetail.tsx
    - frontend/src/components/entity/SchemaTable.tsx
    - frontend/src/components/entity/PropertyList.tsx
    - frontend/src/pages/HomePage.tsx
    - frontend/src/pages/CategoryPage.tsx
    - frontend/src/pages/PropertyPage.tsx
    - frontend/src/pages/SubobjectPage.tsx
  modified:
    - docker-compose.yml

key-decisions:
  - "5min stale, 30min gc for TanStack Query - balance freshness with caching"
  - "Nested routes with MainLayout outlet - consistent sidebar across all pages"
  - "useAllEntitiesByType fetches all three types in parallel for sidebar"
  - "Structured SchemaTable component - displays fields by entity type, no raw JSON"
  - "Docker volume for node_modules - faster container restarts"

patterns-established:
  - "API hooks: useEntity(type, id), useEntities(type, cursor, limit), useEntityOverview()"
  - "Entity pages: EntityDetail header + type-specific content + SchemaTable"
  - "Query keys: ['entity', type, id] for single, ['entities', type, params] for lists"

# Metrics
duration: 12min
completed: 2026-01-21
---

# Phase 03 Plan 01: Frontend Entity Browsing Summary

**React 19 + Vite 7 frontend with TanStack Query API layer, sidebar tree navigation, and entity detail pages displaying structured schema data**

## Performance

- **Duration:** 12 min
- **Started:** 2026-01-22T02:24:23Z
- **Completed:** 2026-01-22T02:36:30Z
- **Tasks:** 3 (completed as single commit due to interdependencies)
- **Files created:** 32

## Accomplishments

- Initialized Vite React TypeScript project with TanStack Query and React Router
- Created API layer with typed hooks matching backend EntityPublic schema
- Built collapsible sidebar showing all entities organized by type with counts
- Implemented detail pages for categories, properties, and subobjects
- Schema displayed as structured table (parent, properties, datatype, cardinality) not raw JSON

## Task Commits

All three tasks were completed in a single commit due to tight coupling (API layer, components, and pages all needed for build to pass):

1. **Tasks 1-3: React scaffolding, API layer, and entity pages** - `69f08c4` (feat)

## Files Created/Modified

- `frontend/package.json` - React project with TanStack Query, React Router, shadcn/ui
- `frontend/vite.config.ts` - Tailwind plugin, path aliases, API proxy
- `frontend/src/main.tsx` - QueryClientProvider with 5min stale/30min gc
- `frontend/src/App.tsx` - Router with category/property/subobject routes
- `frontend/src/api/client.ts` - Fetch wrapper with ApiError class
- `frontend/src/api/entities.ts` - useEntity, useEntities, useEntityOverview hooks
- `frontend/src/api/types.ts` - EntityPublic, EntityListResponse types
- `frontend/src/components/layout/Sidebar.tsx` - Collapsible entity tree with badges
- `frontend/src/components/layout/MainLayout.tsx` - Sidebar + outlet layout
- `frontend/src/components/entity/EntityDetail.tsx` - Header card with label, ID, description
- `frontend/src/components/entity/SchemaTable.tsx` - Structured field display by type
- `frontend/src/components/entity/PropertyList.tsx` - Clickable links to properties/subobjects
- `frontend/src/pages/HomePage.tsx` - Overview cards with entity counts
- `frontend/src/pages/CategoryPage.tsx` - Category detail with properties, subobjects, schema
- `frontend/src/pages/PropertyPage.tsx` - Property detail with datatype, cardinality
- `frontend/src/pages/SubobjectPage.tsx` - Subobject detail with properties list
- `docker-compose.yml` - Added frontend service with node:20-alpine

## Decisions Made

1. **Combined tasks into single commit** - Tasks 1-3 are tightly coupled; API hooks, components, and pages all needed for TypeScript to compile
2. **5min staleTime, 30min gcTime** - Balance between data freshness and reducing API calls for browsing
3. **Docker volume for node_modules** - Prevents slow npm install on every container restart
4. **SchemaTable per entity type** - Different fields shown based on type (category shows parent/properties/subobjects, property shows datatype/cardinality)
5. **useAllEntitiesByType with useQueries** - Fetches all three entity types in parallel for sidebar

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed erasableSyntaxOnly TypeScript error**
- **Found during:** Build verification
- **Issue:** `public status: number` in ApiError constructor not allowed with erasableSyntaxOnly
- **Fix:** Changed to class field declaration pattern
- **Files modified:** frontend/src/api/client.ts
- **Verification:** Build passes
- **Committed in:** 69f08c4 (part of main commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor TypeScript syntax adjustment. No scope creep.

## Issues Encountered

- shadcn init required Tailwind CSS and path aliases configured first - followed official Vite guide
- Vite 7 uses `@tailwindcss/vite` plugin instead of postcss config

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Frontend infrastructure complete, ready for search (03-02)
- API hooks established for entity fetching
- Used-by placeholders in place for 03-03 relationships plan
- Layout ready for additional features

---
*Phase: 03-entity-browsing*
*Completed: 2026-01-21*
