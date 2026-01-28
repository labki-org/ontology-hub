# Phase 29: Frontend Graph Visualization - Research

**Researched:** 2026-01-28
**Domain:** React Flow graph visualization, custom node types, D3-force layout
**Confidence:** HIGH

## Summary

This phase extends the existing graph visualization to support Dashboard and Resource entity types. The codebase already has a robust graph infrastructure using @xyflow/react 12.10.0 with d3-force 3.0.0 for layout. The existing `GraphNode.tsx` component uses SVG shapes (rounded rect, diamond, hexagon, circle) to distinguish entity types with a consistent visual language.

The primary work involves:
1. Adding Dashboard and Resource entity types to the frontend types and GraphNode component
2. Extending the backend graph query service to include Dashboard and Resource nodes/edges
3. Adding edge type filters and styling for the new relationship types
4. Ensuring layout algorithms position new entity types appropriately

**Primary recommendation:** Extend the existing `GraphNode.tsx` pattern with two new shapes and colors for Dashboard (rounded rectangle, similar to Module) and Resource (small rectangle, compact form). Reuse existing patterns wholesale - this is additive extension, not architectural change.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xyflow/react | 12.10.0 | Graph visualization | Industry-standard React Flow library |
| d3-force | 3.0.0 | Force-directed layout | De facto standard for force simulation |
| @dagrejs/dagre | 1.1.8 | Hierarchical layout | Best hierarchical graph algorithm |

### Supporting (Already in Use)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| d3-polygon | 3.0.1 | Hull computation | Module hull boundaries |
| d3-shape | 3.2.0 | Shape generation | SVG path helpers |
| zustand | 5.0.10 | State management | Graph store for selection/filters |

### No New Dependencies Required
This phase requires NO new dependencies. All functionality can be built using existing libraries.

## Architecture Patterns

### Existing Project Structure (Relevant Files)
```
frontend/src/
├── api/
│   ├── graph.ts             # Graph API hooks (useFullOntologyGraph, etc.)
│   └── types.ts             # TypeScript types including GraphNode, GraphEdge
├── components/graph/
│   ├── GraphCanvas.tsx      # Main canvas with React Flow
│   ├── GraphNode.tsx        # Custom node component (SVG shapes)
│   ├── GraphControls.tsx    # Edge filters, layout controls
│   ├── HullLayer.tsx        # Module hull overlays
│   ├── useHybridLayout.ts   # Layout algorithms
│   └── useForceLayout.ts    # Force-directed layout
├── stores/
│   ├── graphStore.ts        # Graph state (selection, filters, layout)
│   └── hullStore.ts         # Module hull visibility
backend/app/
├── schemas/graph.py         # GraphNode, GraphEdge, GraphResponse schemas
└── services/graph_query.py  # Graph traversal queries
```

### Pattern 1: Entity Type Node Rendering
**What:** Single `GraphNode.tsx` component handles all entity types via switch/lookup
**When to use:** Always - centralized node rendering maintains consistency
**Example:**
```typescript
// Source: frontend/src/components/graph/GraphNode.tsx
const NODE_SIZES: Record<string, number> = {
  category: 80,
  subobject: 60,
  property: 50,
  template: 50,
  // Add new types here
  dashboard: 70,  // Similar to category
  resource: 45,   // Compact, smaller than property
}

const ENTITY_COLORS: Record<string, string> = {
  category: '#94a3b8',   // slate-400
  property: '#86efac',   // green-300
  subobject: '#c4b5fd',  // violet-300
  template: '#fcd34d',   // amber-300
  // Add new types
  dashboard: '#fca5a5',  // red-300 (distinct, warm)
  resource: '#a5f3fc',   // cyan-300 (distinct, cool)
}
```

### Pattern 2: Edge Type Styling
**What:** Edge colors and dash patterns in `GraphCanvas.tsx` helper functions
**When to use:** For each new edge type
**Example:**
```typescript
// Source: frontend/src/components/graph/GraphCanvas.tsx
function getEdgeColor(edgeType: string): string {
  switch (edgeType) {
    case 'parent': return '#475569'     // slate-600
    case 'property': return '#2563eb'   // blue-600
    case 'subobject': return '#7c3aed'  // violet-600
    case 'subobject_property': return '#0d9488'  // teal-600
    // Add new types
    case 'module_dashboard': return '#dc2626'  // red-600
    case 'category_resource': return '#0891b2' // cyan-600
    default: return '#475569'
  }
}
```

### Pattern 3: Graph Query Extension (Backend)
**What:** Add entity-type-specific neighborhood methods in `graph_query.py`
**When to use:** When new entity types need graph traversal
**Example:**
```python
# Source: backend/app/services/graph_query.py
async def get_neighborhood_graph(self, entity_key, entity_type, depth):
    # Dispatch to type-specific handlers
    if entity_type == "dashboard":
        return await self._get_dashboard_neighborhood(entity_key, depth)
    elif entity_type == "resource":
        return await self._get_resource_neighborhood(entity_key, depth)
```

### Anti-Patterns to Avoid
- **Separate node components per entity type:** Creates inconsistency. Use single GraphNode with type dispatch.
- **Hardcoded edge filters:** Edge types should be in graphStore.edgeTypeFilter, not conditionals.
- **Custom layout for new types:** Dashboard/Resource should use existing layout algorithms, not special-case code.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Node positioning | Manual coordinates | useHybridLayout / dagre | Layout algorithms handle clustering properly |
| Node collision | Manual spacing | forceCollide in d3-force | Handles edge cases automatically |
| Hover highlighting | Custom opacity logic | Existing GraphNode opacity pattern | Already works for all entity types |
| Edge filtering | New filter system | graphStore.edgeTypeFilter | Extensible by adding to Set |
| Module membership | Custom tracking | GraphNode.modules from API | Backend already computes this |

**Key insight:** The existing graph system is designed for extension. Adding new entity types means adding entries to lookup tables and extending backend queries - not new components or systems.

## Common Pitfalls

### Pitfall 1: Inconsistent Node Sizes Breaking Layout
**What goes wrong:** New nodes too large/small disrupt force-directed spacing
**Why it happens:** NODE_SIZES affects collision radius in layout
**How to avoid:** Keep new sizes within existing range (45-80px). Resource at 45px, Dashboard at 70px.
**Warning signs:** Nodes overlap or have excessive gaps after layout settles

### Pitfall 2: Missing Edge Type in Filter
**What goes wrong:** New edges always visible, can't be filtered
**Why it happens:** Forgot to add edge type to graphStore.edgeTypeFilter initial state
**How to avoid:** Add new edge types to both initial edgeTypeFilter Set and GraphControls checkboxes
**Warning signs:** No filter checkbox appears for new edge type

### Pitfall 3: Backend Query Missing Draft Overlay
**What goes wrong:** New entity nodes don't show change_status badges
**Why it happens:** Forgot to call draft_overlay.apply_overlay() in new neighborhood method
**How to avoid:** Follow existing pattern from _get_category_neighborhood
**Warning signs:** Dashboard/Resource nodes show no added/modified/deleted indicators in draft mode

### Pitfall 4: Graph Type Check Excludes New Types
**What goes wrong:** Selecting Dashboard/Resource shows "Graph view not available"
**Why it happens:** GRAPH_SUPPORTED_TYPES Set in GraphCanvas doesn't include new types
**How to avoid:** Add 'dashboard', 'resource' to GRAPH_SUPPORTED_TYPES
**Warning signs:** Entity detail panel opens but graph shows unsupported message

### Pitfall 5: Missing Border Color for Entity Type
**What goes wrong:** Nodes render with no visible border
**Why it happens:** ENTITY_BORDER_COLORS lookup returns undefined
**How to avoid:** Add entries to both ENTITY_COLORS and ENTITY_BORDER_COLORS
**Warning signs:** Nodes look "flat" without selection ring capability

## Code Examples

Verified patterns from existing codebase:

### Adding a New Node Shape (SVG Path)
```typescript
// Source: frontend/src/components/graph/GraphNode.tsx pattern

/**
 * Generate SVG path for a small rectangle centered at origin.
 * For Resource nodes - compact form suggesting data instances.
 */
function smallRectPath(size: number): string {
  const half = size / 2
  const radius = 4  // Small corner radius for subtle rounding
  return `
    M ${-half + radius} ${-half}
    H ${half - radius}
    Q ${half} ${-half} ${half} ${-half + radius}
    V ${half - radius}
    Q ${half} ${half} ${half - radius} ${half}
    H ${-half + radius}
    Q ${-half} ${half} ${-half} ${half - radius}
    V ${-half + radius}
    Q ${-half} ${-half} ${-half + radius} ${-half}
    Z
  `
}

// In getNodePath function:
case 'resource':
  return smallRectPath(size)
case 'dashboard':
  return roundedRectPath(size, 12)  // Reuse existing, larger radius
```

### Adding Edge Type to Graph Store
```typescript
// Source: frontend/src/stores/graphStore.ts pattern

const initialState = {
  // ... existing state
  edgeTypeFilter: new Set<string>([
    'parent',
    'property',
    'subobject',
    'subobject_property',
    // Add new edge types
    'module_dashboard',
    'category_resource',
  ]),
}
```

### Backend Neighborhood Query Pattern
```python
# Source: backend/app/services/graph_query.py pattern

async def _get_resource_neighborhood(
    self,
    entity_key: str,
    depth: int,
) -> GraphResponse:
    """Get neighborhood graph for a resource.

    Shows the resource as center node and its parent category.
    At depth > 1, includes category's parent categories.
    """
    # Verify resource exists
    resource_query = select(Resource).where(Resource.entity_key == entity_key)
    result = await self.session.execute(resource_query)
    resource = result.scalar_one_or_none()

    if not resource:
        # Check draft creates
        draft_creates = await self.draft_overlay.get_draft_creates("resource")
        draft_match = next(
            (r for r in draft_creates if r.get("entity_key") == entity_key),
            None,
        )
        if not draft_match:
            raise ValueError(f"Resource '{entity_key}' not found")
        # Return isolated draft node
        return GraphResponse(
            nodes=[
                GraphNode(
                    id=entity_key,
                    label=draft_match.get("label", entity_key),
                    entity_type="resource",
                    depth=0,
                    modules=[],
                    change_status="added",
                )
            ],
            edges=[],
            has_cycles=False,
        )

    # Get parent category
    category_key = resource.category_key
    # ... continue with category traversal
```

### Extending Full Ontology Graph
```python
# Source: backend/app/services/graph_query.py pattern (get_full_ontology_graph)

# After existing entity loops, add:

# Get all dashboards
dashboards_query = select(Dashboard)
result = await self.session.execute(dashboards_query)
dashboards = result.scalars().all()

for dashboard in dashboards:
    effective = await self.draft_overlay.apply_overlay(
        dashboard, "dashboard", dashboard.entity_key
    )
    change_status = effective.get("_change_status") if effective else None

    nodes.append(
        GraphNode(
            id=dashboard.entity_key,
            label=dashboard.label,
            entity_type="dashboard",
            depth=None,
            modules=[],  # Dashboard module membership from ModuleDashboard table
            change_status=change_status,
        )
    )

# Get module -> dashboard edges from ModuleDashboard table
dashboard_edge_query = text("""
    SELECT m.entity_key as module_key, d.entity_key as dashboard_key
    FROM module_dashboard md
    JOIN modules_v2 m ON m.id = md.module_id
    JOIN dashboards d ON d.id = md.dashboard_id
""")
result = await self.session.execute(dashboard_edge_query)
for row in result.fetchall():
    edges.append(
        GraphEdge(
            source=row.module_key,
            target=row.dashboard_key,
            edge_type="module_dashboard",
        )
    )
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-flow (v10) | @xyflow/react (v12) | 2024 | Package rename, same API |
| d3-force v2 | d3-force v3 | 2022 | Minor API changes, better types |
| Manual node components | Single component with type dispatch | Existing | Consistency, maintainability |

**Current in codebase:**
- @xyflow/react 12.10.0 (latest stable)
- d3-force 3.0.0 (latest stable)
- React 19.2.0 (latest)

No deprecated patterns in use. The codebase follows current best practices.

## Open Questions

Things that couldn't be fully resolved:

1. **Dashboard module membership**
   - What we know: ModuleDashboard junction table exists
   - What's unclear: Should dashboards appear in module hulls?
   - Recommendation: Yes, add module membership to dashboard nodes for hull grouping

2. **Resource clustering strategy**
   - What we know: Resources belong to categories via category_key
   - What's unclear: How to cluster many resources under one category without clutter
   - Recommendation: Follow existing property pattern (they cluster similarly), consider depth-based filtering

3. **Edge type naming convention**
   - What we know: Existing types use snake_case (subobject_property)
   - What's unclear: Should new edges be "module_dashboard" or "dashboard" (simpler)?
   - Recommendation: Use descriptive snake_case for consistency: "module_dashboard", "category_resource"

## Sources

### Primary (HIGH confidence)
- **Codebase analysis:** Direct examination of frontend/src/components/graph/*.tsx
- **Codebase analysis:** Direct examination of backend/app/services/graph_query.py
- **package.json:** Version numbers verified from frontend/package.json

### Secondary (MEDIUM confidence)
- **React Flow 12 patterns:** Based on API usage in GraphCanvas.tsx matches v12 documentation patterns

### Tertiary (LOW confidence)
- None - all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions verified from package.json, patterns from codebase
- Architecture: HIGH - patterns extracted directly from existing implementation
- Pitfalls: HIGH - based on actual codebase patterns and requirements

**Research date:** 2026-01-28
**Valid until:** 60 days (stable codebase, no major changes expected)
