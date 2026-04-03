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

// Predefined color palette for hulls (12 distinct colors)
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
 * Deterministic color assignment based on ID hash.
 * Same ID always gets same color across sessions.
 */
// eslint-disable-next-line react-refresh/only-export-components -- Utility function
export function getModuleColor(moduleId: string): string {
  let hash = 0
  for (const char of moduleId) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0)
    hash |= 0 // Convert to 32-bit integer
  }
  return HULL_COLORS[Math.abs(hash) % HULL_COLORS.length]
}

/**
 * Renders module hulls (solid) and bundle hulls (dashed) as SVG overlays.
 *
 * Module hulls use node.data.modules, bundle hulls use node.data.bundles.
 * Both include parent categories that OntologySync will auto-include.
 */
export function HullLayer({ nodes, viewport }: HullLayerProps) {
  const visibleModules = useHullStore((s) => s.visibleModules)

  // Extract unique module IDs from nodes
  const allModuleIds = useMemo(() => {
    const moduleSet = new Set<string>()
    for (const node of nodes) {
      if (node.data.modules && Array.isArray(node.data.modules)) {
        for (const moduleId of node.data.modules) {
          moduleSet.add(moduleId as string)
        }
      }
    }
    return Array.from(moduleSet)
  }, [nodes])

  // Extract unique bundle IDs from nodes
  const allBundleIds = useMemo(() => {
    const bundleSet = new Set<string>()
    for (const node of nodes) {
      if (node.data.bundles && Array.isArray(node.data.bundles)) {
        for (const bundleId of node.data.bundles) {
          bundleSet.add(bundleId as string)
        }
      }
    }
    return Array.from(bundleSet)
  }, [nodes])

  // Filter to only visible hulls
  const visibleModuleHulls = useMemo(() => {
    if (visibleModules.size === 0) return allModuleIds
    return allModuleIds.filter((id) => visibleModules.has(id))
  }, [allModuleIds, visibleModules])

  const visibleBundleHulls = useMemo(() => {
    if (visibleModules.size === 0) return allBundleIds
    return allBundleIds.filter((id) => visibleModules.has(id))
  }, [allBundleIds, visibleModules])

  if (visibleModuleHulls.length === 0 && visibleBundleHulls.length === 0) return null

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
        {/* Bundle hulls first (behind module hulls) */}
        {visibleBundleHulls.map((bundleId) => (
          <ModuleHull
            key={`bundle-${bundleId}`}
            moduleId={bundleId}
            nodes={nodes}
            color={getModuleColor(bundleId)}
            hullType="bundle"
            memberField="bundles"
            padding={65}
          />
        ))}
        {/* Module hulls on top */}
        {visibleModuleHulls.map((moduleId) => (
          <ModuleHull
            key={`module-${moduleId}`}
            moduleId={moduleId}
            nodes={nodes}
            color={getModuleColor(moduleId)}
            hullType="module"
            memberField="modules"
          />
        ))}
      </g>
    </svg>
  )
}
