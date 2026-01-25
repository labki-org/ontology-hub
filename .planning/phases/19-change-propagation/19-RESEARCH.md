# Phase 19: Change Propagation - Research

**Researched:** 2026-01-25
**Domain:** React state management, dependency graph traversal, conditional UI highlighting
**Confidence:** HIGH

## Summary

This phase implements visual change impact display for a React/TypeScript application using Zustand state management, React Flow (@xyflow/react) for graph visualization, and Tailwind CSS for styling. The goal is to show users which entities were directly edited and which are transitively affected through dependencies.

The research focused on three core technical challenges: (1) computing transitive dependencies from a graph structure, (2) conditionally styling React components and graph nodes based on change status, and (3) displaying inheritance chains in detail modals. The existing codebase already uses Zustand for state management, React Flow for graph visualization, and has established patterns for entity detail modals.

**Primary recommendation:** Use a custom dependency graph data structure to compute transitive dependencies at edit-time, store affected entity sets in Zustand, and apply conditional styling via className/style props on existing sidebar and graph components.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zustand | 5.0.10 | State management for affected entities | Already in use, supports immer for Set/Map updates |
| @xyflow/react | 12.10.0 | Graph visualization with conditional node styling | Already in use, custom node components support dynamic styling |
| Tailwind CSS | 4.1.18 | Conditional background highlighting | Already in use, utility classes for background colors and opacity |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dependency-graph | Latest (npm) | Transitive dependency calculation | Optional - provides dependantsOf() for reverse dependencies |
| clsx / tailwind-merge | 3.4.0 (tw-merge already installed) | Conditional class composition | Already in use via cn() utility |
| immer | 11.1.3 | Immutable Set/Map updates in Zustand | Already in use with Zustand middleware |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| dependency-graph package | Hand-rolled BFS/DFS traversal | Hand-rolled is simpler for this use case (no package dependency), but dependency-graph provides battle-tested API |
| Zustand store | React Context/useState | Zustand already established, provides better performance for graph-wide state |

**Installation:**
```bash
# Optional - only if using dependency-graph package
npm install dependency-graph
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── stores/
│   ├── draftStoreV2.ts       # Extend with affected entity tracking
│   └── graphStore.ts          # Extend with highlight state
├── components/
│   ├── layout/
│   │   └── SidebarV2.tsx      # Add background highlighting to EntitySection
│   ├── graph/
│   │   └── GraphNode.tsx      # Add transitive effect styling
│   └── entity/
│       └── detail/
│           └── CategoryDetail.tsx  # Add inheritance chain section
└── lib/
    └── dependencyGraph.ts     # Dependency calculation utilities
```

### Pattern 1: Transitive Dependency Calculation
**What:** Compute all entities transitively affected by an edit using reverse dependency traversal
**When to use:** After any entity edit to determine propagation scope
**Example:**
```typescript
// Option 1: Hand-rolled BFS for reverse dependencies
function computeAffectedEntities(
  editedEntityKey: string,
  allEntities: GraphNode[],
  allEdges: GraphEdge[]
): Set<string> {
  const affected = new Set<string>()
  const queue = [editedEntityKey]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    // Find all entities that depend on current (reverse edges)
    for (const edge of allEdges) {
      if (edge.target === current && !visited.has(edge.source)) {
        affected.add(edge.source)
        queue.push(edge.source)
      }
    }
  }

  return affected
}

// Option 2: Using dependency-graph package
import { DepGraph } from 'dependency-graph'

function buildDependencyGraph(
  entities: GraphNode[],
  edges: GraphEdge[]
): DepGraph<string> {
  const graph = new DepGraph<string>()

  entities.forEach(e => graph.addNode(e.id))
  edges.forEach(e => graph.addDependency(e.source, e.target))

  return graph
}

const affected = graph.dependantsOf(editedEntityKey) // Returns transitive dependants
```

### Pattern 2: Zustand Store for Change Tracking
**What:** Extend draft store to track directly edited and transitively affected entities
**When to use:** Store change state globally for access in sidebar and graph components
**Example:**
```typescript
// Extend draftStoreV2.ts
interface DraftStoreV2State {
  // ... existing state
  directlyEditedEntities: Set<string>      // entity_keys
  transitivelyAffectedEntities: Set<string>  // entity_keys

  // Actions
  markEntityEdited: (entityKey: string) => void
  computeAffectedEntities: (
    entityKey: string,
    entities: GraphNode[],
    edges: GraphEdge[]
  ) => void
  clearChangeTracking: () => void
}

export const useDraftStoreV2 = create<DraftStoreV2State>()(
  immer((set) => ({
    // ... existing state
    directlyEditedEntities: new Set<string>(),
    transitivelyAffectedEntities: new Set<string>(),

    markEntityEdited: (entityKey) => {
      set((state) => {
        state.directlyEditedEntities.add(entityKey)
      })
    },

    computeAffectedEntities: (entityKey, entities, edges) => {
      set((state) => {
        const affected = computeAffectedEntities(entityKey, entities, edges)
        // Remove direct edit from transitive set (direct wins)
        affected.delete(entityKey)
        state.transitivelyAffectedEntities = affected
      })
    },

    clearChangeTracking: () => {
      set((state) => {
        state.directlyEditedEntities.clear()
        state.transitivelyAffectedEntities.clear()
      })
    },
  }))
)
```

### Pattern 3: Conditional Sidebar Highlighting
**What:** Apply background colors to sidebar items based on change status
**When to use:** In EntitySection component to highlight affected entities
**Example:**
```typescript
// In SidebarV2.tsx EntitySection
function EntitySection({ entities, ... }: EntitySectionProps) {
  const directEdits = useDraftStoreV2((s) => s.directlyEditedEntities)
  const transitiveAffects = useDraftStoreV2((s) => s.transitivelyAffectedEntities)

  return (
    <ul>
      {entities.map((entity) => {
        const isDirectEdit = directEdits.has(entity.entity_key)
        const isTransitiveEffect = transitiveAffects.has(entity.entity_key)

        return (
          <li key={entity.entity_key}>
            <button
              className={cn(
                'flex items-center gap-2 w-full px-2 py-1 text-sm rounded',
                'hover:bg-sidebar-accent truncate text-left',
                isDirectEdit && 'bg-blue-100 dark:bg-blue-900/30',
                isTransitiveEffect && 'bg-blue-50 dark:bg-blue-900/10',
                entity.change_status === 'deleted' && 'line-through text-muted-foreground'
              )}
              title={entity.label}
            >
              {/* ... existing content */}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
```

### Pattern 4: Conditional Graph Node Styling
**What:** Update node fill color based on direct edit or transitive effect status
**When to use:** In GraphNode component to visually match sidebar highlighting
**Example:**
```typescript
// In GraphNode.tsx
function GraphNodeComponent({ data }: { data: GraphNodeData }) {
  const directEdits = useDraftStoreV2((s) => s.directlyEditedEntities)
  const transitiveAffects = useDraftStoreV2((s) => s.transitivelyAffectedEntities)

  const isDirectEdit = directEdits.has(data.entity_key)
  const isTransitiveEffect = transitiveAffects.has(data.entity_key)

  const entityType = data.entity_type ?? 'category'
  let fillColor = ENTITY_COLORS[entityType] ?? '#94a3b8'

  // Override fill for change propagation (direct edit wins)
  if (isDirectEdit) {
    fillColor = '#93c5fd' // blue-300
  } else if (isTransitiveEffect) {
    fillColor = '#dbeafe' // blue-100
  }

  // ... rest of component
  return (
    <svg>
      <path d={path} fill={fillColor} stroke={borderColor} strokeWidth={2} />
      {/* ... */}
    </svg>
  )
}
```

### Pattern 5: Edge Change Indicators
**What:** Style edges differently for new/deleted inheritance relationships
**When to use:** When edges themselves have change_status metadata
**Example:**
```typescript
// When building edges array for React Flow
const edges: Edge[] = graphEdges.map((edge) => {
  const isNewEdge = edge.change_status === 'added'
  const isDeletedEdge = edge.change_status === 'deleted'

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 15,
      height: 15,
      color: isNewEdge ? '#22c55e' : isDeletedEdge ? '#888' : '#888',
    },
    style: {
      stroke: isNewEdge ? '#22c55e' : '#888',  // green-500 for new
      strokeWidth: 1.5,
      opacity: isDeletedEdge ? 0.3 : 1,
      strokeDasharray: isDeletedEdge ? '5,5' : undefined,
    },
    data: {
      change_status: edge.change_status,
    },
  }
})
```

### Pattern 6: Inheritance Chain Display
**What:** Show clickable ancestry path in detail modal
**When to use:** In CategoryDetail component to show inheritance chain with edited ancestors highlighted
**Example:**
```typescript
// Add to CategoryDetail.tsx
function CategoryDetail({ entityKey, draftId }: CategoryDetailProps) {
  const { data: category } = useCategory(entityKey, draftId)
  const directEdits = useDraftStoreV2((s) => s.directlyEditedEntities)
  const openDetail = useDetailStore((s) => s.openDetail)

  // Compute inheritance chain (breadth-first from current to roots)
  const inheritanceChain = useMemo(() => {
    if (!category?.parents?.length) return []
    // Fetch parent categories and build chain
    // This would use a hook like useCategories to fetch parent details
    return category.parents.map(parentKey => ({
      entity_key: parentKey,
      label: parentKey, // Would come from fetched data
      isEdited: directEdits.has(parentKey),
    }))
  }, [category, directEdits])

  return (
    <div>
      {/* ... existing sections */}

      {inheritanceChain.length > 0 && (
        <AccordionSection title="Inheritance Chain" defaultOpen={false}>
          <div className="space-y-1">
            {inheritanceChain.map((ancestor) => (
              <button
                key={ancestor.entity_key}
                onClick={() => openDetail(ancestor.entity_key, 'category')}
                className={cn(
                  'w-full text-left px-2 py-1 text-sm rounded',
                  'hover:bg-sidebar-accent',
                  ancestor.isEdited && 'bg-blue-100 dark:bg-blue-900/30 font-medium'
                )}
              >
                {ancestor.label}
                {ancestor.isEdited && (
                  <Badge variant="secondary" className="ml-2">edited</Badge>
                )}
              </button>
            ))}
          </div>
        </AccordionSection>
      )}
    </div>
  )
}
```

### Anti-Patterns to Avoid
- **Computing affected entities on every render:** Pre-compute and store in Zustand, only recompute on edit
- **Using string interpolation for Tailwind classes:** Tailwind purges dynamic classes; use complete class names with conditional logic
- **Combining direct edit and transitive effect styles:** Direct edit should win (user decision from CONTEXT.md)
- **Highlighting edges for content changes:** User decided edges only highlight for structural changes (added/deleted relationships)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transitive closure calculation | Recursive function without cycle detection | dependency-graph npm package or well-tested BFS with visited set | Cycles can cause infinite loops, off-by-one errors in traversal are common |
| Conditional class composition | Manual string concatenation | clsx/tailwind-merge (already in codebase as cn()) | Handles conflicts, deduplication, falsy values correctly |
| Immutable Set updates | Spread operator on Sets | immer middleware (already configured in Zustand) | Sets don't spread correctly, immer handles this transparently |
| Background color opacity | Custom hex color calculations | Tailwind opacity utilities (bg-blue-100, bg-blue-900/30) | Handles dark mode, maintains accessibility, consistent palette |

**Key insight:** Dependency graph traversal is error-prone (cycles, performance, correctness). Use established algorithm implementations or well-tested patterns with visited sets.

## Common Pitfalls

### Pitfall 1: Dynamic Tailwind Class Names
**What goes wrong:** Using `bg-${color}-500` doesn't work because Tailwind purges these classes during build
**Why it happens:** Tailwind's JIT compiler only generates CSS for complete class names found in code
**How to avoid:** Use complete class names with ternary operators: `className={isEdit ? 'bg-blue-100' : 'bg-blue-50'}`
**Warning signs:** Styles work in development but disappear in production builds

### Pitfall 2: Infinite Loops in Dependency Traversal
**What goes wrong:** Circular dependencies cause stack overflow or infinite loops
**Why it happens:** Not tracking visited nodes during graph traversal
**How to avoid:** Always maintain a visited Set and check before adding to queue
**Warning signs:** Browser hangs, stack overflow errors in console

### Pitfall 3: Stale Affected Entity Sets
**What goes wrong:** Affected entity highlighting doesn't update after edits
**Why it happens:** Not recomputing transitive dependencies when changes occur
**How to avoid:** Trigger `computeAffectedEntities()` in edit mutation callbacks
**Warning signs:** First edit highlights correctly, subsequent edits don't update

### Pitfall 4: Opacity vs Background Color
**What goes wrong:** Using `opacity` property makes child text transparent too
**Why it happens:** CSS opacity applies to entire element tree
**How to avoid:** Use RGBA colors or Tailwind's color/opacity utilities (e.g., `bg-blue-900/10` for 10% opacity)
**Warning signs:** Text becomes hard to read, icons look faded

### Pitfall 5: Edge Styling Without Custom Edge Types
**What goes wrong:** Edge styles don't update dynamically based on data
**Why it happens:** React Flow edges need style in edge definition, not custom component
**How to avoid:** Add `style` and `data` properties to edge objects when building edges array
**Warning signs:** Edges always look the same regardless of change status

### Pitfall 6: Not Handling Direct + Transitive Overlap
**What goes wrong:** Entity shows both direct and transitive styling (conflicting backgrounds)
**Why it happens:** Not implementing precedence rule (direct wins)
**How to avoid:** Check `isDirectEdit` first, only apply transitive styling if not direct
**Warning signs:** Background colors look wrong, darker than expected

## Code Examples

Verified patterns from official sources:

### Computing Affected Entity Count
```typescript
// Source: User requirement PROP-03 + dependency-graph pattern
function getAffectedEntityCount(
  directEdits: Set<string>,
  transitiveEffects: Set<string>
): number {
  // Don't double-count entities that are in both sets
  const total = new Set([...directEdits, ...transitiveEffects])
  return total.size
}

// Usage in draft header
function DraftHeader() {
  const directEdits = useDraftStoreV2((s) => s.directlyEditedEntities)
  const transitiveEffects = useDraftStoreV2((s) => s.transitivelyAffectedEntities)
  const affectedCount = getAffectedEntityCount(directEdits, transitiveEffects)

  return (
    <div>
      <h2>Draft</h2>
      {affectedCount > 0 && (
        <Badge variant="secondary">{affectedCount} entities affected</Badge>
      )}
    </div>
  )
}
```

### React Flow Edge Conditional Styling
```typescript
// Source: https://reactflow.dev/api-reference/types/edge
// Edges are styled via the style property on edge objects
const edges: Edge[] = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    style: {
      stroke: data?.change_status === 'added' ? '#22c55e' : '#888',
      strokeWidth: 1.5,
      opacity: data?.change_status === 'deleted' ? 0.3 : 1,
      strokeDasharray: data?.change_status === 'deleted' ? '5,5' : undefined,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 15,
      height: 15,
      color: data?.change_status === 'added' ? '#22c55e' : '#888',
    },
    data: { change_status: 'added' }, // Custom data for conditional logic
  },
]
```

### Tailwind Conditional Background Classes
```typescript
// Source: https://www.geeksforgeeks.org/reactjs/how-to-conditionally-set-background-color-in-react-component-with-tailwind-css/
// Use complete class names with conditional logic
function EntityItem({ entity, isDirectEdit, isTransitiveEffect }) {
  return (
    <div
      className={cn(
        'px-2 py-1 rounded',
        isDirectEdit && 'bg-blue-100 dark:bg-blue-900/30',
        isTransitiveEffect && !isDirectEdit && 'bg-blue-50 dark:bg-blue-900/10'
      )}
    >
      {entity.label}
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Compute affected entities per component | Centralized Zustand store with Sets | Zustand 4.0+ with immer | Better performance, single source of truth |
| String concatenation for classes | clsx/cn utility functions | CVA/Tailwind ecosystem standard | Type-safe, handles edge cases |
| Custom edge components for styling | Style property on edge objects | React Flow v11+ | Simpler, better performance |
| Hex color values | Tailwind color utilities with opacity | Tailwind v3+ | Dark mode support, accessibility |

**Deprecated/outdated:**
- React Flow v10 edge styling patterns: Now use style property on edge objects instead of custom edge components for simple styling
- Global CSS for conditional backgrounds: Use Tailwind utility classes with dark mode variants

## Open Questions

Things that couldn't be fully resolved:

1. **Inheritance chain data fetching**
   - What we know: CategoryDetailV2 has `parents: string[]` but not parent labels/details
   - What's unclear: Whether to fetch all parent details upfront or lazy-load on accordion expand
   - Recommendation: Use existing `useCategories` hook with parent entity_keys, fetch eagerly when detail opens (simpler, matches existing patterns)

2. **Depth visualization gradient vs binary**
   - What we know: User left this to Claude's discretion in CONTEXT.md
   - What's unclear: Whether gradient (depth 1 = dark, depth 2 = lighter) adds value vs binary (affected/not affected)
   - Recommendation: Start with binary (simpler), can add gradient later if user requests depth visualization

3. **Edge label icons (+/- for new/deleted)**
   - What we know: User left this to Claude's discretion
   - What's unclear: Whether icons improve clarity or add visual noise
   - Recommendation: Use color + dashed lines for deleted edges (sufficient visual distinction), add icons only if user feedback indicates confusion

## Sources

### Primary (HIGH confidence)
- [React Flow Theming Documentation](https://reactflow.dev/learn/customization/theming) - Node styling patterns
- [React Flow Custom Nodes](https://reactflow.dev/examples/nodes/custom-node) - Dynamic node styling with data props
- [React Flow Edge API](https://reactflow.dev/api-reference/types/edge) - Edge style property documentation
- [dependency-graph GitHub README](https://github.com/jriecken/dependency-graph/blob/master/README.md) - dependantsOf() API for transitive dependencies
- Existing codebase patterns (SidebarV2.tsx, GraphNode.tsx, draftStoreV2.ts) - Established architecture

### Secondary (MEDIUM confidence)
- [shadcn/ui Badge Component](https://ui.shadcn.com/docs/components/badge) - Custom color variants for status indicators (verified with official docs)
- [Tailwind CSS Dynamic Background Colors](https://www.geeksforgeeks.org/reactjs/how-to-conditionally-set-background-color-in-react-component-with-tailwind-css/) - Conditional class application patterns (multiple sources agree)
- [React Flow Custom Edges](https://reactflow.dev/examples/edges/custom-edges) - Edge styling with BaseEdge component

### Tertiary (LOW confidence)
- dependency-graph npm package version - No specific version found in official docs, recommend using latest
- React breadcrumb patterns for inheritance chain - General pattern research, not specific implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, versions verified from package.json
- Architecture: HIGH - Patterns verified from existing codebase and official React Flow/Zustand docs
- Pitfalls: HIGH - Based on Tailwind official docs (purging behavior) and common graph traversal issues

**Research date:** 2026-01-25
**Valid until:** 2026-02-25 (30 days - stable libraries, established patterns)
