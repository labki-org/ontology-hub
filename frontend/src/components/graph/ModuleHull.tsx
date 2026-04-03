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
  hullType?: 'module' | 'bundle'
  /** Which node data field to check for membership */
  memberField?: 'modules' | 'bundles'
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
 * Renders a convex hull around all nodes belonging to a module or bundle.
 *
 * - Module hulls: solid fill + solid border (current style)
 * - Bundle hulls: no fill, dashed border
 */
export function ModuleHull({
  moduleId,
  nodes,
  color,
  padding = 50,
  hullType = 'module',
  memberField = 'modules',
}: ModuleHullProps) {
  const hullShape = useMemo((): HullShape | null => {
    // Filter nodes belonging to this module/bundle
    const moduleNodes = nodes.filter(
      (n) => n.data[memberField] && Array.isArray(n.data[memberField]) &&
        (n.data[memberField] as string[]).includes(moduleId)
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
  }, [moduleId, nodes, padding, memberField])

  // Compute label position above the hull
  const labelPosition = useMemo(() => {
    const moduleNodes = nodes.filter(
      (n) => n.data[memberField] && Array.isArray(n.data[memberField]) &&
        (n.data[memberField] as string[]).includes(moduleId)
    )
    if (moduleNodes.length === 0) return null

    const minX = Math.min(...moduleNodes.map((n) => n.position.x))
    const maxX = Math.max(...moduleNodes.map((n) => n.position.x + NODE_WIDTH))
    const minY = Math.min(...moduleNodes.map((n) => n.position.y))
    const cx = (minX + maxX) / 2

    return { x: cx, y: minY - padding - 15 }
  }, [moduleId, nodes, padding, memberField])

  if (!hullShape) return null

  // Style based on hull type
  const isBundle = hullType === 'bundle'
  const fillOpacity = isBundle ? 0 : 0.15
  const strokeOpacity = isBundle ? 0.35 : 0.4
  const strokeWidth = isBundle ? 1.5 : 2
  const strokeDasharray = isBundle ? '6 4' : undefined

  const shapeElement = (() => {
    if (hullShape.type === 'ellipse') {
      return (
        <ellipse
          cx={hullShape.cx}
          cy={hullShape.cy}
          rx={hullShape.rx}
          ry={hullShape.ry}
          fill={color}
          fillOpacity={fillOpacity}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeOpacity={strokeOpacity}
          strokeDasharray={strokeDasharray}
          pointerEvents="none"
        />
      )
    }

    // path type (convex hull)
    return (
      <path
        d={hullShape.d}
        fill={color}
        fillOpacity={fillOpacity}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        strokeDasharray={strokeDasharray}
        pointerEvents="none"
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
          fontSize={isBundle ? 10 : 11}
          fontWeight={isBundle ? 400 : 500}
          fontStyle={isBundle ? 'italic' : 'normal'}
          opacity={isBundle ? 0.6 : 0.8}
          pointerEvents="none"
        >
          {moduleId}
        </text>
      )}
    </>
  )
}
