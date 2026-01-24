import { useMemo } from 'react'
import type { Node } from '@xyflow/react'
import { ModuleHull } from './ModuleHull'
import { useHullStore } from '@/stores/hullStore'

interface Viewport {
  x: number
  y: number
  zoom: number
}

interface HullLayerProps {
  nodes: Node[]
  viewport: Viewport
}

// Predefined color palette for module hulls (12 distinct colors)
const HULL_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#84cc16', // lime-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
  '#ef4444', // red-500
  '#a855f7', // purple-500
]

/**
 * Deterministic color assignment based on moduleId hash.
 * Same module always gets same color across sessions.
 */
export function getModuleColor(moduleId: string): string {
  let hash = 0
  for (const char of moduleId) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0)
    hash |= 0 // Convert to 32-bit integer
  }
  return HULL_COLORS[Math.abs(hash) % HULL_COLORS.length]
}

/**
 * Renders all visible module hulls as SVG overlays.
 *
 * Features:
 * - Extracts unique module IDs from all nodes
 * - Filters by visibleModules from hullStore
 * - Renders ModuleHull for each visible module
 * - Uses deterministic color assignment
 *
 * Rendered below nodes layer (pointer-events: none on hulls).
 */
export function HullLayer({ nodes, viewport }: HullLayerProps) {
  const visibleModules = useHullStore((s) => s.visibleModules)

  // Extract all unique module IDs from nodes
  const allModuleIds = useMemo(() => {
    const moduleSet = new Set<string>()
    for (const node of nodes) {
      if (node.data.modules && Array.isArray(node.data.modules)) {
        for (const moduleId of node.data.modules) {
          moduleSet.add(moduleId)
        }
      }
    }
    return Array.from(moduleSet)
  }, [nodes])

  // Filter to only visible modules
  const visibleModuleIds = useMemo(() => {
    // If visibleModules is empty, show all modules
    if (visibleModules.size === 0) return allModuleIds

    return allModuleIds.filter((moduleId) => visibleModules.has(moduleId))
  }, [allModuleIds, visibleModules])

  if (visibleModuleIds.length === 0) return null

  // Apply viewport transform to match React Flow's pan/zoom
  const transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`

  return (
    <svg
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'visible',
      }}
    >
      <g style={{ transform, transformOrigin: '0 0' }}>
        {visibleModuleIds.map((moduleId) => (
          <ModuleHull
            key={moduleId}
            moduleId={moduleId}
            nodes={nodes}
            color={getModuleColor(moduleId)}
          />
        ))}
      </g>
    </svg>
  )
}
