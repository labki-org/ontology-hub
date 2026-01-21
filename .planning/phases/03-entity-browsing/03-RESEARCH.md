# Phase 3: Entity Browsing - Research

**Researched:** 2026-01-21
**Domain:** React frontend with graph visualization, tree navigation, and search functionality
**Confidence:** HIGH

## Summary

Phase 3 introduces the frontend layer for Ontology Hub using React with TypeScript, bundled by Vite. The standard stack centers on React 18+ with TanStack Query for data fetching, React Router v7 for routing, shadcn/ui for accessible components, and React Flow for inheritance graph visualization. The existing FastAPI backend (Phase 2) provides entity API endpoints with cursor-based pagination.

The architecture follows a feature-based folder structure with colocation of related components. Entity detail pages parse the stored `schema_definition` JSONB into structured table views. The sidebar uses a collapsible tree for entity navigation. Search is implemented with debounced input and backend API queries (ILIKE pattern matching on indexed fields). React Flow with dagre layout handles the inheritance graph visualization, supporting multiple inheritance via a true graph structure (not a tree).

**Primary recommendation:** Use Vite + React + TypeScript with shadcn/ui for components, TanStack Query for server state, React Flow with dagre for graph visualization, and implement search via backend API with debounced frontend input. Define custom React Flow nodes for categories that display entity metadata and support click-to-navigate behavior.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18/19 | UI framework | Industry standard, hooks-based architecture, excellent TypeScript support |
| TypeScript | 5.6+ | Type safety | Catches errors at compile time, better IDE support, required by shadcn/ui |
| Vite | 6+ | Build tool | Fastest HMR, official React template, modern ESM-first approach |
| React Router | 7+ | Routing | Standard React routing, data loading support, declarative navigation |
| TanStack Query | 5+ | Server state | Caching, deduplication, background refetch, stale-while-revalidate pattern |
| shadcn/ui | latest | UI components | Copy-paste approach, full code ownership, Radix primitives, Tailwind styled |
| Tailwind CSS | 4+ | Styling | Utility-first CSS, works with shadcn/ui, rapid development |

### Graph & Tree
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React Flow | 12+ | Graph visualization | Inheritance graphs, multiple inheritance support, interactive nodes |
| @dagrejs/dagre | 1.1+ | Auto layout | Automatic hierarchical graph positioning for React Flow |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-router | 1.95+ | Type-safe routing | Alternative if stronger type safety needed |
| lucide-react | 0.469+ | Icons | Consistent icon set, works with shadcn/ui |
| clsx | 2+ | Class merging | Conditional className handling |
| tailwind-merge | 2+ | Tailwind class merging | Prevents class conflicts in component composition |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Flow | Cytoscape.js | Cytoscape better for very large graphs (10k+ nodes), React Flow better DX for React |
| React Flow | Sigma.js | Sigma for massive networks, React Flow sufficient for inheritance hierarchies |
| shadcn/ui | MUI | MUI heavier, less customizable, shadcn gives full code ownership |
| TanStack Query | SWR | TanStack Query more features (mutations, devtools), SWR simpler |
| dagre | ELK.js | ELK more sophisticated layouts, dagre simpler and sufficient for hierarchies |

**Installation:**
```bash
# Create project
npm create vite@latest frontend -- --template react-ts

# Core dependencies
npm install @tanstack/react-query react-router-dom

# Graph visualization
npm install @xyflow/react @dagrejs/dagre

# UI framework (shadcn/ui)
npm install tailwindcss @tailwindcss/vite
npx shadcn@latest init

# Icons and utilities
npm install lucide-react clsx tailwind-merge
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/
├── src/
│   ├── main.tsx                 # App entry with providers
│   ├── App.tsx                  # Router setup
│   ├── api/                     # API client and hooks
│   │   ├── client.ts            # Fetch wrapper with base URL
│   │   ├── entities.ts          # Entity API hooks
│   │   └── types.ts             # API response types
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── layout/              # Sidebar, Header, MainContent
│   │   ├── entity/              # Entity-specific components
│   │   │   ├── EntityDetail.tsx
│   │   │   ├── SchemaTable.tsx
│   │   │   ├── PropertyList.tsx
│   │   │   └── UsedByList.tsx
│   │   ├── graph/               # Graph visualization
│   │   │   ├── InheritanceGraph.tsx
│   │   │   ├── CategoryNode.tsx
│   │   │   └── useGraphLayout.ts
│   │   └── search/              # Search components
│   │       ├── SearchInput.tsx
│   │       └── SearchResults.tsx
│   ├── hooks/                   # Shared hooks
│   │   ├── useDebounce.ts
│   │   └── useEntityTree.ts
│   ├── pages/                   # Route components
│   │   ├── HomePage.tsx
│   │   ├── CategoryPage.tsx
│   │   ├── PropertyPage.tsx
│   │   ├── SubobjectPage.tsx
│   │   └── GraphExplorerPage.tsx
│   ├── lib/                     # Utilities
│   │   └── utils.ts             # cn() helper, etc.
│   └── styles/
│       └── index.css            # Tailwind imports
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── components.json              # shadcn/ui config
```

### Pattern 1: TanStack Query Setup with QueryClient

**What:** Centralized QueryClient configuration with provider wrapper
**When to use:** App initialization, all components that need server data
**Example:**
```typescript
// Source: https://tanstack.com/query/latest/docs/framework/react/overview
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 minutes
      gcTime: 30 * 60 * 1000,      // 30 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,  // Disable for browsing app
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

### Pattern 2: Entity API Hook with useQuery

**What:** Typed API hooks for fetching entity data with caching
**When to use:** All entity data fetching (detail pages, lists, search)
**Example:**
```typescript
// Source: https://tanstack.com/query/latest/docs/framework/react/guides/queries
import { useQuery } from '@tanstack/react-query';
import { EntityPublic, EntityType } from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

async function fetchEntity(
  entityType: EntityType,
  entityId: string
): Promise<EntityPublic> {
  const response = await fetch(`${API_BASE}/entities/${entityType}/${entityId}`);
  if (!response.ok) {
    throw new Error(`Entity not found: ${entityType}/${entityId}`);
  }
  return response.json();
}

export function useEntity(entityType: EntityType, entityId: string) {
  return useQuery({
    queryKey: ['entity', entityType, entityId],
    queryFn: () => fetchEntity(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });
}
```

### Pattern 3: React Flow Custom Node for Categories

**What:** Custom node component displaying category metadata with click handler
**When to use:** Inheritance graph visualization
**Example:**
```typescript
// Source: https://reactflow.dev/learn/customization/custom-nodes
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useNavigate } from 'react-router-dom';

interface CategoryNodeData {
  label: string;
  entityId: string;
  isCurrent?: boolean;
}

function CategoryNode({ data }: NodeProps<CategoryNodeData>) {
  const navigate = useNavigate();

  return (
    <div
      className={`px-4 py-2 rounded-lg border-2 cursor-pointer
        ${data.isCurrent ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}
        hover:border-blue-400 transition-colors`}
      onClick={() => navigate(`/category/${data.entityId}`)}
    >
      <Handle type="target" position={Position.Top} />
      <div className="font-medium">{data.label}</div>
      <div className="text-xs text-gray-500">{data.entityId}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// Register outside component to prevent re-renders
export const nodeTypes = { category: CategoryNode };
```

### Pattern 4: Dagre Layout for Hierarchical Graphs

**What:** Automatic positioning of nodes in inheritance hierarchy
**When to use:** Inheritance graph, any directed acyclic graph
**Example:**
```typescript
// Source: https://reactflow.dev/examples/layout/dagre
import dagre from '@dagrejs/dagre';
import { Node, Edge } from '@xyflow/react';

const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
const NODE_WIDTH = 172;
const NODE_HEIGHT = 36;

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'BT' | 'LR' | 'RL' = 'TB'
) {
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    // Dagre returns center position, React Flow uses top-left
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
```

### Pattern 5: Debounced Search Input

**What:** Search input that waits for user to stop typing before fetching
**When to use:** Search functionality to avoid excessive API calls
**Example:**
```typescript
// Source: https://dev.to/matan3sh/implementing-a-debounce-hook-in-react-15ej
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Usage in search component
function SearchInput() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchEntities(debouncedQuery),
    enabled: debouncedQuery.length >= 2,  // Minimum 2 chars
  });

  return (
    <input
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search entities..."
    />
  );
}
```

### Pattern 6: Sidebar with Collapsible Entity Tree

**What:** Navigation sidebar with expandable entity type sections
**When to use:** Main layout for entity browsing
**Example:**
```typescript
// Using shadcn/ui Collapsible component
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';

interface EntityTreeProps {
  entities: { type: string; items: { id: string; label: string }[] }[];
}

function EntityTree({ entities }: EntityTreeProps) {
  return (
    <nav className="space-y-2">
      {entities.map((group) => (
        <Collapsible key={group.type}>
          <CollapsibleTrigger className="flex items-center w-full px-2 py-1 hover:bg-gray-100 rounded">
            <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
            <span className="ml-2 font-medium capitalize">{group.type}</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="ml-6 space-y-1">
              {group.items.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/${group.type}/${item.id}`}
                    className="block px-2 py-1 text-sm hover:bg-gray-100 rounded"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </nav>
  );
}
```

### Anti-Patterns to Avoid

- **Defining nodeTypes inside component:** Creates new reference on every render, causing React Flow to re-register all nodes. Define outside component or use useMemo.
- **Accessing React Flow state in every component:** Subscribing to `nodes` or `edges` arrays causes re-renders on every drag/pan/zoom. Use selectors sparingly.
- **Mixing TanStack Query with Redux for same data:** TanStack Query already caches server state. Adding Redux layer causes duplicate state and sync issues.
- **Using useEffect to transform query data:** Transform in the queryFn or use the `select` option instead of useEffect + useState.
- **Forgetting QueryClientProvider:** Hooks silently fail without provider. Wrap app root.
- **Hard-coding API URLs:** Use environment variables (`VITE_API_URL`) for flexibility.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data fetching/caching | Custom fetch + useState | TanStack Query | Handles caching, deduplication, retries, loading/error states, refetch on focus |
| Graph layout | Manual x/y coordinate calculation | dagre | Handles edge crossing minimization, layer assignment, spacing algorithms |
| Debounced input | setTimeout in component | useDebounce hook | Proper cleanup, type-safe, reusable across components |
| Accessible components | Custom button/input/dialog | shadcn/ui + Radix | ARIA attributes, keyboard navigation, focus management handled |
| Class name merging | String concatenation | clsx + tailwind-merge | Prevents Tailwind class conflicts, cleaner conditional classes |
| Tree view navigation | Custom recursive component | shadcn/ui Collapsible or MUI TreeView | Accessibility, expand/collapse state, keyboard navigation |

**Key insight:** Frontend state management and UI accessibility are solved problems. TanStack Query eliminates the need for Redux in most cases. shadcn/ui provides production-ready accessible components that you own.

## Common Pitfalls

### Pitfall 1: React Flow CSS Not Imported

**What goes wrong:** Nodes render but edges are invisible, pan/zoom doesn't work properly.
**Why it happens:** React Flow requires its stylesheet for proper rendering. Without it, SVG elements are hidden.
**How to avoid:**
```typescript
import '@xyflow/react/dist/style.css';
```
**Warning signs:** Edges not visible, controls not rendering, pan/zoom broken.

### Pitfall 2: React Flow Container Without Dimensions

**What goes wrong:** Graph doesn't render or appears as empty space.
**Why it happens:** React Flow needs a parent with explicit width/height. It doesn't calculate its own size.
**How to avoid:**
```tsx
<div style={{ width: '100%', height: '500px' }}>
  <ReactFlow nodes={nodes} edges={edges} />
</div>
```
**Warning signs:** Empty container, console warnings about dimensions.

### Pitfall 3: NodeTypes Recreated on Every Render

**What goes wrong:** Severe performance degradation, graph becomes laggy, nodes flicker.
**Why it happens:** Defining `nodeTypes` object inside component creates new reference each render, forcing React Flow to re-register all node types.
**How to avoid:**
```typescript
// WRONG - inside component
function Graph() {
  const nodeTypes = { category: CategoryNode };  // New object every render!
  return <ReactFlow nodeTypes={nodeTypes} ... />;
}

// CORRECT - outside component
const nodeTypes = { category: CategoryNode };
function Graph() {
  return <ReactFlow nodeTypes={nodeTypes} ... />;
}
```
**Warning signs:** Frame rate drops during interaction, React DevTools showing frequent re-renders.

### Pitfall 4: TanStack Query Request Waterfalls

**What goes wrong:** Sequential requests that could be parallel, slow page loads.
**Why it happens:** Child component fetches data that depends on parent's fetched data, creating a waterfall.
**How to avoid:**
- Restructure API to return related data in single request
- Use `useQueries` for parallel independent fetches
- Prefetch data before navigation with `queryClient.prefetchQuery`
**Warning signs:** Network tab shows sequential requests, slow time-to-interactive.

### Pitfall 5: Forgetting enabled Option in useQuery

**What goes wrong:** Query fires with undefined/null parameters, causes errors or fetches wrong data.
**Why it happens:** Query runs immediately by default, even if dependencies not ready.
**How to avoid:**
```typescript
const { data } = useQuery({
  queryKey: ['entity', entityType, entityId],
  queryFn: () => fetchEntity(entityType, entityId),
  enabled: !!entityType && !!entityId,  // Only run when both defined
});
```
**Warning signs:** API errors with undefined in URL, unnecessary requests on mount.

### Pitfall 6: Search Fires on Every Keystroke

**What goes wrong:** API overwhelmed with requests, rate limits hit, poor UX.
**Why it happens:** onChange triggers fetch immediately without debouncing.
**How to avoid:** Use `useDebounce` hook with 300ms delay, require minimum query length.
**Warning signs:** Network tab flooded with requests while typing, 429 responses.

## Code Examples

Verified patterns from official sources:

### Entity Detail Page Structure

```typescript
// Source: Project requirements + TanStack Query patterns
import { useParams } from 'react-router-dom';
import { useEntity } from '@/api/entities';
import { SchemaTable } from '@/components/entity/SchemaTable';
import { PropertyList } from '@/components/entity/PropertyList';
import { InheritanceGraph } from '@/components/graph/InheritanceGraph';

function CategoryPage() {
  const { entityId } = useParams<{ entityId: string }>();
  const { data: entity, isLoading, error } = useEntity('category', entityId!);

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorDisplay error={error} />;
  if (!entity) return <NotFound />;

  const schema = entity.schema_definition;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{entity.label}</h1>
        <p className="text-gray-600">{entity.description}</p>
        <div className="text-sm text-gray-500">ID: {entity.entity_id}</div>
      </header>

      {/* Mini inheritance graph */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Inheritance</h2>
        <div className="h-48 border rounded">
          <InheritanceGraph
            currentEntityId={entity.entity_id}
            compact
          />
        </div>
      </section>

      {/* Properties - declared + inherited with badges */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Properties</h2>
        <PropertyList
          declaredProperties={schema.properties || []}
          parentCategories={schema.parent ? [schema.parent] : []}
        />
      </section>

      {/* Schema definition as structured table */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Schema Definition</h2>
        <SchemaTable schema={schema} />
      </section>
    </div>
  );
}
```

### Search API Endpoint (Backend)

The frontend needs a search endpoint. Here's the pattern for adding to existing entities router:

```python
# Backend addition to app/routers/entities.py
@router.get("/search", response_model=EntityListResponse)
@limiter.limit(RATE_LIMITS["entity_list"])
async def search_entities(
    request: Request,
    session: SessionDep,
    q: str = Query(..., min_length=2, max_length=100),
    entity_type: Optional[EntityType] = None,
    limit: int = Query(20, ge=1, le=100),
) -> EntityListResponse:
    """Search entities by name, description, or ID using ILIKE."""
    query = select(Entity).where(
        Entity.deleted_at.is_(None),
        or_(
            Entity.entity_id.ilike(f"%{q}%"),
            Entity.label.ilike(f"%{q}%"),
            Entity.description.ilike(f"%{q}%"),
        ),
    )

    if entity_type:
        query = query.where(Entity.entity_type == entity_type)

    query = query.order_by(Entity.label).limit(limit + 1)

    result = await session.execute(query)
    entities = list(result.scalars().all())

    has_next = len(entities) > limit
    if has_next:
        entities = entities[:limit]

    return EntityListResponse(
        items=[EntityPublic.model_validate(e) for e in entities],
        next_cursor=None,  # Search doesn't use cursor pagination
        has_next=has_next,
    )
```

### Used-By References Query (Backend)

```python
# Backend: Find categories that use a property/subobject
@router.get("/{entity_type}/{entity_id}/used-by", response_model=list[EntityPublic])
async def get_used_by(
    request: Request,
    entity_type: EntityType,
    entity_id: str,
    session: SessionDep,
) -> list[EntityPublic]:
    """Get categories that reference this property or subobject."""
    if entity_type not in [EntityType.PROPERTY, EntityType.SUBOBJECT]:
        raise HTTPException(400, "used-by only applies to properties and subobjects")

    # Search in schema_definition JSONB
    field_name = "properties" if entity_type == EntityType.PROPERTY else "subobjects"

    query = select(Entity).where(
        Entity.entity_type == EntityType.CATEGORY,
        Entity.deleted_at.is_(None),
        Entity.schema_definition[field_name].contains([entity_id]),
    )

    result = await session.execute(query)
    return [EntityPublic.model_validate(e) for e in result.scalars().all()]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Create React App | Vite | 2023+ | 10-100x faster HMR, modern ESM |
| Redux for all state | TanStack Query for server state | 2022+ | Less boilerplate, better caching |
| Class components | Function components + hooks | 2019+ | Simpler code, better composition |
| CSS-in-JS (styled-components) | Tailwind CSS + shadcn/ui | 2023+ | Better performance, full code ownership |
| React Flow v10 | React Flow v12 (@xyflow/react) | 2024 | New package name, improved types |
| cacheTime in TanStack Query | gcTime | 2024 | Renamed for clarity |

**Deprecated/outdated:**
- Create React App: Unmaintained, slow, Vite recommended
- `reactflow` package: Use `@xyflow/react` (renamed)
- `cacheTime` option: Use `gcTime` in TanStack Query v5
- Redux for API data: TanStack Query handles server state better

## Open Questions

Things that couldn't be fully resolved:

1. **Full-text search performance on JSONB**
   - What we know: ILIKE on JSONB text cast works but may be slow at scale
   - What's unclear: At what entity count does this become a problem?
   - Recommendation: Start with ILIKE, add GIN index if performance degrades

2. **Inheritance chain resolution**
   - What we know: Categories have single `parent` field (multiple inheritance via array)
   - What's unclear: Should inheritance chain be resolved on backend or frontend?
   - Recommendation: Backend resolves full chain (recursive query), caches result

3. **Module membership display**
   - What we know: Modules reference categories by ID in `category_ids` array
   - What's unclear: Best way to show "this category belongs to X modules" without N+1 queries
   - Recommendation: Add API endpoint for module membership, or include in entity response

## Sources

### Primary (HIGH confidence)
- [React Flow Official Docs](https://reactflow.dev) - Custom nodes, dagre layout, performance guide
- [TanStack Query Overview](https://tanstack.com/query/latest/docs/framework/react/overview) - Setup, useQuery patterns
- [shadcn/ui Installation](https://ui.shadcn.com/docs/installation/vite) - Vite setup guide
- [Vite Getting Started](https://vite.dev/guide/) - Project scaffolding

### Secondary (MEDIUM confidence)
- [React Flow Dagre Example](https://reactflow.dev/examples/layout/dagre) - Layout implementation
- [TanStack Query Performance Guide](https://tanstack.com/query/latest/docs/framework/react/guides/request-waterfalls) - Waterfall avoidance
- [MUI X Tree View](https://mui.com/x/react-tree-view/) - Alternative tree component reference
- [PostgreSQL JSONB Search](https://hadlakmal.medium.com/how-to-search-json-data-from-postgresql-b0169cd6dff) - ILIKE patterns

### Tertiary (LOW confidence - needs validation)
- WebSearch results for "React Flow performance optimization" - Community patterns
- WebSearch results for "React debounce TypeScript" - Implementation variations
- Medium articles on TanStack Query patterns - Useful but not authoritative

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official docs, established ecosystem, NPM download stats confirm adoption
- React Flow patterns: HIGH - Official examples and documentation
- TanStack Query patterns: HIGH - Official documentation with code examples
- shadcn/ui setup: HIGH - Official installation guide
- Search implementation: MEDIUM - Common pattern but backend performance depends on data volume
- Used-by queries: MEDIUM - JSONB contains query is documented but needs performance testing

**Research date:** 2026-01-21
**Valid until:** ~30 days for stable components (React, TanStack Query), ~14 days for fast-moving (shadcn/ui components)
