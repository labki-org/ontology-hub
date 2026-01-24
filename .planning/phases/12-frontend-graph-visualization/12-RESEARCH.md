# Phase 12: Frontend + Graph Visualization - Research

**Researched:** 2026-01-24
**Domain:** React frontend development, graph visualization, split-panel layouts
**Confidence:** HIGH

## Summary

Phase 12 builds a unified browse/draft frontend with interactive graph visualization. The existing frontend codebase already uses **React Flow (@xyflow/react v12.10.0)** with dagre layout for inheritance graphs, providing a strong foundation to build upon. The backend provides v2.0 API endpoints (`/api/v2/categories`, `/api/v2/graph/neighborhood`) with draft overlay support, returning nodes with module membership for hull rendering.

The standard approach is to continue with React Flow for force-directed layouts, use d3-polygon for convex hull computation (as required by GV-04), and implement split panels using react-resizable-panels. The existing pattern of zustand for state management, TanStack Query for data fetching, and shadcn/ui components should be maintained for consistency.

**Primary recommendation:** Build on existing React Flow implementation, add force-directed layout using d3-force integration, render module hulls as SVG overlays with d3-polygon, and use react-resizable-panels for split-panel layout.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xyflow/react | 12.10.0 | Graph visualization | Already in use, supports custom layouts, DOM-based nodes allow rich interactions |
| @dagrejs/dagre | 1.1.8 | Hierarchical layout | Already used for inheritance graphs, well-tested for directed graphs |
| react-router-dom | 7.12.0 | Routing | Already in use, v7 has modern APIs for loaders and actions |
| @tanstack/react-query | 5.90.19 | Server state management | Already used throughout codebase for data fetching |
| zustand | 5.0.10 | Client state management | Already used for draft state with immer middleware |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| d3-polygon | latest (v3.0.1) | Convex hull computation | Required for GV-04 module hull overlays |
| d3-force | latest (v7.0.0) | Force-directed layout | For interactive graph with physics simulation |
| react-resizable-panels | latest | Split-panel layout | Resizable graph/detail panels with persistence |
| lucide-react | 0.562.0 | Icons | Already in use, consistent with existing UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Flow | react-force-graph | react-force-graph has higher download stats but uses Canvas/WebGL; React Flow uses DOM nodes which allow richer interactions (hover tooltips, click handlers) needed for entity navigation |
| React Flow | reagraph | reagraph is WebGL-based for performance but less flexible for custom node rendering; our graph size is moderate (dozens of nodes) so DOM performance is acceptable |
| dagre layout | d3-force only | dagre provides stable hierarchical layout; d3-force is better for interactive exploration but requires user intervention to stabilize |

**Installation:**
```bash
cd frontend
npm install d3-polygon d3-force react-resizable-panels
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── components/
│   ├── graph/                  # Graph visualization components
│   │   ├── CategoryGraph.tsx   # Force-directed category graph (new)
│   │   ├── GraphCanvas.tsx     # Main graph container with hulls (new)
│   │   ├── ModuleHull.tsx      # SVG hull overlay component (new)
│   │   ├── InheritanceGraph.tsx # Existing dagre-based graph
│   │   └── useForceLayout.ts   # d3-force integration hook (new)
│   ├── layout/
│   │   ├── SplitLayout.tsx     # Resizable panels wrapper (new)
│   │   └── Sidebar.tsx         # Existing sidebar with search
│   ├── entity/                 # Entity detail components (existing)
│   └── draft/                  # Draft mode components (existing)
├── pages/
│   ├── BrowsePage.tsx          # New unified browse/draft page
│   └── [existing pages]
├── stores/
│   ├── graphStore.ts           # Graph interaction state (new)
│   └── draftStore.ts           # Existing draft state
└── api/
    ├── graph.ts                # Graph API client (new)
    └── [existing API modules]
```

### Pattern 1: Force-Directed Layout with React Flow
**What:** Integrate d3-force simulation with React Flow for interactive graph positioning
**When to use:** Category-centered graph view with expandable neighborhoods
**Example:**
```typescript
// Source: React Flow force layout docs + existing useGraphLayout.ts pattern
import { useEffect, useRef } from 'react'
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force'
import type { Node, Edge } from '@xyflow/react'

export function useForceLayout(nodes: Node[], edges: Edge[]) {
  const simulationRef = useRef<any>(null)

  useEffect(() => {
    if (!nodes.length) return

    // Create d3-force simulation
    const simulation = forceSimulation(nodes)
      .force('charge', forceManyBody().strength(-1000))
      .force('center', forceCenter(0, 0))
      .force('link', forceLink(edges)
        .id((d: any) => d.id)
        .distance(100))

    // Update React Flow node positions on each tick
    simulation.on('tick', () => {
      // Update node positions via React Flow's setNodes
      setNodes(nodes => nodes.map(node => ({
        ...node,
        position: {
          x: simulation.nodes().find(n => n.id === node.id)?.x ?? 0,
          y: simulation.nodes().find(n => n.id === node.id)?.y ?? 0
        }
      })))
    })

    simulationRef.current = simulation
    return () => simulation.stop()
  }, [nodes, edges])

  return simulationRef
}
```

### Pattern 2: Module Hull Rendering with d3-polygon
**What:** Compute convex hulls for module groups and render as SVG overlays
**When to use:** GV-04 requirement for module visualization
**Example:**
```typescript
// Source: d3-polygon docs + React Flow custom layers
import { polygonHull } from 'd3-polygon'
import { useNodes } from '@xyflow/react'

export function ModuleHull({ moduleId, color }: { moduleId: string, color: string }) {
  const nodes = useNodes()

  // Filter nodes belonging to this module
  const moduleNodes = nodes.filter(n =>
    n.data.modules?.includes(moduleId)
  )

  // Extract positions for hull computation
  const points = moduleNodes.map(n => [n.position.x, n.position.y] as [number, number])

  // Compute convex hull (returns null if < 3 points)
  const hull = polygonHull(points)

  if (!hull || hull.length < 3) return null

  // Convert to SVG path
  const pathData = `M${hull.map(p => p.join(',')).join('L')}Z`

  return (
    <path
      d={pathData}
      fill={color}
      fillOpacity={0.15}
      stroke={color}
      strokeWidth={2}
      strokeOpacity={0.4}
      pointerEvents="none"
    />
  )
}
```

### Pattern 3: Split-Panel Layout with Persistence
**What:** Resizable panels for graph and detail views with localStorage persistence
**When to use:** Main browse page layout (FE-06 requirement)
**Example:**
```typescript
// Source: react-resizable-panels docs
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

export function BrowsePage() {
  return (
    <PanelGroup direction="vertical" autoSaveId="browse-layout">
      <Panel defaultSize={60} minSize={30}>
        <GraphCanvas />
      </Panel>
      <PanelResizeHandle className="h-1 bg-border hover:bg-primary" />
      <Panel defaultSize={40} minSize={20}>
        <EntityDetail />
      </Panel>
    </PanelGroup>
  )
}
```

### Pattern 4: Draft Context Integration
**What:** Pass draft_id query param to API endpoints, apply change status to graph nodes
**When to use:** All data fetching when in draft mode
**Example:**
```typescript
// Source: Existing draft API pattern from entities_v2.py
import { useQuery } from '@tanstack/react-query'
import { useDraftStore } from '@/stores/draftStore'

export function useNeighborhoodGraph(entityKey: string, depth: number = 2) {
  const draft = useDraftStore(s => s.draft)

  return useQuery({
    queryKey: ['graph', 'neighborhood', entityKey, depth, draft?.id],
    queryFn: async () => {
      const params = new URLSearchParams({
        entity_key: entityKey,
        depth: String(depth)
      })
      if (draft?.id) params.set('draft_id', draft.id)

      return apiFetch<GraphResponse>(`/api/v2/graph/neighborhood?${params}`)
    }
  })
}
```

### Anti-Patterns to Avoid
- **Direct DOM manipulation:** Don't use d3-selection to manipulate graph DOM; let React Flow handle rendering and use d3 only for layout computation
- **Force simulation forever:** Don't run d3-force continuously after initial layout; add toggle or automatic stop after stabilization to avoid performance hit
- **N+1 queries for module membership:** Backend already batches module lookups; don't make separate API calls per node
- **Rebuilding hulls on every tick:** Compute hulls only when nodes stop moving or on user-triggered refresh

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Convex hull algorithm | Custom polygon boundary calculation | d3-polygon polygonHull() | Andrew's monotone chain algorithm is non-trivial; handles edge cases like collinear points and null return for < 3 points |
| Force-directed layout | Custom physics simulation | d3-force with forceSimulation() | Sophisticated velocity Verlet integration, configurable forces, collision detection already implemented |
| Resizable panels | Custom resize handlers with mouse events | react-resizable-panels | Handles keyboard navigation, touch support, min/max constraints, persistence out of the box |
| Graph cycle detection | Application-layer graph traversal | Backend recursive CTE already provides has_cycles flag | Path-based cycle detection with infinite loop prevention already implemented |
| Change status badges | Custom diff computation | Backend draft overlay service provides change_status field | JSON Patch application and status computation already handled server-side |

**Key insight:** Graph algorithms (hulls, force simulation, cycle detection) have subtle edge cases. Use battle-tested libraries rather than reimplementing.

## Common Pitfalls

### Pitfall 1: React State Mutation with d3-force
**What goes wrong:** d3-force mutates node objects directly (adds x, y, vx, vy properties), causing React state mutation warnings
**Why it happens:** d3-force expects mutable objects; React prefers immutability
**How to avoid:** Clone nodes before passing to simulation, or use useCallback to safely update positions
**Warning signs:** Console warnings about direct state mutation, nodes not updating positions

### Pitfall 2: Force Simulation Performance on Larger Graphs
**What goes wrong:** Running force simulation on every render with 100+ nodes causes lag
**Why it happens:** Force simulation is computationally expensive, especially with many-body forces
**How to avoid:** Add toggle to pause/resume simulation, stop simulation after alpha < threshold (stabilized), use forceSimulation.stop() when not needed
**Warning signs:** Choppy interaction, high CPU usage, browser unresponsiveness

### Pitfall 3: Hull Rendering Z-Index Issues
**What goes wrong:** Hull overlays obscure nodes or prevent node interactions
**Why it happens:** SVG rendering order and pointer-events interaction
**How to avoid:** Render hulls in separate SVG layer below nodes, use pointerEvents="none" on hull paths, ensure React Flow nodes are in DOM layer above hulls
**Warning signs:** Unable to click on nodes inside hulls, hulls blocking tooltips

### Pitfall 4: Module Hull Color Collision
**What goes wrong:** Auto-assigned colors for modules are too similar or hard to distinguish when overlapping
**Why it happens:** Simple color generation (hue rotation) doesn't account for perceptual differences
**How to avoid:** Use predefined palette with high contrast (e.g., Tailwind's color scale), track used colors to maximize distance
**Warning signs:** User confusion about which nodes belong to which module, overlapping hulls appear muddy

### Pitfall 5: Draft Mode URL State Sync
**What goes wrong:** Entering draft mode via URL parameter doesn't update header UI, or vice versa
**Why it happens:** Multiple sources of truth for draft state (URL param, zustand store, query string)
**How to avoid:** Use URL as single source of truth for draft_id, sync zustand store from URL on mount, update URL when switching drafts via selector
**Warning signs:** Draft banner shows but data is canonical, or banner hidden but data shows draft changes

### Pitfall 6: React Flow fitView on Empty Graph
**What goes wrong:** fitView() errors or produces NaN positions when graph has no nodes
**Why it happens:** fitView calculates bounds from node positions; empty array causes division by zero
**How to avoid:** Conditional fitView only when nodes.length > 0, or guard with try/catch
**Warning signs:** Console errors about invalid positions, blank graph viewport

## Code Examples

Verified patterns from official sources:

### Graph API Client Hook
```typescript
// Source: Existing API pattern + backend graph.py endpoint
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'

export interface GraphNode {
  id: string
  label: string
  entity_type: string
  depth?: number
  modules: string[]
  change_status?: 'added' | 'modified' | 'deleted' | 'unchanged'
}

export interface GraphEdge {
  source: string
  target: string
  edge_type: string
}

export interface GraphResponse {
  nodes: GraphNode[]
  edges: GraphEdge[]
  has_cycles: boolean
}

export function useNeighborhoodGraph(
  entityKey: string,
  entityType: string = 'category',
  depth: number = 2,
  draftId?: string
) {
  return useQuery({
    queryKey: ['graph', 'neighborhood', entityKey, entityType, depth, draftId],
    queryFn: async () => {
      const params = new URLSearchParams({
        entity_key: entityKey,
        entity_type: entityType,
        depth: String(depth),
      })
      if (draftId) params.set('draft_id', draftId)

      return apiFetch<GraphResponse>(`/api/v2/graph/neighborhood?${params}`)
    },
    enabled: !!entityKey,
  })
}
```

### Module Hull Toggle State
```typescript
// Source: Phase context requirements + zustand pattern
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface HullState {
  visibleModules: Set<string>
  toggleModule: (moduleId: string) => void
  showAll: () => void
  hideAll: () => void
  setVisible: (moduleIds: string[]) => void
}

export const useHullStore = create<HullState>()(
  persist(
    (set) => ({
      visibleModules: new Set<string>(),

      toggleModule: (moduleId) =>
        set((state) => {
          const next = new Set(state.visibleModules)
          if (next.has(moduleId)) {
            next.delete(moduleId)
          } else {
            next.add(moduleId)
          }
          return { visibleModules: next }
        }),

      showAll: () =>
        set({ visibleModules: new Set<string>() }), // Empty set = show all

      hideAll: () =>
        set({ visibleModules: new Set(['__none__']) }), // Special marker

      setVisible: (moduleIds) =>
        set({ visibleModules: new Set(moduleIds) }),
    }),
    {
      name: 'hull-visibility',
      // Custom storage for Set serialization
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const parsed = JSON.parse(str)
          return {
            state: {
              ...parsed.state,
              visibleModules: new Set(parsed.state.visibleModules),
            },
          }
        },
        setItem: (name, value) => {
          localStorage.setItem(
            name,
            JSON.stringify({
              state: {
                ...value.state,
                visibleModules: Array.from(value.state.visibleModules),
              },
            })
          )
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
)
```

### Draft Mode URL Integration
```typescript
// Source: Existing draft routing pattern from App.tsx
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useDraftStore } from '@/stores/draftStore'
import { useDraft } from '@/api/drafts'

export function useDraftFromUrl() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const setDraft = useDraftStore(s => s.setDraft)
  const reset = useDraftStore(s => s.reset)

  const draftId = searchParams.get('draft_id')
  const { data: draft, isLoading, error } = useDraft(draftId ?? '', {
    enabled: !!draftId,
  })

  useEffect(() => {
    if (draft) {
      setDraft(draft, draft.diff_preview!)
    } else if (!draftId) {
      reset()
    }
  }, [draft, draftId, setDraft, reset])

  const enterDraftMode = (token: string) => {
    navigate(`?draft_id=${token}`)
  }

  const exitDraftMode = () => {
    navigate({ search: '' })
    reset()
  }

  return { draft, isLoading, error, enterDraftMode, exitDraftMode }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-flow (npm package) | @xyflow/react | 2024 (v12) | React Flow rebranded to xyflow, added Svelte support; API mostly compatible but import paths changed |
| Manual collision detection | forceCollide with custom rectCollide | Ongoing | d3-force's built-in forceCollide assumes circular nodes; rectangular collision requires custom force function |
| JSON Patch client-side | Server-side overlay with jsonpatch | Phase 10 | Draft overlay computation moved to backend for consistency; frontend just consumes effective data |
| dagre-d3-react | @dagrejs/dagre + React Flow | 2023 | dagre-d3-react unmaintained; modern pattern uses pure dagre for layout computation, React Flow for rendering |

**Deprecated/outdated:**
- react-split-pane: Unmaintained since 2020; replaced by react-resizable-panels or allotment
- d3-force v6: Version 7 has breaking changes (force.strength() signature); check docs when upgrading
- React Flow < v11: Pre-v11 used different handle positioning; v12 is current stable

## Open Questions

Things that couldn't be fully resolved:

1. **Progressive graph expansion UX**
   - What we know: Context specifies "click node to expand/collapse neighborhood" for progressive exploration
   - What's unclear: Does expand mean fetch additional depth levels via API, or reveal already-fetched nodes? Does collapse hide descendants or just collapse visual grouping?
   - Recommendation: Start with visual expand/collapse (show/hide existing nodes in graph state), add API-based depth expansion in Phase 13 if needed

2. **Module hull color assignment algorithm**
   - What we know: Requirements say "colors auto-assigned by system (distinct palette)"
   - What's unclear: Should colors be deterministic (same module always same color) or assigned in order of appearance? How many modules do we expect simultaneously visible?
   - Recommendation: Use deterministic hash-based color assignment (hash module_id to palette index) for consistency across page refreshes; start with 12-color palette (Tailwind's color scale)

3. **Force simulation stabilization threshold**
   - What we know: Running simulation forever is bad for performance
   - What's unclear: What alpha threshold indicates "stable enough" to stop simulation? Should it auto-stop or require user action?
   - Recommendation: Auto-stop when simulation.alpha() < 0.01 (d3-force default minimum), add manual "Resume Layout" button for user-initiated rearrangement

4. **Draft mode entry points**
   - What we know: Context says "both URL-based and selector-based entry"
   - What's unclear: Does selector appear in header always, or only when user has active drafts? How do users discover draft URLs?
   - Recommendation: Always show draft selector in header (empty state prompts user to create draft), support both ?draft_id=uuid and /draft/{token} routes for flexibility

## Sources

### Primary (HIGH confidence)
- Existing frontend codebase: /home/daharoni/dev/ontology-hub/frontend/src
- Backend API: /home/daharoni/dev/ontology-hub/backend/app/routers/entities_v2.py, graph.py
- Package dependencies: frontend/package.json (verified installed versions)

### Secondary (MEDIUM confidence)
- [React Flow force layout example](https://reactflow.dev/examples/layout/force-layout) - Official React Flow docs
- [React Flow layouting overview](https://reactflow.dev/learn/layouting/layouting) - Layout integration patterns
- [d3-polygon documentation](https://d3js.org/d3-polygon) - Official D3 docs for polygonHull
- [d3-polygon GitHub](https://github.com/d3/d3-polygon) - Source and version info
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels) - Official library repository

### Tertiary (LOW confidence - WebSearch only)
- [react-force-graph vs react-flow comparison](https://npmtrends.com/dagre-d3-react-vs-react-flow-vs-react-force-graph-vs-react-graph-vis-vs-react-node-graph-vs-react-vis-force) - Download statistics
- [D3 + React integration guide](https://medium.com/@qdangdo/visualizing-connections-a-guide-to-react-d3-force-graphs-typescript-74b7af728c90) - Community best practices
- [React resizable panels comparison](https://github.com/KenanYusuf/react-resplit) - Alternative libraries

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified in package.json or official docs
- Architecture: HIGH - Patterns derived from existing codebase structure
- Pitfalls: MEDIUM - Based on known d3-force/React integration issues, not project-specific testing

**Research date:** 2026-01-24
**Valid until:** 2026-02-24 (30 days - frontend libraries evolve quickly but existing stack is stable)
