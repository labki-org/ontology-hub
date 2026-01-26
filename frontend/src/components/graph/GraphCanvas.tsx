import { useMemo, useEffect, useRef, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Edge,
  type Node,
  MarkerType,
  useReactFlow,
  useViewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useFullOntologyGraph } from '@/api/graph'
import { useGraphStore } from '@/stores/graphStore'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'
import { graphNodeTypes } from './GraphNode'
import { GraphControls } from './GraphControls'
import { useHybridLayout } from './useHybridLayout'
import { HullLayer } from './HullLayer'
import { ModuleHullControls } from './ModuleHullControls'
import type { GraphNode as ApiGraphNode, GraphEdge as ApiGraphEdge } from '@/api/types'

interface GraphCanvasProps {
  entityKey?: string
  draftId?: string
  /** When true, offset graph center to the left to make room for detail panel */
  detailPanelOpen?: boolean
}

/**
 * Main graph canvas component with force-directed layout.
 *
 * Features:
 * - Fetches full ontology graph via useFullOntologyGraph
 * - Applies force-directed layout via useForceLayout
 * - Filters edges based on graphStore.edgeTypeFilter
 * - Centers on selected entity when selection changes
 * - Overlays GraphControls for filter adjustments
 * - Shows change status indicators in draft mode
 * - Displays cycle warning badge
 */
export function GraphCanvas({ entityKey: propEntityKey, draftId, detailPanelOpen = false }: GraphCanvasProps) {
  const selectedEntityKey = useGraphStore((s) => s.selectedEntityKey)
  const selectedEntityType = useGraphStore((s) => s.selectedEntityType)
  const edgeTypeFilter = useGraphStore((s) => s.edgeTypeFilter)
  const setHoveredNode = useGraphStore((s) => s.setHoveredNode)
  const setGraphData = useGraphStore((s) => s.setGraphData)
  const layoutAlgorithm = useGraphStore((s) => s.layoutAlgorithm)
  const layoutDirection = useGraphStore((s) => s.layoutDirection)

  // Hover handlers for node highlighting
  const onNodeMouseEnter = useCallback((_event: React.MouseEvent, node: Node) => {
    setHoveredNode(node.id)
  }, [setHoveredNode])

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNode(null)
  }, [setHoveredNode])

  // Use prop entityKey or fall back to selectedEntityKey from store
  const entityKey = propEntityKey ?? selectedEntityKey

  // Graph visualization supports all entity types except bundles
  const GRAPH_SUPPORTED_TYPES = new Set(['category', 'property', 'subobject', 'template', 'module'])
  const isGraphSupported = GRAPH_SUPPORTED_TYPES.has(selectedEntityType)

  // Fetch the full ontology graph (once, not per entity)
  const { data, isLoading, error, isFetching } = useFullOntologyGraph(draftId)

  // Track previous data to keep showing graph while loading
  const prevDataRef = useRef(data)
  if (data && !isFetching) {
    prevDataRef.current = data
  }
  const displayData = data ?? prevDataRef.current

  // Convert API response to React Flow format
  const { initialNodes, filteredEdges } = useMemo(() => {
    if (!displayData) return { initialNodes: [], filteredEdges: [] }

    // Convert nodes
    const nodes: Node[] = displayData.nodes.map((node: ApiGraphNode) => ({
      id: node.id,
      type: 'entity',
      position: { x: 0, y: 0 }, // Will be set by force layout
      data: {
        label: node.label,
        entity_key: node.id,
        entity_type: node.entity_type,
        modules: node.modules,
        change_status: node.change_status,
      },
    }))

    // Filter edges by edge_type
    const edges: Edge[] = displayData.edges
      .filter((edge: ApiGraphEdge) => edgeTypeFilter.has(edge.edge_type))
      .map((edge: ApiGraphEdge, index: number) => ({
        id: `e${index}-${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 15,
          height: 15,
          color: getEdgeColor(edge.edge_type),
        },
        style: {
          stroke: getEdgeColor(edge.edge_type),
          strokeWidth: 1.5,
          strokeDasharray: getEdgeStrokeDasharray(edge.edge_type),
        },
        data: {
          edge_type: edge.edge_type,
        },
      }))

    return { initialNodes: nodes, filteredEdges: edges }
  }, [displayData, edgeTypeFilter])

  // Apply layout based on selected algorithm
  const { nodes, isRunning, restartSimulation } = useHybridLayout(
    initialNodes,
    filteredEdges,
    { algorithm: layoutAlgorithm, direction: layoutDirection }
  )

  // Extract unique module IDs for hull controls
  const moduleIds = useMemo(() => {
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

  // Track if layout has been initialized
  const layoutInitializedRef = useRef(false)
  const { setViewport } = useReactFlow()
  const viewport = useViewport()

  // Detail panel width for offset calculation (must match BrowsePage)
  const DETAIL_PANEL_WIDTH = 520

  // Reference to the container for measuring dimensions
  const containerRef = useRef<HTMLDivElement>(null)

  // Helper to center on a specific node
  const centerOnNode = useCallback((nodeId: string, animate = true) => {
    const targetNode = nodes.find(n => n.id === nodeId)
    if (!targetNode) return

    const container = containerRef.current
    if (!container) return

    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    // Available width (subtract panel width if open)
    const availableWidth = detailPanelOpen ? containerWidth - DETAIL_PANEL_WIDTH : containerWidth

    // Center of available area
    const availableCenterX = detailPanelOpen ? availableWidth / 2 : containerWidth / 2
    const availableCenterY = containerHeight / 2

    // Node position (center of node)
    const nodeX = targetNode.position.x + 86  // half of ~172px node width
    const nodeY = targetNode.position.y + 18  // half of ~36px node height

    // Keep current zoom level, just pan to center on node
    const zoom = viewport.zoom || 0.5

    const x = availableCenterX - nodeX * zoom
    const y = availableCenterY - nodeY * zoom

    setViewport({ x, y, zoom }, { duration: animate ? 300 : 0 })
  }, [nodes, detailPanelOpen, viewport.zoom, setViewport])

  // Helper to fit entire graph with offset for detail panel
  const fitViewWithOffset = useCallback(() => {
    if (!nodes.length) return

    // Calculate the bounding box of all nodes
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const node of nodes) {
      minX = Math.min(minX, node.position.x)
      maxX = Math.max(maxX, node.position.x + 172) // node width ~172px
      minY = Math.min(minY, node.position.y)
      maxY = Math.max(maxY, node.position.y + 36) // node height ~36px
    }

    const graphWidth = maxX - minX
    const graphHeight = maxY - minY
    const graphCenterX = (minX + maxX) / 2
    const graphCenterY = (minY + maxY) / 2

    // Get container dimensions
    const container = containerRef.current
    if (!container) return

    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    // Available width (subtract panel width if open)
    const availableWidth = detailPanelOpen ? containerWidth - DETAIL_PANEL_WIDTH : containerWidth
    const availableHeight = containerHeight

    // Calculate zoom to fit with padding
    const padding = 0.8
    const scaleX = availableWidth / (graphWidth * (1 + padding))
    const scaleY = availableHeight / (graphHeight * (1 + padding))
    const zoom = Math.min(scaleX, scaleY, 1) // Cap at 1x zoom

    // Calculate viewport position to center the graph in the available area
    const availableCenterX = detailPanelOpen ? availableWidth / 2 : containerWidth / 2
    const availableCenterY = containerHeight / 2

    const x = availableCenterX - graphCenterX * zoom
    const y = availableCenterY - graphCenterY * zoom

    setViewport({ x, y, zoom }, { duration: 300 })
  }, [nodes, detailPanelOpen, setViewport])

  // Initialize layout - fit entire graph, then center on selected entity if any
  useEffect(() => {
    if (nodes.length > 0 && !layoutInitializedRef.current) {
      const timeout = setTimeout(() => {
        if (entityKey && isGraphSupported) {
          // If an entity is selected, center on it
          centerOnNode(entityKey, false)
        } else {
          // Otherwise fit the entire graph
          fitViewWithOffset()
        }
        layoutInitializedRef.current = true
      }, 50)
      return () => clearTimeout(timeout)
    }
  }, [nodes.length, entityKey, isGraphSupported, centerOnNode, fitViewWithOffset])

  // Center on selected entity when it changes (after initial layout)
  useEffect(() => {
    if (layoutInitializedRef.current && entityKey && isGraphSupported && nodes.length > 0) {
      centerOnNode(entityKey, true)
    }
  }, [entityKey, isGraphSupported, centerOnNode, nodes.length])

  // Adjust for detail panel open/close
  useEffect(() => {
    if (layoutInitializedRef.current && entityKey && isGraphSupported && nodes.length > 0) {
      centerOnNode(entityKey, true)
    }
  }, [detailPanelOpen])

  // Sync graph data to store for change propagation tracking
  useEffect(() => {
    if (displayData) {
      setGraphData(displayData.nodes, displayData.edges)
    }
  }, [displayData, setGraphData])

  // Only show loading skeleton on initial load
  if (isLoading && !prevDataRef.current) {
    return (
      <div className="h-full flex items-center justify-center">
        <Skeleton className="h-24 w-48" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Failed to load graph
      </div>
    )
  }

  if (!isGraphSupported) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p>Graph view is not available for bundles</p>
          <p className="text-sm mt-1">Select a category, property, subobject, template, or module</p>
        </div>
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        No graph data available
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full w-full relative">
      {/* Loading indicator when fetching new data */}
      {isFetching && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
          <Badge variant="secondary" className="animate-pulse">
            Loading...
          </Badge>
        </div>
      )}

      {displayData?.has_cycles && (
        <Badge
          variant="destructive"
          className="absolute top-2 left-2 z-10 flex items-center gap-1"
        >
          <AlertTriangle className="h-3 w-3" />
          Circular inheritance detected
        </Badge>
      )}

      {/* Controls bar - horizontal at top left */}
      <div className="absolute top-4 left-4 z-10 flex items-start gap-2">
        <GraphControls onResetLayout={restartSimulation} isSimulating={isRunning} />
        <ModuleHullControls modules={moduleIds} />
      </div>

      <ReactFlow
        nodes={nodes}
        edges={filteredEdges}
        nodeTypes={graphNodeTypes}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#ddd" gap={16} />
        <Controls />
      </ReactFlow>

      {/* Module hull overlays - rendered with viewport transform to match graph */}
      <HullLayer nodes={nodes} viewport={viewport} />
    </div>
  )
}

// Helper functions for edge styling

function getEdgeColor(edgeType: string): string {
  switch (edgeType) {
    case 'parent':
      return '#888'
    case 'property':
      return '#3b82f6' // blue
    case 'subobject':
      return '#8b5cf6' // purple
    default:
      return '#888'
  }
}

function getEdgeStrokeDasharray(edgeType: string): string | undefined {
  switch (edgeType) {
    case 'parent':
      return undefined // solid
    case 'property':
      return '5,5' // dashed
    case 'subobject':
      return '2,2' // dotted
    default:
      return undefined
  }
}
