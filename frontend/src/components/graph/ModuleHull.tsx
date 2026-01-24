import { useMemo } from 'react'
import { polygonHull } from 'd3-polygon'
import type { Node } from '@xyflow/react'

interface ModuleHullProps {
  moduleId: string
  nodes: Node[]
  color: string
  padding?: number
}

/**
 * Renders a convex hull polygon around all nodes belonging to a module.
 *
 * Implementation:
 * 1. Filters nodes by moduleId in node.data.modules
 * 2. Expands points outward from centroid by padding amount
 * 3. Computes convex hull using d3-polygon
 * 4. Renders as semi-transparent SVG path
 *
 * Returns null if < 3 nodes (hull requires at least 3 points).
 */
export function ModuleHull({
  moduleId,
  nodes,
  color,
  padding = 40,
}: ModuleHullProps) {
  const hullPath = useMemo(() => {
    // Filter nodes belonging to this module
    const moduleNodes = nodes.filter(
      (n) => n.data.modules && Array.isArray(n.data.modules) && n.data.modules.includes(moduleId)
    )

    // Need at least 3 nodes for a hull
    if (moduleNodes.length < 3) return null

    // Extract positions
    const points = moduleNodes.map((n) => [n.position.x, n.position.y])

    // Calculate centroid for padding expansion
    const centroid = [
      points.reduce((sum, p) => sum + p[0], 0) / points.length,
      points.reduce((sum, p) => sum + p[1], 0) / points.length,
    ]

    // Expand points outward from centroid by padding amount
    const expandedPoints = points.map((p) => {
      const dx = p[0] - centroid[0]
      const dy = p[1] - centroid[1]
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Avoid division by zero (point at centroid)
      if (distance === 0) return p

      const factor = (distance + padding) / distance
      return [centroid[0] + dx * factor, centroid[1] + dy * factor] as [
        number,
        number
      ]
    })

    // Compute convex hull
    const hull = polygonHull(expandedPoints)

    // polygonHull returns null if < 3 points
    if (!hull || hull.length < 3) return null

    // Convert to SVG path: M x1,y1 L x2,y2 L x3,y3 Z
    const pathData = `M${hull.map((p) => p.join(',')).join('L')}Z`

    return pathData
  }, [moduleId, nodes, padding])

  if (!hullPath) return null

  return (
    <path
      d={hullPath}
      fill={color}
      fillOpacity={0.15}
      stroke={color}
      strokeWidth={2}
      strokeOpacity={0.4}
      pointerEvents="none"
      className="module-hull"
    />
  )
}
