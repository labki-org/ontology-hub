import { useMemo } from 'react'
import { polygonHull } from 'd3-polygon'
import { line, curveCatmullRomClosed } from 'd3-shape'
import type { Node } from '@xyflow/react'

// Node dimensions (must match useHybridLayout.ts)
const NODE_WIDTH = 172
const NODE_HEIGHT = 36

/** Distance threshold for splitting a module's nodes into spatial sub-clusters. */
const CLUSTER_THRESHOLD = 400

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
 * Cluster nodes by spatial proximity using single-linkage clustering.
 * Nodes within `threshold` distance (center-to-center) are chained into
 * the same cluster.  This splits far-flung module members into separate
 * tight hulls instead of one bloated convex hull.
 */
function clusterByProximity(moduleNodes: Node[], threshold: number): Node[][] {
  const clusters: Node[][] = []
  const assigned = new Set<number>()

  for (let i = 0; i < moduleNodes.length; i++) {
    if (assigned.has(i)) continue
    const cluster: Node[] = [moduleNodes[i]]
    assigned.add(i)
    const queue = [i]

    while (queue.length > 0) {
      const ci = queue.shift()!
      const cn = moduleNodes[ci]
      const cx = cn.position.x + NODE_WIDTH / 2
      const cy = cn.position.y + NODE_HEIGHT / 2

      for (let j = 0; j < moduleNodes.length; j++) {
        if (assigned.has(j)) continue
        const jn = moduleNodes[j]
        const jx = jn.position.x + NODE_WIDTH / 2
        const jy = jn.position.y + NODE_HEIGHT / 2
        if (Math.sqrt((cx - jx) ** 2 + (cy - jy) ** 2) < threshold) {
          cluster.push(jn)
          assigned.add(j)
          queue.push(j)
        }
      }
    }

    clusters.push(cluster)
  }

  return clusters
}

/**
 * Compute the hull shape for a single spatial cluster of nodes.
 */
function computeClusterShape(clusterNodes: Node[], padding: number): HullShape | null {
  if (clusterNodes.length === 0) return null

  if (clusterNodes.length === 1) {
    const n = clusterNodes[0]
    return {
      type: 'ellipse' as const,
      cx: n.position.x + NODE_WIDTH / 2,
      cy: n.position.y + NODE_HEIGHT / 2,
      rx: NODE_WIDTH / 2 + padding,
      ry: NODE_HEIGHT / 2 + padding,
    }
  }

  if (clusterNodes.length === 2) {
    const minX = Math.min(clusterNodes[0].position.x, clusterNodes[1].position.x)
    const maxX = Math.max(clusterNodes[0].position.x, clusterNodes[1].position.x) + NODE_WIDTH
    const minY = Math.min(clusterNodes[0].position.y, clusterNodes[1].position.y)
    const maxY = Math.max(clusterNodes[0].position.y, clusterNodes[1].position.y) + NODE_HEIGHT
    return {
      type: 'ellipse' as const,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      rx: (maxX - minX) / 2 + padding,
      ry: (maxY - minY) / 2 + padding,
    }
  }

  const paddedCorners: [number, number][] = clusterNodes.flatMap((n) => getPaddedNodeCorners(n, padding))
  const path = getSmoothHullPath(paddedCorners)
  if (!path) return null
  return { type: 'path' as const, d: path }
}

/**
 * Renders hull(s) around nodes belonging to a module or bundle.
 *
 * When a module's members are spatially dispersed, they are split into
 * proximity-based sub-clusters and each cluster gets its own tight hull.
 * This avoids giant convex hulls that balloon across unrelated nodes.
 *
 * - Module hulls: light fill + solid border
 * - Bundle hulls: no fill, dashed border
 */
export function ModuleHull({
  moduleId,
  nodes,
  color,
  padding = 30,
  hullType = 'module',
  memberField = 'modules',
}: ModuleHullProps) {
  // Filter nodes belonging to this module/bundle (shared by hull + label)
  const moduleNodes = useMemo(
    () => nodes.filter(
      (n) => n.data[memberField] && Array.isArray(n.data[memberField]) &&
        (n.data[memberField] as string[]).includes(moduleId)
    ),
    [moduleId, nodes, memberField]
  )

  const hullShapes = useMemo((): HullShape[] => {
    if (moduleNodes.length === 0) return []

    // Split into spatial clusters — each gets its own tight hull
    const clusters = clusterByProximity(moduleNodes, CLUSTER_THRESHOLD)

    return clusters
      .map((cluster) => computeClusterShape(cluster, padding))
      .filter((shape): shape is HullShape => shape !== null)
  }, [moduleNodes, padding])

  // Compute label position above the topmost cluster
  const labelPosition = useMemo(() => {
    if (moduleNodes.length === 0) return null

    const minX = Math.min(...moduleNodes.map((n) => n.position.x))
    const maxX = Math.max(...moduleNodes.map((n) => n.position.x + NODE_WIDTH))
    const minY = Math.min(...moduleNodes.map((n) => n.position.y))
    const cx = (minX + maxX) / 2

    return { x: cx, y: minY - padding - 15 }
  }, [moduleNodes, padding])

  if (hullShapes.length === 0) return null

  // Style based on hull type
  const isBundle = hullType === 'bundle'
  const commonProps = {
    fill: color,
    fillOpacity: isBundle ? 0 : 0.07,
    stroke: color,
    strokeWidth: isBundle ? 1.5 : 2,
    strokeOpacity: isBundle ? 0.35 : 0.4,
    strokeDasharray: isBundle ? '6 4' : undefined,
    pointerEvents: 'none' as const,
  }

  return (
    <>
      {hullShapes.map((hullShape, i) => {
        if (hullShape.type === 'ellipse') {
          return (
            <ellipse
              key={i}
              cx={hullShape.cx}
              cy={hullShape.cy}
              rx={hullShape.rx}
              ry={hullShape.ry}
              {...commonProps}
            />
          )
        }

        if (hullShape.type === 'circle') {
          return (
            <circle
              key={i}
              cx={hullShape.cx}
              cy={hullShape.cy}
              r={hullShape.r}
              {...commonProps}
            />
          )
        }

        // path type (convex hull per cluster)
        return (
          <path
            key={i}
            d={hullShape.d}
            {...commonProps}
          />
        )
      })}
      {labelPosition && (
        <text
          x={labelPosition.x}
          y={labelPosition.y}
          textAnchor="middle"
          fill={color}
          fontSize={isBundle ? 13 : 14}
          fontWeight={isBundle ? 500 : 600}
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
