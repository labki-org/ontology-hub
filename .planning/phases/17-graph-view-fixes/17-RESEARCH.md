# Phase 17: Graph View Fixes - Research

**Researched:** 2026-01-24
**Domain:** React Flow graph visualization, D3 smooth hulls, custom node styling
**Confidence:** HIGH

## Summary

This phase fixes visual rendering issues in the existing graph view built with React Flow v12 and d3-force. The codebase already has the core infrastructure:

- **GraphCanvas.tsx** - Main React Flow container with force layout
- **GraphNode.tsx** - Single node component for all entity types (currently only styled for categories)
- **ModuleHull.tsx** - Convex hull rendering using d3-polygon (currently jagged)
- **useForceLayout.ts** - D3-force simulation for node positioning

The required fixes are:
1. **Node differentiation** - Currently all nodes use the same rectangular style. Need to add distinct shapes and colors per entity type (category, property, subobject, template)
2. **Smooth hulls** - Replace d3-polygon convex hull with Catmull-Rom spline interpolation for rounded boundaries
3. **Hover highlighting** - Add onNodeMouseEnter/Leave handlers to dim unrelated nodes and highlight connected ones
4. **Edge styling** - Already partially implemented (dashed for property, dotted for subobject), needs arrow directions

**Primary recommendation:** Extend the existing GraphNode component with SVG shape rendering based on entity_type, use d3.curveCatmullRomClosed for smooth hulls, and add hover state management to graphStore.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xyflow/react | 12.10.0 | React Flow graph framework | Already in use, provides nodes, edges, pan/zoom |
| d3-force | 3.0.0 | Force-directed layout simulation | Already in use via useForceLayout |
| d3-polygon | 3.0.1 | Convex hull computation | Already in use for module hulls |

### Adding (d3-shape)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| d3-shape | 3.2.0 | Curve interpolation (Catmull-Rom) | For smooth hull boundaries |

**Installation:**
```bash
npm install d3-shape @types/d3-shape
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| d3-shape curves | hand-rolled Bezier | More code, same result - use d3 |
| Custom SVG shapes | React component library | Simpler custom shapes, don't need library |

## Architecture Patterns

### Existing Project Structure
```
frontend/src/components/graph/
├── GraphCanvas.tsx        # Main container, ReactFlow wrapper
├── GraphNode.tsx          # Single node component (to be extended)
├── HullLayer.tsx          # Hull container with viewport transform
├── ModuleHull.tsx         # Individual hull rendering (to be modified)
├── GraphControls.tsx      # Depth/filter controls
├── ModuleHullControls.tsx # Hull visibility toggles
└── useForceLayout.ts      # D3-force simulation hook
```

### Pattern 1: SVG Shape Rendering in Custom Nodes

**What:** Render different SVG shapes based on entity_type data property
**When to use:** When node appearance must vary by type

**Example:**
```typescript
// Source: React Flow custom nodes documentation + MDN SVG paths
function GraphNodeComponent({ data }: { data: GraphNodeData }) {
  const { entity_type, label } = data

  // Shape dimensions - adjust per type for visual hierarchy
  const size = getNodeSize(entity_type)
  const shape = getNodeShape(entity_type, size)
  const fill = getNodeColor(entity_type)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <path d={shape} fill={fill} stroke={getDarkerShade(fill)} strokeWidth={2} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-medium text-center px-1">{label}</span>
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

// SVG path generators for each shape
function getNodeShape(entityType: string, size: number): string {
  const half = size / 2
  const quarter = size / 4

  switch (entityType) {
    case 'category':
      // Rounded rectangle (dominant, anchor shape)
      return `M${quarter},0 h${half} q${quarter},0 ${quarter},${quarter} v${half} q0,${quarter} -${quarter},${quarter} h-${half} q-${quarter},0 -${quarter},-${quarter} v-${half} q0,-${quarter} ${quarter},-${quarter} Z`
    case 'property':
      // Diamond shape
      return `M${half},0 L${size},${half} L${half},${size} L0,${half} Z`
    case 'subobject':
      // Hexagon shape
      return hexagonPath(half, size)
    case 'template':
      // Circle
      return `M${half},0 A${half},${half} 0 1,1 ${half},${size} A${half},${half} 0 1,1 ${half},0 Z`
    default:
      // Rectangle fallback
      return `M0,0 h${size} v${size} h-${size} Z`
  }
}
```

### Pattern 2: Smooth Hull with Catmull-Rom Curves

**What:** Replace jagged convex hull with smooth interpolated curve
**When to use:** For visually appealing module boundaries

**Example:**
```typescript
// Source: d3-shape curves documentation, IPWright83 smooth hull gist
import { line, curveCatmullRomClosed } from 'd3-shape'
import { polygonHull } from 'd3-polygon'

function getSmoothHullPath(points: [number, number][], padding: number): string | null {
  if (points.length < 3) return null

  // 1. Compute convex hull
  const hull = polygonHull(points)
  if (!hull || hull.length < 3) return null

  // 2. Calculate centroid for expansion
  const centroid: [number, number] = [
    hull.reduce((sum, p) => sum + p[0], 0) / hull.length,
    hull.reduce((sum, p) => sum + p[1], 0) / hull.length,
  ]

  // 3. Expand hull points outward from centroid
  const expandedPoints: [number, number][] = hull.map((p) => {
    const dx = p[0] - centroid[0]
    const dy = p[1] - centroid[1]
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance === 0) return p
    const factor = (distance + padding) / distance
    return [centroid[0] + dx * factor, centroid[1] + dy * factor]
  })

  // 4. Create smooth curve with Catmull-Rom interpolation
  const lineGenerator = line<[number, number]>()
    .x(d => d[0])
    .y(d => d[1])
    .curve(curveCatmullRomClosed.alpha(0.5))

  return lineGenerator(expandedPoints)
}
```

### Pattern 3: Hover Highlight with Connected Node Tracking

**What:** Dim unrelated nodes, highlight connected ones on hover
**When to use:** Interactive exploration of graph relationships

**Example:**
```typescript
// Source: React Flow GitHub Issue #984, onNodeMouseEnter docs
import { useCallback, useState } from 'react'
import { useReactFlow, getConnectedEdges, getIncomers, getOutgoers } from '@xyflow/react'

function useHoverHighlight() {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const { getNodes, getEdges } = useReactFlow()

  const onNodeMouseEnter = useCallback((_event: React.MouseEvent, node: Node) => {
    setHoveredNodeId(node.id)
  }, [])

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null)
  }, [])

  // Compute which nodes should be highlighted vs dimmed
  const getHighlightState = useCallback((nodeId: string): 'highlighted' | 'dimmed' | 'normal' => {
    if (!hoveredNodeId) return 'normal'
    if (nodeId === hoveredNodeId) return 'highlighted'

    const nodes = getNodes()
    const edges = getEdges()
    const hoveredNode = nodes.find(n => n.id === hoveredNodeId)
    if (!hoveredNode) return 'normal'

    // Get directly connected nodes (not recursive to avoid cycles)
    const incomers = getIncomers(hoveredNode, nodes, edges)
    const outgoers = getOutgoers(hoveredNode, nodes, edges)
    const connectedIds = new Set([
      hoveredNodeId,
      ...incomers.map(n => n.id),
      ...outgoers.map(n => n.id),
    ])

    return connectedIds.has(nodeId) ? 'highlighted' : 'dimmed'
  }, [hoveredNodeId, getNodes, getEdges])

  return { onNodeMouseEnter, onNodeMouseLeave, getHighlightState, hoveredNodeId }
}
```

### Anti-Patterns to Avoid
- **Recursive connected node traversal:** Can cause stack overflow on cyclic graphs. Use single-level getIncomers/getOutgoers instead.
- **Redefining nodeTypes inside component:** Causes unnecessary re-renders. Define outside component.
- **Animating hull on every node position change:** Use requestAnimationFrame or debounce for performance.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Smooth curve interpolation | Custom Bezier math | d3.curveCatmullRomClosed | Proven algorithm, handles edge cases |
| Convex hull computation | Custom gift-wrapping algo | d3.polygonHull | Andrew's monotone chain, optimal O(n log n) |
| Connected node traversal | Custom graph walking | React Flow getIncomers/getOutgoers | Already handles edge direction, cycle-safe at one level |
| SVG path generation | String concatenation | d3.line() with curve | Cleaner, composable, testable |

**Key insight:** D3 has battle-tested algorithms for geometry. React Flow has built-in graph traversal utilities. Use them.

## Common Pitfalls

### Pitfall 1: Recursive Traversal in Cyclic Graphs
**What goes wrong:** Stack overflow when using getAllIncomers/getAllOutgoers recursively
**Why it happens:** The ontology graph can have circular inheritance
**How to avoid:** Only use single-level getIncomers/getOutgoers for hover highlight
**Warning signs:** Browser crashes on hover

### Pitfall 2: Hull Disappears with < 3 Nodes
**What goes wrong:** Module hull doesn't render when module has 1-2 categories
**Why it happens:** Convex hull requires minimum 3 points
**How to avoid:** For 1-2 nodes, draw a circle/ellipse around them instead of hull
**Warning signs:** Some modules have no visible boundary

### Pitfall 3: Node Size Causes Overlapping Labels
**What goes wrong:** Labels get cut off or overlap on small shapes
**Why it happens:** Shape size too small for text content
**How to avoid:** Use fixed minimum sizes, truncate long labels with ellipsis
**Warning signs:** Text overflow on property/subobject nodes

### Pitfall 4: SVG Viewbox Mismatch
**What goes wrong:** Shapes appear clipped or misaligned
**Why it happens:** SVG viewBox doesn't match container dimensions
**How to avoid:** Always set viewBox to match the size used in path generation
**Warning signs:** Shapes partially visible, handles in wrong position

### Pitfall 5: Force Layout Disrupted by Node Size Changes
**What goes wrong:** Nodes overlap after adding shapes because collision radius unchanged
**Why it happens:** useForceLayout uses fixed collisionRadius of 50
**How to avoid:** Update forceCollide radius based on largest node size
**Warning signs:** Large category nodes overlapping smaller property nodes

## Code Examples

### Entity Type Color Palette (Muted/Pastel)
```typescript
// Source: User decision in CONTEXT.md - muted/pastel colors
const ENTITY_COLORS: Record<string, string> = {
  category: '#94a3b8',   // Slate-400 (muted blue-gray, prominent)
  property: '#86efac',   // Green-300 (soft green)
  subobject: '#c4b5fd',  // Violet-300 (soft purple)
  template: '#fcd34d',   // Amber-300 (soft yellow)
}

const ENTITY_BORDER_COLORS: Record<string, string> = {
  category: '#64748b',   // Slate-500
  property: '#22c55e',   // Green-500
  subobject: '#8b5cf6',  // Violet-500
  template: '#f59e0b',   // Amber-500
}
```

### Node Sizing by Type (Visual Hierarchy)
```typescript
// Source: User decision - categories anchor, static sizing by type
const NODE_SIZES: Record<string, number> = {
  category: 80,    // Largest - anchor nodes
  subobject: 60,   // Medium - composite entities
  property: 50,    // Smaller - leaf details
  template: 50,    // Smaller - supplementary
}
```

### Edge Styles by Relationship Type
```typescript
// Source: Existing GraphCanvas.tsx pattern + user decision for arrows
function getEdgeStyle(edgeType: string) {
  switch (edgeType) {
    case 'parent':
      return {
        stroke: '#64748b',     // Slate-500
        strokeWidth: 2,
        strokeDasharray: undefined,  // Solid
      }
    case 'property':
      return {
        stroke: '#22c55e',     // Green-500
        strokeWidth: 1.5,
        strokeDasharray: '5,5', // Dashed
      }
    case 'subobject':
      return {
        stroke: '#8b5cf6',     // Violet-500
        strokeWidth: 1.5,
        strokeDasharray: '2,4', // Dotted
      }
    default:
      return {
        stroke: '#9ca3af',
        strokeWidth: 1.5,
        strokeDasharray: undefined,
      }
  }
}
```

### Hexagon Path Generator
```typescript
// Source: SVG path MDN documentation
function hexagonPath(radius: number, size: number): string {
  const center = size / 2
  const points: [number, number][] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2  // Start at top
    points.push([
      center + radius * 0.9 * Math.cos(angle),
      center + radius * 0.9 * Math.sin(angle),
    ])
  }
  return `M${points[0][0]},${points[0][1]} ` +
    points.slice(1).map(p => `L${p[0]},${p[1]}`).join(' ') + ' Z'
}
```

### Diamond Path Generator
```typescript
// Source: SVG path MDN documentation
function diamondPath(size: number): string {
  const half = size / 2
  return `M${half},0 L${size},${half} L${half},${size} L0,${half} Z`
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| d3-polygon straight edges | d3-shape Catmull-Rom curves | Standard practice | Smooth, organic-looking hulls |
| Fixed node rectangles | SVG path custom shapes | React Flow v11+ | Better type differentiation |
| No hover feedback | getIncomers/getOutgoers highlight | React Flow v12 | Interactive exploration |

**Current in codebase:**
- GraphNode uses simple div with border (needs SVG shapes)
- ModuleHull uses straight-line polygon path (needs curve interpolation)
- No hover highlight logic (needs to be added)

## Open Questions

Things that couldn't be fully resolved:

1. **Exact hull padding value**
   - What we know: Current padding is 40px, user said "Claude's discretion"
   - What's unclear: Optimal padding depends on average node density
   - Recommendation: Start with 50px, adjust based on testing with real data

2. **Handle positions for non-rectangular shapes**
   - What we know: React Flow Handle position is relative to node container
   - What's unclear: Best placement for diamond/hexagon shapes
   - Recommendation: Use Position.Top/Bottom, may need CSS adjustments for visual alignment

3. **Performance with many nodes**
   - What we know: Current force layout handles ~50 nodes well
   - What's unclear: Impact of SVG shapes + smooth hulls on render performance
   - Recommendation: Profile with 100+ nodes, consider memoization if slow

## Sources

### Primary (HIGH confidence)
- React Flow custom nodes documentation - https://reactflow.dev/learn/customization/custom-nodes
- D3 curve types documentation - https://d3js.org/d3-shape/curve
- MDN SVG paths tutorial - https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Paths
- Existing codebase: frontend/src/components/graph/*.tsx

### Secondary (MEDIUM confidence)
- React Flow shapes example - https://reactflow.dev/examples/nodes/shapes
- IPWright83 smooth hull gist - https://gist.github.com/IPWright83/2622890cc87b8b7cca41e0d06f2b9df4
- React Flow GitHub Issue #984 (hover highlight) - https://github.com/wbkd/react-flow/issues/984

### Tertiary (LOW confidence)
- General SVG shape patterns from web search (need validation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Already using React Flow + d3, just adding d3-shape
- Architecture patterns: HIGH - Based on official docs and existing codebase patterns
- Pitfalls: MEDIUM - Some based on GitHub issues, need validation in context

**Research date:** 2026-01-24
**Valid until:** 60 days (stable libraries, no fast-moving ecosystem)
