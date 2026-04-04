import { useMemo } from 'react'
import { Handle, Position, useEdges } from '@xyflow/react'
import { useGraphStore } from '@/stores/graphStore'
import { useDraftStore } from '@/stores/draftStore'

type GraphNodeData = {
  label: string
  entity_key: string
  entity_type: string
  modules?: string[]
  bundles?: string[]
  change_status?: 'added' | 'modified' | 'deleted' | 'unchanged'
  [key: string]: unknown
}

// Node size constants per entity type
const NODE_SIZES: Record<string, number> = {
  category: 80,
  subobject: 60,
  property: 50,
  template: 50,
  dashboard: 70,   // Similar to category - structural entity
  resource: 45,    // Compact - data instances
}

// Fill colors (muted/pastel palette)
const ENTITY_COLORS: Record<string, string> = {
  category: '#94a3b8', // slate-400
  property: '#86efac', // green-300
  subobject: '#c4b5fd', // violet-300
  template: '#fcd34d', // amber-300
  dashboard: '#fca5a5', // red-300 - warm, distinct
  resource: '#a5f3fc', // cyan-300 - cool, compact
}

// Border colors
const ENTITY_BORDER_COLORS: Record<string, string> = {
  category: '#64748b', // slate-500
  property: '#22c55e', // green-500
  subobject: '#8b5cf6', // violet-500
  template: '#f59e0b', // amber-500
  dashboard: '#ef4444', // red-500
  resource: '#06b6d4', // cyan-500
}

// Change status glow colors (used for filter: drop-shadow)
const CHANGE_STATUS_GLOW: Record<string, string> = {
  added: '#22c55e',    // green-500
  modified: '#eab308', // yellow-500
  deleted: '#ef4444',  // red-500
}

/**
 * Generate SVG path for a rounded rectangle centered at origin.
 * Returns a path string for use in <path d="...">
 */
function roundedRectPath(size: number, radius: number): string {
  const half = size / 2
  const r = Math.min(radius, half)
  // Start at top-left corner after the rounded part
  return `
    M ${-half + r} ${-half}
    H ${half - r}
    Q ${half} ${-half} ${half} ${-half + r}
    V ${half - r}
    Q ${half} ${half} ${half - r} ${half}
    H ${-half + r}
    Q ${-half} ${half} ${-half} ${half - r}
    V ${-half + r}
    Q ${-half} ${-half} ${-half + r} ${-half}
    Z
  `
}

/**
 * Generate SVG path for a diamond centered at origin.
 */
function diamondPath(size: number): string {
  const half = size / 2
  return `
    M 0 ${-half}
    L ${half} 0
    L 0 ${half}
    L ${-half} 0
    Z
  `
}

/**
 * Generate SVG path for a hexagon centered at origin.
 */
function hexagonPath(size: number): string {
  const half = size / 2
  // Pointy-top hexagon
  const h = half * Math.sin(Math.PI / 3) // height from center to flat edge
  const w = half * Math.cos(Math.PI / 3) // width from center to side corner
  return `
    M 0 ${-half}
    L ${h} ${-w}
    L ${h} ${w}
    L 0 ${half}
    L ${-h} ${w}
    L ${-h} ${-w}
    Z
  `
}

/**
 * Generate SVG path for a circle centered at origin.
 * Uses cubic bezier curves to approximate a circle.
 */
function circlePath(size: number): string {
  const r = size / 2
  // Magic number for cubic bezier circle approximation
  const c = r * 0.552284749831
  return `
    M 0 ${-r}
    C ${c} ${-r} ${r} ${-c} ${r} 0
    C ${r} ${c} ${c} ${r} 0 ${r}
    C ${-c} ${r} ${-r} ${c} ${-r} 0
    C ${-r} ${-c} ${-c} ${-r} 0 ${-r}
    Z
  `
}

/**
 * Get SVG path for node shape based on entity type.
 */
function getNodePath(entityType: string): string {
  const size = NODE_SIZES[entityType] ?? 50
  switch (entityType) {
    case 'category':
      return roundedRectPath(size, 10)
    case 'property':
      return diamondPath(size)
    case 'subobject':
      return hexagonPath(size)
    case 'template':
      return circlePath(size)
    case 'dashboard':
      return roundedRectPath(size, 12) // Rounded rect like category, larger radius
    case 'resource':
      return roundedRectPath(size, 4)  // Small rect, subtle rounding
    default:
      return roundedRectPath(size, 4)
  }
}

/**
 * Custom React Flow node component for graph visualization.
 *
 * Features:
 * - SVG shapes based on entity_type (category=rounded rect, property=diamond, etc.)
 * - Visual indicators for change_status (glow effect)
 * - Click handler to select entity in graphStore
 * - Hover state dims unrelated nodes
 */
function GraphNodeComponent({ data }: { data: GraphNodeData }) {
  const setSelectedEntity = useGraphStore((s) => s.setSelectedEntity)
  const selectedEntityKey = useGraphStore((s) => s.selectedEntityKey)
  const hoveredNodeId = useGraphStore((s) => s.hoveredNodeId)
  const hoveredModuleId = useGraphStore((s) => s.hoveredModuleId)

  // Change propagation state
  const directEdits = useDraftStore((s) => s.directlyEditedEntities)
  const transitiveAffects = useDraftStore((s) => s.transitivelyAffectedEntities)

  // Use rendered React Flow edges (which have clone IDs) for hover connectivity
  const edges = useEdges()

  const handleClick = () => {
    setSelectedEntity(data.entity_key, data.entity_type)
  }

  const entityType = data.entity_type ?? 'category'
  const size = NODE_SIZES[entityType] ?? 50
  const borderColor = ENTITY_BORDER_COLORS[entityType] ?? '#64748b'
  const path = getNodePath(entityType)

  // Check if this node is currently selected
  const isSelected = data.entity_key === selectedEntityKey

  // Calculate change propagation state
  const isDirectEdit = directEdits.has(data.entity_key)
  const isTransitiveEffect = transitiveAffects.has(data.entity_key)

  // Base fill color by entity type, override for change propagation
  let fillColor = ENTITY_COLORS[entityType] ?? '#94a3b8'
  if (isDirectEdit) {
    fillColor = '#93c5fd' // blue-300 - strong highlight for directly edited
  } else if (isTransitiveEffect) {
    fillColor = '#dbeafe' // blue-100 - subtle highlight for transitively affected
  }

  // Calculate highlight state for hover/selection dimming
  // Use node_id (clone ID) for edge matching, fall back to entity_key
  const nodeId = (data.node_id as string) ?? data.entity_key

  // The "focus" node is either the hovered node or the selected node's clone IDs
  const focusNodeId = hoveredNodeId ?? null
  // For selection, find all node IDs that match the selected entity key
  // (a selected entity may have multiple clones, e.g. Has_description__Equipment)
  const selectedNodeIds = useMemo(() => {
    if (!selectedEntityKey || hoveredNodeId) return null
    const ids = new Set<string>()
    const prefix = selectedEntityKey + '__'
    for (const edge of edges) {
      if (edge.source === selectedEntityKey || edge.source.startsWith(prefix)) ids.add(edge.source)
      if (edge.target === selectedEntityKey || edge.target.startsWith(prefix)) ids.add(edge.target)
    }
    return ids.size > 0 ? ids : null
  }, [selectedEntityKey, hoveredNodeId, edges])

  const getOpacity = (): number => {
    // Module hover: highlight nodes belonging to the hovered module
    if (hoveredModuleId) {
      const modules = data.modules ?? []
      const bundles = data.bundles ?? []
      if (modules.includes(hoveredModuleId) || bundles.includes(hoveredModuleId)) return 1
      return 0.15
    }

    // Node hover takes priority over selection
    if (focusNodeId) {
      if (nodeId === focusNodeId) return 1
      const isConnected = edges.some(
        (edge) =>
          (edge.source === focusNodeId && edge.target === nodeId) ||
          (edge.target === focusNodeId && edge.source === nodeId)
      )
      if (isConnected) return 1
      return 0.25
    }

    // Selection dimming
    if (selectedNodeIds) {
      if (selectedNodeIds.has(nodeId)) return 1
      const isConnected = edges.some(
        (edge) =>
          (selectedNodeIds.has(edge.source) && edge.target === nodeId) ||
          (selectedNodeIds.has(edge.target) && edge.source === nodeId)
      )
      if (isConnected) return 1
      return 0.25
    }

    return 1
  }

  // Get glow filter for change_status or selection
  const getGlowStyle = (): React.CSSProperties => {
    // Selection glow takes priority
    if (isSelected) {
      return {
        filter: `drop-shadow(0 0 8px #3b82f6) drop-shadow(0 0 4px #3b82f6)`,
      }
    }
    if (!data.change_status || data.change_status === 'unchanged') return {}
    const glowColor = CHANGE_STATUS_GLOW[data.change_status]
    if (!glowColor) return {}
    return {
      filter: `drop-shadow(0 0 6px ${glowColor}) drop-shadow(0 0 3px ${glowColor})`,
    }
  }

  // Truncate label if too long
  const maxLabelLength = entityType === 'category' ? 12 : 8
  const displayLabel = data.label.length > maxLabelLength
    ? data.label.slice(0, maxLabelLength - 1) + '...'
    : data.label

  const opacity = getOpacity()
  const glowStyle = getGlowStyle()

  // SVG dimensions need padding for handles and glow
  const padding = 16
  const svgSize = size + padding * 2

  return (
    <div
      className="cursor-pointer transition-opacity duration-200"
      style={{ opacity }}
      onClick={handleClick}
    >
      {/* Target handle at top */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-400"
        style={{ top: padding - 4, left: '50%', transform: 'translateX(-50%)' }}
      />

      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`${-svgSize / 2} ${-svgSize / 2} ${svgSize} ${svgSize}`}
        style={glowStyle}
      >
        {/* Selection ring - rendered behind the node */}
        {isSelected && (
          <path
            d={path}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={6}
            opacity={0.5}
          />
        )}
        {/* Node shape */}
        <path
          d={path}
          fill={fillColor}
          stroke={isSelected ? '#2563eb' : borderColor}
          strokeWidth={isSelected ? 3 : 2}
        />

        {/* Label text */}
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          className="text-xs font-medium pointer-events-none"
          fill="#1f2937"
          style={{ fontSize: entityType === 'category' ? '11px' : '10px' }}
        >
          {displayLabel}
        </text>

        {/* Change status indicator */}
        {data.change_status && data.change_status !== 'unchanged' && (
          <text
            x={0}
            y={size / 2 - 8}
            textAnchor="middle"
            dominantBaseline="central"
            className="text-[8px] font-bold pointer-events-none"
            fill={CHANGE_STATUS_GLOW[data.change_status] ?? '#888'}
          >
            {data.change_status === 'added' && '+'}
            {data.change_status === 'modified' && '*'}
            {data.change_status === 'deleted' && 'x'}
          </text>
        )}
      </svg>

      {/* Source handle at bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-400"
        style={{ bottom: padding - 4, left: '50%', transform: 'translateX(-50%)' }}
      />
    </div>
  )
}

// Register outside component to prevent re-renders
/* eslint-disable react-refresh/only-export-components -- nodeTypes and NODE_SIZES must be stable */
export const graphNodeTypes = {
  entity: GraphNodeComponent,
}

export { GraphNodeComponent }

// Export sizes for use in force layout collision detection
export { NODE_SIZES }
/* eslint-enable react-refresh/only-export-components */
