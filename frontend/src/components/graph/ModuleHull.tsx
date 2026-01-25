import { useMemo } from 'react'
import { polygonHull } from 'd3-polygon'
import { line, curveCatmullRomClosed } from 'd3-shape'
import type { Node } from '@xyflow/react'

interface ModuleHullProps {
  moduleId: string
  nodes: Node[]
  color: string
  padding?: number
}

/**
 * Computes a smooth hull path using Catmull-Rom curve interpolation.
 * Returns null if fewer than 3 points.
 */
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

  // 3. Expand hull points outward from centroid by padding
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
    .x((d) => d[0])
    .y((d) => d[1])
    .curve(curveCatmullRomClosed.alpha(0.5))

  return lineGenerator(expandedPoints)
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

    // Extract positions as typed tuples
    const points: [number, number][] = moduleNodes.map((n) => [n.position.x, n.position.y])

    // Single node: circle
    if (moduleNodes.length === 1) {
      const [x, y] = points[0]
      return {
        type: 'circle' as const,
        cx: x,
        cy: y,
        r: padding,
      }
    }

    // Two nodes: ellipse
    if (moduleNodes.length === 2) {
      const [x1, y1] = points[0]
      const [x2, y2] = points[1]
      const cx = (x1 + x2) / 2
      const cy = (y1 + y2) / 2
      const dx = Math.abs(x2 - x1)
      const dy = Math.abs(y2 - y1)
      return {
        type: 'ellipse' as const,
        cx,
        cy,
        rx: dx / 2 + padding,
        ry: Math.max(dy / 2 + padding, padding), // Ensure minimum height
      }
    }

    // 3+ nodes: smooth hull path
    const path = getSmoothHullPath(points, padding)
    if (!path) return null
    return { type: 'path' as const, d: path }
  }, [moduleId, nodes, padding])

  // Compute label position above the hull
  const labelPosition = useMemo(() => {
    const moduleNodes = nodes.filter(
      (n) => n.data.modules && Array.isArray(n.data.modules) && n.data.modules.includes(moduleId)
    )
    if (moduleNodes.length === 0) return null

    const points = moduleNodes.map((n) => [n.position.x, n.position.y] as [number, number])
    const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length
    const minY = Math.min(...points.map((p) => p[1]))

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
