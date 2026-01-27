import { useMemo } from 'react'
import { polygonHull } from 'd3-polygon'
import { line, curveCatmullRomClosed } from 'd3-shape'
import type { Node } from '@xyflow/react'

// Node dimensions (must match useHybridLayout.ts)
const NODE_WIDTH = 172
const NODE_HEIGHT = 36

interface ModuleHullProps {
  moduleId: string
  nodes: Node[]
  color: string
  padding?: number
}

/**
 * Get padded corner points for a node's bounding box.
 * Padding is applied uniformly to all sides.
 */
function getPaddedNodeCorners(n: Node, padding: number): [number, number][] {
  const x = n.position.x
  const y = n.position.y
  return [
    [x - padding, y - padding],                             // top-left
    [x + NODE_WIDTH + padding, y - padding],                // top-right
    [x - padding, y + NODE_HEIGHT + padding],               // bottom-left
    [x + NODE_WIDTH + padding, y + NODE_HEIGHT + padding],  // bottom-right
  ]
}

/**
 * Computes a smooth hull path using Catmull-Rom curve interpolation.
 * Points should already include padding for uniform spacing.
 */
function getSmoothHullPath(points: [number, number][]): string | null {
  if (points.length < 3) return null

  // 1. Compute convex hull from padded corners
  const hull = polygonHull(points)
  if (!hull || hull.length < 3) return null

  // 2. Create smooth curve with Catmull-Rom interpolation
  const lineGenerator = line<[number, number]>()
    .x((d) => d[0])
    .y((d) => d[1])
    .curve(curveCatmullRomClosed.alpha(0.5))

  return lineGenerator(hull)
}

type HullShape =
  | { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { type: 'path'; d: string }

/**
 * Renders a convex hull around all nodes belonging to a module.
 *
 * Implementation:
 * 1. Filters nodes by moduleId in node.data.modules
 * 2. For 1 node: renders a circle
 * 3. For 2 nodes: renders an ellipse
 * 4. For 3+ nodes: expands points outward and renders smooth Catmull-Rom curve
 *
 * Returns null if no nodes belong to this module.
 */
export function ModuleHull({
  moduleId,
  nodes,
  color,
  padding = 50,
}: ModuleHullProps) {
  const hullShape = useMemo((): HullShape | null => {
    // Filter nodes belonging to this module
    const moduleNodes = nodes.filter(
      (n) => n.data.modules && Array.isArray(n.data.modules) && n.data.modules.includes(moduleId)
    )

    if (moduleNodes.length === 0) return null

    // Single node: ellipse around node bounds
    if (moduleNodes.length === 1) {
      const n = moduleNodes[0]
      const cx = n.position.x + NODE_WIDTH / 2
      const cy = n.position.y + NODE_HEIGHT / 2
      return {
        type: 'ellipse' as const,
        cx,
        cy,
        rx: NODE_WIDTH / 2 + padding,
        ry: NODE_HEIGHT / 2 + padding,
      }
    }

    // Two nodes: ellipse around combined bounds
    if (moduleNodes.length === 2) {
      const minX = Math.min(moduleNodes[0].position.x, moduleNodes[1].position.x)
      const maxX = Math.max(moduleNodes[0].position.x, moduleNodes[1].position.x) + NODE_WIDTH
      const minY = Math.min(moduleNodes[0].position.y, moduleNodes[1].position.y)
      const maxY = Math.max(moduleNodes[0].position.y, moduleNodes[1].position.y) + NODE_HEIGHT
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      return {
        type: 'ellipse' as const,
        cx,
        cy,
        rx: (maxX - minX) / 2 + padding,
        ry: (maxY - minY) / 2 + padding,
      }
    }

    // 3+ nodes: smooth hull path from padded bounding box corners
    const paddedCorners: [number, number][] = moduleNodes.flatMap((n) => getPaddedNodeCorners(n, padding))
    const path = getSmoothHullPath(paddedCorners)
    if (!path) return null
    return { type: 'path' as const, d: path }
  }, [moduleId, nodes, padding])

  // Compute label position above the hull
  const labelPosition = useMemo(() => {
    const moduleNodes = nodes.filter(
      (n) => n.data.modules && Array.isArray(n.data.modules) && n.data.modules.includes(moduleId)
    )
    if (moduleNodes.length === 0) return null

    // Use node bounds for label positioning
    const minX = Math.min(...moduleNodes.map((n) => n.position.x))
    const maxX = Math.max(...moduleNodes.map((n) => n.position.x + NODE_WIDTH))
    const minY = Math.min(...moduleNodes.map((n) => n.position.y))
    const cx = (minX + maxX) / 2

    return { x: cx, y: minY - padding - 15 } // Above hull
  }, [moduleId, nodes, padding])

  if (!hullShape) return null

  const shapeElement = (() => {
    if (hullShape.type === 'circle') {
      return (
        <circle
          cx={hullShape.cx}
          cy={hullShape.cy}
          r={hullShape.r}
          fill={color}
          fillOpacity={0.15}
          stroke={color}
          strokeWidth={2}
          strokeOpacity={0.4}
          pointerEvents="none"
        />
      )
    }

    if (hullShape.type === 'ellipse') {
      return (
        <ellipse
          cx={hullShape.cx}
          cy={hullShape.cy}
          rx={hullShape.rx}
          ry={hullShape.ry}
          fill={color}
          fillOpacity={0.15}
          stroke={color}
          strokeWidth={2}
          strokeOpacity={0.4}
          pointerEvents="none"
        />
      )
    }

    // path type
    return (
      <path
        d={hullShape.d}
        fill={color}
        fillOpacity={0.15}
        stroke={color}
        strokeWidth={2}
        strokeOpacity={0.4}
        pointerEvents="none"
        className="module-hull"
      />
    )
  })()

  return (
    <>
      {shapeElement}
      {labelPosition && (
        <text
          x={labelPosition.x}
          y={labelPosition.y}
          textAnchor="middle"
          fill={color}
          fontSize={11}
          fontWeight={500}
          opacity={0.8}
          pointerEvents="none"
        >
          {moduleId}
        </text>
      )}
    </>
  )
}
