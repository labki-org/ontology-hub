# Phase 4: Modules and Versioning - Research

**Researched:** 2026-01-21
**Domain:** Module/profile browsing UI, dependency graph visualization, version history and field-level JSON diffing
**Confidence:** HIGH

## Summary

Phase 4 extends the existing React frontend to support module browsing (with entity grouping and dependency visualization), profile browsing (with module composition), and version history with field-level diffs. The phase builds directly on established patterns from Phase 3: TanStack Query for data fetching, shadcn/ui Card components for list layouts, React Flow with dagre for graph visualization, and the existing entity detail page patterns.

Module and profile data models already exist in the backend (`Module` and `Profile` SQLModel classes) and are indexed from GitHub via the existing `IndexerService`. The main work involves: (1) creating new frontend pages and API endpoints for modules/profiles, (2) adapting React Flow for dependency graphs (same pattern as inheritance graphs), (3) implementing version/release tracking from GitHub API, and (4) adding JSON diff computation and visualization for comparing entity versions.

For field-level diffs, use **jsondiffpatch** for computing structured JSON differences (add/modify/delete operations with path information) and render them with custom components matching the established SchemaTable pattern. Avoid react-diff-viewer libraries as they target text/code diffs rather than structured JSON comparison.

**Primary recommendation:** Reuse Phase 3 patterns extensively (Card layouts, React Flow, TanStack Query hooks). Add jsondiffpatch for JSON diff computation. Create Module/Profile API routers mirroring the Entity router structure. Build a custom diff renderer component that groups changes by entity type and shows field-level details.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed from Phase 3)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18/19 | UI framework | Already in use |
| @xyflow/react | 12+ | Graph visualization | Proven for inheritance graphs, reuse for dependency graphs |
| @dagrejs/dagre | 1.1+ | Auto layout | Already configured for hierarchical layouts |
| @tanstack/react-query | 5+ | Server state | Established pattern with queryClient configuration |
| shadcn/ui | latest | UI components | Card, Badge, Collapsible already in use |

### New for Phase 4
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jsondiffpatch | 0.6+ | JSON diff computation | Structured diff output with add/modify/delete classification, supports nested objects |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.469+ | Icons | Package, GitBranch, History icons for modules/versions |
| date-fns | 3+ | Date formatting | For release dates (already typical in React projects) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsondiffpatch | deep-diff | deep-diff is lighter but lacks visual formatters and patch support; jsondiffpatch has better diff output format |
| jsondiffpatch | json-diff-ts | json-diff-ts is TypeScript-native but less mature; jsondiffpatch has proven ecosystem |
| Custom diff renderer | react-diff-viewer-continued | react-diff-viewer targets text/code diffs, not structured JSON; custom is better fit |
| React Flow for deps | vis.js | vis.js is more powerful but heavier; React Flow already proven in codebase |

**Installation:**
```bash
# Only new dependency needed
npm install jsondiffpatch

# Already installed from Phase 3
# @xyflow/react @dagrejs/dagre @tanstack/react-query
```

## Architecture Patterns

### Recommended Project Structure Additions
```
frontend/src/
├── api/
│   ├── modules.ts           # Module/Profile API hooks (new)
│   ├── versions.ts          # Version/Release API hooks (new)
│   └── types.ts             # Add Module, Profile, Version types
├── components/
│   ├── module/              # Module-specific components (new)
│   │   ├── ModuleCard.tsx   # Card with entity count, deps
│   │   ├── ModuleEntityList.tsx  # Grouped by type
│   │   └── OverlapIndicator.tsx  # "also in: X, Y"
│   ├── profile/             # Profile-specific components (new)
│   │   ├── ProfileCard.tsx
│   │   └── ModuleSummary.tsx
│   ├── version/             # Version-specific components (new)
│   │   ├── VersionList.tsx
│   │   ├── DiffViewer.tsx   # Field-level diff display
│   │   └── ChangeGroup.tsx  # Changes grouped by type
│   └── graph/
│       ├── DependencyGraph.tsx   # Reuse dagre pattern (new)
│       └── ModuleNode.tsx        # Custom node for modules (new)
├── pages/
│   ├── ModulesPage.tsx      # Module list (new)
│   ├── ModulePage.tsx       # Module detail (new)
│   ├── ProfilesPage.tsx     # Profile list (new)
│   ├── ProfilePage.tsx      # Profile detail (new)
│   └── VersionsPage.tsx     # Version history (new)
└── lib/
    └── diff.ts              # jsondiffpatch wrapper (new)

backend/app/
├── routers/
│   ├── modules.py           # Module/Profile endpoints (new)
│   └── versions.py          # Version/Release endpoints (new)
├── services/
│   └── versions.py          # Version diff service (new)
└── schemas/
    ├── module.py            # Module API schemas (new)
    └── version.py           # Version API schemas (new)
```

### Pattern 1: Module List Page with Cards

**What:** Card-based layout for module list matching established entity browsing pattern
**When to use:** /modules list page
**Example:**
```typescript
// Source: Phase 3 patterns + Context decision: cards with preview
function ModulesPage() {
  const { data: modules, isLoading } = useModules()
  const [searchQuery, setSearchQuery] = useState('')
  const [entityFilter, setEntityFilter] = useState<string | null>(null)

  const filteredModules = useMemo(() => {
    if (!modules) return []
    return modules.filter(m => {
      const matchesSearch = m.label.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesEntity = !entityFilter || m.category_ids.includes(entityFilter)
      return matchesSearch && matchesEntity
    })
  }, [modules, searchQuery, entityFilter])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Modules</h1>
        <p className="text-muted-foreground">Browse schema modules and their compositions</p>
      </header>

      <div className="flex gap-4">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search modules..." />
        <EntityFilterSelect value={entityFilter} onChange={setEntityFilter} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredModules.map(module => (
          <ModuleCard key={module.id} module={module} />
        ))}
      </div>
    </div>
  )
}
```

### Pattern 2: Module Card with Entity Preview

**What:** Card component showing module name, entity count, 3-5 preview entities, and dependency badges
**When to use:** Module list cards
**Example:**
```typescript
// Source: Context decision: cards with preview, inline badges for deps
interface ModuleCardProps {
  module: ModulePublic
}

function ModuleCard({ module }: ModuleCardProps) {
  const previewEntities = module.category_ids.slice(0, 5)
  const hasMore = module.category_ids.length > 5

  return (
    <Link to={`/module/${module.module_id}`}>
      <Card className="hover:border-blue-400 transition-colors cursor-pointer">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            {module.label}
          </CardTitle>
          <CardDescription>
            {module.category_ids.length} categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          {module.description && (
            <p className="text-sm text-muted-foreground mb-3">{module.description}</p>
          )}

          {/* Entity preview */}
          <div className="flex flex-wrap gap-1 mb-3">
            {previewEntities.map(id => (
              <Badge key={id} variant="outline" className="text-xs">{id}</Badge>
            ))}
            {hasMore && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                +{module.category_ids.length - 5} more
              </Badge>
            )}
          </div>

          {/* Dependencies as clickable badges */}
          {module.dependencies.length > 0 && (
            <div className="flex flex-wrap gap-1 items-center">
              <span className="text-xs text-muted-foreground">Depends on:</span>
              {module.dependencies.map(depId => (
                <Badge key={depId} variant="secondary" className="text-xs">
                  {depId}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
```

### Pattern 3: Module Detail with Entity Grouping and Overlap Detection

**What:** Module detail page grouping entities by type with overlap indicators
**When to use:** /module/:moduleId detail page
**Example:**
```typescript
// Source: Context decisions: group by type, overlap inline with entity
function ModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>()
  const { data: module } = useModule(moduleId!)
  const { data: entities } = useModuleEntities(moduleId!)
  const { data: overlaps } = useModuleOverlaps(moduleId!)

  if (!module || !entities) return <Loading />

  // Group entities by type
  const grouped = {
    categories: entities.filter(e => e.entity_type === 'category'),
    properties: entities.filter(e => e.entity_type === 'property'),
    subobjects: entities.filter(e => e.entity_type === 'subobject'),
  }

  return (
    <div className="space-y-6">
      <ModuleHeader module={module} />

      {/* Dependency badges */}
      <DependencyBadges dependencies={module.dependencies} />

      {/* Entities grouped by type */}
      {(['categories', 'properties', 'subobjects'] as const).map(type => (
        <section key={type}>
          <h2 className="text-lg font-semibold capitalize mb-3">{type}</h2>
          <div className="space-y-2">
            {grouped[type].map(entity => (
              <EntityRow
                key={entity.entity_id}
                entity={entity}
                // Neutral info style, shows "also in: X, Y"
                otherModules={overlaps?.[entity.entity_id]?.filter(m => m !== moduleId)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function EntityRow({ entity, otherModules }: { entity: EntityPublic; otherModules?: string[] }) {
  return (
    <div className="flex items-center justify-between p-2 rounded border">
      <Link to={`/${entity.entity_type}/${entity.entity_id}`} className="hover:underline">
        {entity.label}
      </Link>
      {otherModules && otherModules.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-blue-600">
          <Info className="h-3 w-3" />
          <span>also in: {otherModules.join(', ')}</span>
        </div>
      )}
    </div>
  )
}
```

### Pattern 4: Module Dependency Graph (Reuse React Flow Pattern)

**What:** Dependency visualization using same React Flow + dagre pattern as inheritance
**When to use:** Profile page inline graph, dedicated dependency explorer
**Example:**
```typescript
// Source: Phase 3 InheritanceGraph.tsx pattern
// Define outside component to prevent re-renders
const moduleNodeTypes = {
  module: ModuleNodeComponent,
}

function DependencyGraph({ moduleIds }: { moduleIds: string[] }) {
  const { data: modules } = useModules()

  const { nodes, edges } = useMemo(() => {
    if (!modules) return { nodes: [], edges: [] }

    // Filter to only modules in this graph
    const relevantModules = modules.filter(m => moduleIds.includes(m.module_id))

    // Create nodes
    const graphNodes: Node[] = relevantModules.map(m => ({
      id: m.module_id,
      type: 'module',
      position: { x: 0, y: 0 },
      data: {
        label: m.label,
        moduleId: m.module_id,
        entityCount: m.category_ids.length,
      },
    }))

    // Create edges from dependencies
    const graphEdges: Edge[] = []
    relevantModules.forEach(m => {
      m.dependencies.forEach(depId => {
        if (moduleIds.includes(depId)) {
          graphEdges.push({
            id: `${m.module_id}-${depId}`,
            source: depId,      // Dependency points TO dependent
            target: m.module_id,
            markerEnd: { type: MarkerType.ArrowClosed },
          })
        }
      })
    })

    return getLayoutedElements(graphNodes, graphEdges)
  }, [modules, moduleIds])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={moduleNodeTypes}
      fitView
    >
      <Background />
    </ReactFlow>
  )
}
```

### Pattern 5: JSON Diff with jsondiffpatch

**What:** Compute and render field-level diffs for entity schema definitions
**When to use:** Version comparison view
**Example:**
```typescript
// lib/diff.ts - Wrapper for jsondiffpatch
import * as jsondiffpatch from 'jsondiffpatch'

const diffpatcher = jsondiffpatch.create({
  objectHash: (obj: any) => obj.id || obj.entity_id || JSON.stringify(obj),
  arrays: {
    detectMove: true,
  },
})

export type DiffDelta = jsondiffpatch.Delta

export function computeDiff(oldValue: any, newValue: any): DiffDelta | undefined {
  return diffpatcher.diff(oldValue, newValue)
}

export function classifyChange(delta: any): 'added' | 'modified' | 'deleted' | 'unchanged' {
  if (delta === undefined) return 'unchanged'
  if (Array.isArray(delta)) {
    if (delta.length === 1) return 'added'      // [newValue]
    if (delta.length === 2) return 'modified'   // [oldValue, newValue]
    if (delta.length === 3 && delta[2] === 0) return 'deleted'  // [oldValue, 0, 0]
  }
  return 'modified' // Nested object
}
```

### Pattern 6: Diff Viewer Component

**What:** Custom component to render JSON diffs grouped by entity type
**When to use:** Version comparison view (VERS-02, VERS-03)
**Example:**
```typescript
// Source: Context decision: diffs grouped by entity type
interface DiffViewerProps {
  oldEntities: Record<string, EntityPublic>
  newEntities: Record<string, EntityPublic>
}

function DiffViewer({ oldEntities, newEntities }: DiffViewerProps) {
  const changes = useMemo(() => {
    const allIds = new Set([...Object.keys(oldEntities), ...Object.keys(newEntities)])
    const grouped: Record<ChangeType, EntityChange[]> = {
      added: [],
      modified: [],
      deleted: [],
    }

    allIds.forEach(id => {
      const old = oldEntities[id]
      const new_ = newEntities[id]

      if (!old && new_) {
        grouped.added.push({ entity: new_, changeType: 'added' })
      } else if (old && !new_) {
        grouped.deleted.push({ entity: old, changeType: 'deleted' })
      } else if (old && new_) {
        const delta = computeDiff(old.schema_definition, new_.schema_definition)
        if (delta) {
          grouped.modified.push({ entity: new_, oldEntity: old, delta, changeType: 'modified' })
        }
      }
    })

    return grouped
  }, [oldEntities, newEntities])

  return (
    <div className="space-y-6">
      {changes.added.length > 0 && (
        <ChangeSection title="Added" changes={changes.added} variant="success" />
      )}
      {changes.modified.length > 0 && (
        <ChangeSection title="Modified" changes={changes.modified} variant="warning" />
      )}
      {changes.deleted.length > 0 && (
        <ChangeSection title="Deleted" changes={changes.deleted} variant="destructive" />
      )}
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Using react-diff-viewer for JSON:** Designed for text/code, not structured data. Use jsondiffpatch + custom rendering.
- **Fetching all versions at once:** Use pagination and lazy loading for version lists. Only fetch diff data on demand.
- **Computing diffs on every render:** Memoize diff computation with useMemo, it's computationally expensive.
- **Duplicating React Flow patterns:** Reuse getLayoutedElements and nodeTypes pattern from Phase 3.
- **Inline entityFilter in module API:** Use query param filtering on frontend, not repeated API calls.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON diff computation | Manual object comparison | jsondiffpatch | Handles arrays, moves, nested objects, produces structured output |
| Graph layout | Manual x/y positioning | dagre (already in use) | Edge crossing minimization, layer assignment |
| Module dependency graph | New graph library | React Flow (already in use) | Proven pattern exists in codebase |
| Card layouts | Custom grid CSS | shadcn/ui Card (already in use) | Consistent styling, accessibility |
| Entity type grouping | Multiple API calls | Single API call + frontend filter | Reduces API complexity, faster |

**Key insight:** Phase 4 should heavily reuse Phase 3 infrastructure. The main new work is jsondiffpatch integration and additional API endpoints. Avoid introducing new visualization libraries.

## Common Pitfalls

### Pitfall 1: N+1 Queries for Module Overlaps

**What goes wrong:** Fetching overlap data for each entity individually causes request floods.
**Why it happens:** Natural to think "for each entity, find which modules contain it."
**How to avoid:** Backend computes all overlaps in one query, returns map of entity_id -> [module_ids].
```python
# Backend: Single query for all overlaps in a module
@router.get("/modules/{module_id}/overlaps")
async def get_module_overlaps(module_id: str, session: SessionDep):
    # Get all category_ids for this module
    # Then find other modules containing any of those categories
    # Return: { "Person": ["core", "research"], "Agent": ["core"] }
```
**Warning signs:** Network tab shows many parallel requests when viewing module detail.

### Pitfall 2: Version List Without Pagination

**What goes wrong:** Loading all releases blocks UI, runs out of memory for large repos.
**Why it happens:** GitHub API returns all releases, tempting to load all at once.
**How to avoid:** Implement cursor-based pagination for releases. GitHub API supports `per_page` and `page` params.
**Warning signs:** Slow load times on versions page, high memory usage.

### Pitfall 3: Computing Diffs in Render Path

**What goes wrong:** Page freezes when switching between versions.
**Why it happens:** jsondiffpatch diff computation happens on every render.
**How to avoid:** Use useMemo with version IDs as dependencies. Consider web worker for large diffs.
```typescript
const diff = useMemo(() => {
  if (!oldVersion || !newVersion) return null
  return computeDiff(oldVersion.entities, newVersion.entities)
}, [oldVersion?.id, newVersion?.id])
```
**Warning signs:** UI lag when changing version selection.

### Pitfall 4: Module Dependency Cycles

**What goes wrong:** Dependency graph layout fails or produces infinite loop.
**Why it happens:** Modules can have circular dependencies (A depends on B, B depends on A).
**How to avoid:** Detect cycles before layout. Display warning badge like inheritance circular detection.
```typescript
function detectCycles(modules: Module[]): boolean {
  // Topological sort attempt - if fails, cycle exists
}
```
**Warning signs:** Browser tab hangs when viewing profile with cyclic module dependencies.

### Pitfall 5: Diff Path Display Confusion

**What goes wrong:** Users don't understand what "schema_definition.properties.0" means.
**Why it happens:** jsondiffpatch uses JSON path notation, not human-friendly labels.
**How to avoid:** Transform paths to human-readable format. "properties[0]" becomes "First property".
**Warning signs:** User confusion in diff view, support questions about diff notation.

## Code Examples

Verified patterns from official sources and existing codebase:

### Backend: Module List Endpoint

```python
# backend/app/routers/modules.py
# Source: Existing entities.py pattern

from fastapi import APIRouter, HTTPException, Query, Request
from sqlmodel import select

from app.database import SessionDep
from app.models.module import Module, ModulePublic, Profile, ProfilePublic

router = APIRouter(prefix="/modules", tags=["modules"])


@router.get("/", response_model=list[ModulePublic])
async def list_modules(
    request: Request,
    session: SessionDep,
    search: str | None = Query(None, min_length=2),
) -> list[ModulePublic]:
    """List all modules with optional search."""
    query = select(Module).where(Module.deleted_at.is_(None))

    if search:
        pattern = f"%{search}%"
        query = query.where(Module.label.ilike(pattern))

    query = query.order_by(Module.label)
    result = await session.execute(query)
    modules = result.scalars().all()

    return [ModulePublic.model_validate(m) for m in modules]


@router.get("/{module_id}", response_model=ModulePublic)
async def get_module(
    module_id: str,
    session: SessionDep,
) -> ModulePublic:
    """Get a single module by ID."""
    query = select(Module).where(
        Module.module_id == module_id,
        Module.deleted_at.is_(None),
    )
    result = await session.execute(query)
    module = result.scalar_one_or_none()

    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    return ModulePublic.model_validate(module)


@router.get("/{module_id}/entities", response_model=list[EntityPublic])
async def get_module_entities(
    module_id: str,
    session: SessionDep,
) -> list[EntityPublic]:
    """Get all entities included in a module.

    Returns categories directly in module, plus properties and subobjects
    transitively included through those categories.
    """
    # Implementation: fetch categories, then expand to props/subobjects
    pass


@router.get("/{module_id}/overlaps")
async def get_module_overlaps(
    module_id: str,
    session: SessionDep,
) -> dict[str, list[str]]:
    """Get entities that appear in multiple modules.

    Returns: { "entity_id": ["module1", "module2"], ... }
    Only includes entities that appear in more than one module.
    """
    # Implementation: cross-reference category_ids across all modules
    pass
```

### Backend: Version/Release Endpoints

```python
# backend/app/routers/versions.py
# Source: GitHub API patterns + existing github.py client

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/versions", tags=["versions"])


class ReleasePublic(BaseModel):
    tag_name: str
    name: str
    created_at: str
    published_at: str | None
    body: str | None


class VersionDiffResponse(BaseModel):
    old_version: str
    new_version: str
    changes: dict  # Structured diff output


@router.get("/", response_model=list[ReleasePublic])
async def list_releases():
    """List all releases/tags from GitHub repository."""
    # Fetch from GitHub API: GET /repos/{owner}/{repo}/releases
    # Or tags if no releases: GET /repos/{owner}/{repo}/tags
    pass


@router.get("/diff")
async def get_version_diff(
    old: str,
    new: str,
) -> VersionDiffResponse:
    """Get field-level diff between two versions.

    Computes diff of all entities between old and new versions,
    grouped by entity type and categorized by change type.
    """
    # 1. Fetch entities at old version (from GitHub or cached)
    # 2. Fetch entities at new version
    # 3. Compute diff using jsondiffpatch-style algorithm
    # 4. Group by entity type and change type
    pass
```

### Frontend: Version Comparison Page

```typescript
// Source: Context decisions + jsondiffpatch patterns
function VersionsPage() {
  const { data: releases } = useReleases()
  const [selectedOld, setSelectedOld] = useState<string | null>(null)
  const [selectedNew, setSelectedNew] = useState<string | null>(null)

  // Default: compare latest with previous
  useEffect(() => {
    if (releases && releases.length >= 2) {
      setSelectedNew(releases[0].tag_name)
      setSelectedOld(releases[1].tag_name)
    }
  }, [releases])

  const { data: diff, isLoading: diffLoading } = useVersionDiff(
    selectedOld,
    selectedNew
  )

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Version History</h1>
      </header>

      {/* Version selector */}
      <div className="flex gap-4 items-center">
        <VersionSelect
          label="Compare"
          value={selectedOld}
          onChange={setSelectedOld}
          releases={releases}
        />
        <ArrowRight className="h-4 w-4" />
        <VersionSelect
          label="With"
          value={selectedNew}
          onChange={setSelectedNew}
          releases={releases}
        />
      </div>

      {/* Diff display grouped by entity type */}
      {diffLoading ? (
        <Skeleton className="h-64" />
      ) : diff ? (
        <DiffViewer diff={diff} />
      ) : null}

      {/* Release list */}
      <section>
        <h2 className="text-lg font-semibold mb-3">All Releases</h2>
        <div className="space-y-2">
          {releases?.map(release => (
            <ReleaseCard key={release.tag_name} release={release} />
          ))}
        </div>
      </section>
    </div>
  )
}
```

### API Types for Phase 4

```typescript
// frontend/src/api/types.ts additions

export interface ModulePublic {
  id: string
  module_id: string
  label: string
  description: string | null
  category_ids: string[]
  dependencies: string[]
  commit_sha: string | null
  created_at: string
  updated_at: string
}

export interface ProfilePublic {
  id: string
  profile_id: string
  label: string
  description: string | null
  module_ids: string[]
  commit_sha: string | null
  created_at: string
  updated_at: string
}

export interface ReleasePublic {
  tag_name: string
  name: string
  created_at: string
  published_at: string | null
  body: string | null
}

export interface EntityChange {
  entity_id: string
  entity_type: EntityType
  change_type: 'added' | 'modified' | 'deleted'
  old_value?: Record<string, unknown>
  new_value?: Record<string, unknown>
  field_changes?: FieldChange[]
}

export interface FieldChange {
  path: string
  change_type: 'added' | 'modified' | 'deleted'
  old_value?: unknown
  new_value?: unknown
}

export interface VersionDiff {
  old_version: string
  new_version: string
  categories: EntityChange[]
  properties: EntityChange[]
  subobjects: EntityChange[]
  modules: EntityChange[]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-diff-viewer for all diffs | jsondiffpatch + custom UI for JSON | Current best practice | Better structured output for JSON |
| Fetch versions from GitHub on every load | Cache release list, fetch on demand | Standard pattern | Reduced API calls, faster UX |
| All entities in one list | Group by entity type with sections | Context decision | Clearer organization |
| reactflow package | @xyflow/react | 2024 | Package renamed, same patterns |

**Deprecated/outdated:**
- react-diff-viewer for JSON: Use for text/code only, not structured data
- Fetching all releases synchronously: Use pagination

## Open Questions

Things that couldn't be fully resolved:

1. **Version storage strategy**
   - What we know: Current indexer fetches latest commit only, no historical data stored
   - What's unclear: Should we store historical versions in DB, or fetch from GitHub on demand?
   - Recommendation: Fetch from GitHub on demand for diff views (avoids storage bloat), cache for 1 hour

2. **Transitive entity resolution for modules**
   - What we know: Modules contain category_ids, properties/subobjects are transitively included
   - What's unclear: Best query strategy for resolving all transitive entities efficiently
   - Recommendation: Backend endpoint `/modules/{id}/entities` handles resolution, returns all types

3. **Large diff performance**
   - What we know: jsondiffpatch can be slow on very large objects
   - What's unclear: What's the typical entity count at scale?
   - Recommendation: Start with synchronous diff, add web worker if performance issues arise

## Sources

### Primary (HIGH confidence)
- Phase 3 codebase: `/home/daharoni/dev/ontology-hub/frontend/src/` - Established patterns
- [jsondiffpatch GitHub](https://github.com/benjamine/jsondiffpatch) - JSON diff computation
- [@xyflow/react docs](https://reactflow.dev) - React Flow patterns (already in use)
- [TanStack Query docs](https://tanstack.com/query/latest) - Query patterns (already in use)
- [GitHub REST API - Releases](https://docs.github.com/en/rest/releases) - Version/release endpoints

### Secondary (MEDIUM confidence)
- [jsondiffpatch npm](https://www.npmjs.com/package/jsondiffpatch) - Package details
- [npm-compare: JSON diff libraries](https://npm-compare.com/deep-diff,json-diff,jsondiffpatch) - Library comparison

### Tertiary (LOW confidence)
- Web search results for React diff patterns - Community patterns, not authoritative

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Mostly reusing Phase 3 stack
- Module/Profile UI patterns: HIGH - Directly based on Context decisions and existing entity patterns
- Dependency graph: HIGH - Same React Flow + dagre pattern as inheritance
- JSON diff approach: HIGH - jsondiffpatch is established, well-documented library
- Version API patterns: MEDIUM - GitHub API is well-documented but version storage strategy needs validation
- Performance at scale: MEDIUM - Needs testing with real data volumes

**Research date:** 2026-01-21
**Valid until:** ~30 days for stable components, ~14 days for API patterns (may need adjustment based on implementation learnings)
