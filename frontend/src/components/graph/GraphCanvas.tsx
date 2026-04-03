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

  // Graph visualization supports all entity types
  const GRAPH_SUPPORTED_TYPES = new Set(['category', 'property', 'subobject', 'template', 'module', 'bundle', 'dashboard', 'resource'])
  const isGraphSupported = GRAPH_SUPPORTED_TYPES.has(selectedEntityType)

  // Fetch the full ontology graph (once, not per entity)
  const { data, isLoading, error, isFetching } = useFullOntologyGraph(draftId)

  // Track previous data to keep showing graph while loading
  const prevDataRef = useRef(data)
  if (data && !isFetching) {
    prevDataRef.current = data
  }
  const displayData = data ?? prevDataRef.current

  // Get hovered node for edge highlighting
  const hoveredNodeId = useGraphStore((s) => s.hoveredNodeId)

  // Convert API response to React Flow format
  // Non-category nodes (properties, subobjects, etc.) are duplicated per connected
  // category so each category forms a clean cluster without cross-links.
  const { initialNodes, rawEdges } = useMemo(() => {
    if (!displayData) return { initialNodes: [], rawEdges: [] }

    const categoryTypes = new Set(['category'])
    const apiNodes = displayData.nodes as ApiGraphNode[]
    const apiEdges = displayData.edges as ApiGraphEdge[]

    // Identify category node IDs
    const categoryNodeIds = new Set(
      apiNodes.filter(n => categoryTypes.has(n.entity_type)).map(n => n.id)
    )

    // Build map: non-category node → list of connected category IDs (via edges)
    // First pass: direct category connections (property/subobject edges)
    const nodeToCategoryEdges = new Map<string, { catId: string; edge: ApiGraphEdge }[]>()
    // Also track non-category → non-category edges for second pass
    const nonCatToNonCat = new Map<string, { neighborId: string; edge: ApiGraphEdge }[]>()

    for (const edge of apiEdges) {
      if (!edgeTypeFilter.has(edge.edge_type)) continue
      if (edge.edge_type === 'parent') continue

      const sourceIsCat = categoryNodeIds.has(edge.source)
      const targetIsCat = categoryNodeIds.has(edge.target)

      if (sourceIsCat && !targetIsCat) {
        if (!nodeToCategoryEdges.has(edge.target)) nodeToCategoryEdges.set(edge.target, [])
        nodeToCategoryEdges.get(edge.target)!.push({ catId: edge.source, edge })
      } else if (targetIsCat && !sourceIsCat) {
        if (!nodeToCategoryEdges.has(edge.source)) nodeToCategoryEdges.set(edge.source, [])
        nodeToCategoryEdges.get(edge.source)!.push({ catId: edge.target, edge })
      } else if (!sourceIsCat && !targetIsCat) {
        // Track non-cat to non-cat edges (e.g., subobject_property)
        if (!nonCatToNonCat.has(edge.source)) nonCatToNonCat.set(edge.source, [])
        nonCatToNonCat.get(edge.source)!.push({ neighborId: edge.target, edge })
        if (!nonCatToNonCat.has(edge.target)) nonCatToNonCat.set(edge.target, [])
        nonCatToNonCat.get(edge.target)!.push({ neighborId: edge.source, edge })
      }
    }

    // Second pass: propagate category ownership through non-cat→non-cat edges.
    // If a subobject belongs to category X and has a subobject_property edge to
    // a property, that property should also be associated with category X.
    for (const [nodeId, neighbors] of nonCatToNonCat) {
      if (nodeToCategoryEdges.has(nodeId)) continue // Already has category connections
      const catIds = new Set<string>()
      for (const { neighborId } of neighbors) {
        const neighborCats = nodeToCategoryEdges.get(neighborId)
        if (neighborCats) {
          for (const { catId } of neighborCats) catIds.add(catId)
        }
      }
      if (catIds.size > 0) {
        // Create synthetic category associations for this node
        nodeToCategoryEdges.set(nodeId, [...catIds].map(catId => ({
          catId,
          edge: neighbors[0].edge, // Use first edge for type info
        })))
      }
    }

    // Build nodes: categories as-is, non-categories duplicated per connected category
    const nodeMap = new Map(apiNodes.map(n => [n.id, n]))
    const nodes: Node[] = []
    const edges: Edge[] = []
    const processedNonCats = new Set<string>()

    // Add category nodes
    for (const node of apiNodes) {
      if (categoryNodeIds.has(node.id)) {
        nodes.push({
          id: node.id,
          type: 'entity',
          position: { x: 0, y: 0 },
          data: {
            label: node.label,
            node_id: node.id,
            entity_key: node.id,
            entity_type: node.entity_type,
            modules: node.modules,
            bundles: node.bundles,
            change_status: node.change_status,
          },
        })
      }
    }

    // Add non-category nodes — one copy per connected category
    for (const [nodeId, catEdges] of nodeToCategoryEdges) {
      processedNonCats.add(nodeId)
      const node = nodeMap.get(nodeId)
      if (!node) continue

      for (const { catId, edge } of catEdges) {
        const cloneId = `${nodeId}__${catId}`
        nodes.push({
          id: cloneId,
          type: 'entity',
          position: { x: 0, y: 0 },
          data: {
            label: node.label,
            node_id: cloneId,
            entity_key: node.id,
            entity_type: node.entity_type,
            modules: node.modules,
            bundles: node.bundles,
            change_status: node.change_status,
          },
        })

        // Create edge from category to this clone
        const edgeSource = categoryNodeIds.has(edge.source) ? edge.source : cloneId
        const edgeTarget = categoryNodeIds.has(edge.target) ? edge.target : cloneId
        edges.push({
          id: `clone-${cloneId}-${edge.edge_type}`,
          source: edgeSource,
          target: edgeTarget,
          type: 'default',
          data: { edge_type: edge.edge_type, change_status: edge.change_status },
          style: {},
        })
      }
    }

    // Add non-category nodes with no category connections (keep original)
    for (const node of apiNodes) {
      if (!categoryNodeIds.has(node.id) && !processedNonCats.has(node.id)) {
        nodes.push({
          id: node.id,
          type: 'entity',
          position: { x: 0, y: 0 },
          data: {
            label: node.label,
            node_id: node.id,
            entity_key: node.id,
            entity_type: node.entity_type,
            modules: node.modules,
            bundles: node.bundles,
            change_status: node.change_status,
          },
        })
      }
    }

    // Add parent edges (category→category, untouched)
    const parentEdges = apiEdges.filter(e =>
      edgeTypeFilter.has(e.edge_type) && e.edge_type === 'parent'
    )
    for (let i = 0; i < parentEdges.length; i++) {
      const edge = parentEdges[i]
      edges.push({
        id: `parent-${i}-${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: 'default',
        data: { edge_type: edge.edge_type, change_status: edge.change_status },
        style: {},
      })
    }

    // Add edges between non-category nodes (e.g., subobject→property)
    const nonCatEdges = apiEdges.filter(e =>
      edgeTypeFilter.has(e.edge_type) &&
      e.edge_type !== 'parent' &&
      !categoryNodeIds.has(e.source) &&
      !categoryNodeIds.has(e.target)
    )
    for (let i = 0; i < nonCatEdges.length; i++) {
      const edge = nonCatEdges[i]
      // Find clones that share a category parent, or just use first clone
      const sourceClones = nodeToCategoryEdges.get(edge.source)
      const targetClones = nodeToCategoryEdges.get(edge.target)
      if (sourceClones && targetClones) {
        // Connect clones that share a category
        for (const sc of sourceClones) {
          for (const tc of targetClones) {
            if (sc.catId === tc.catId) {
              edges.push({
                id: `noncat-${i}-${sc.catId}`,
                source: `${edge.source}__${sc.catId}`,
                target: `${edge.target}__${tc.catId}`,
                type: 'default',
                data: { edge_type: edge.edge_type, change_status: edge.change_status },
                style: {},
              })
            }
          }
        }
      }
    }

    return { initialNodes: nodes, rawEdges: edges }
  }, [displayData, edgeTypeFilter])

  // Style edges separately — depends on hover/selection which change frequently
  const filteredEdges = useMemo(() => {
    const selectedCloneIds = new Set<string>()
    if (selectedEntityKey) {
      const prefix = selectedEntityKey + '__'
      for (const edge of rawEdges) {
        if (edge.source === selectedEntityKey || edge.source.startsWith(prefix)) selectedCloneIds.add(edge.source)
        if (edge.target === selectedEntityKey || edge.target.startsWith(prefix)) selectedCloneIds.add(edge.target)
      }
    }

    return rawEdges.map((edge) => {
      const edgeType = edge.data?.edge_type as string
      const changeStatus = edge.data?.change_status as string | undefined

      const isConnectedToHovered = hoveredNodeId
        ? edge.source === hoveredNodeId || edge.target === hoveredNodeId
        : false

      const isConnectedToSelected = !hoveredNodeId && selectedCloneIds.size > 0
        ? selectedCloneIds.has(edge.source) || selectedCloneIds.has(edge.target)
        : false

      const isAddedEdge = changeStatus === 'added' || changeStatus === 'modified'
      const isDeletedEdge = changeStatus === 'deleted'
      const isDraftEdge = isAddedEdge || isDeletedEdge

      let opacity = 0.7
      let strokeWidth = 1.5
      if (hoveredNodeId) {
        if (isConnectedToHovered) { opacity = 1; strokeWidth = 2.5 }
        else { opacity = 0.15 }
      } else if (selectedCloneIds.size > 0) {
        if (isConnectedToSelected) { opacity = 1; strokeWidth = 2.5 }
        else { opacity = 0.15 }
      }

      const edgeColor = isAddedEdge ? '#22c55e' : isDeletedEdge ? '#ef4444' : getEdgeColor(edgeType)
      const dasharray = isDraftEdge ? '6,4' : getEdgeStrokeDasharray(edgeType)

      return {
        ...edge,
        animated: isDraftEdge,
        markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: edgeColor },
        style: {
          stroke: edgeColor,
          strokeWidth: isDraftEdge ? 2 : strokeWidth,
          strokeDasharray: dasharray,
          opacity: isDeletedEdge ? 0.5 : opacity,
          transition: 'opacity 0.2s ease, stroke-width 0.2s ease',
        },
      }
    })
  }, [rawEdges, hoveredNodeId, selectedEntityKey])

  // Apply layout based on selected algorithm
  const { nodes, isRunning, restartSimulation } = useHybridLayout(
    initialNodes,
    filteredEdges,
    { algorithm: layoutAlgorithm, direction: layoutDirection }
  )

  // Extract unique bundle IDs for hull controls
  const { moduleIds, bundleIds } = useMemo(() => {
    const moduleSet = new Set<string>()
    const bundleSet = new Set<string>()
    for (const node of nodes) {
      if (node.data.modules && Array.isArray(node.data.modules)) {
        for (const id of node.data.modules) {
          moduleSet.add(id as string)
        }
      }
      if (node.data.bundles && Array.isArray(node.data.bundles)) {
        for (const id of node.data.bundles) {
          bundleSet.add(id as string)
        }
      }
    }
    return { moduleIds: Array.from(moduleSet), bundleIds: Array.from(bundleSet) }
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

    setViewport({ x, y, zoom }, { duration: animate ? 100 : 0 })
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-center only when panel toggles
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
        <p>Graph view is not available for this entity type</p>
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
        <ModuleHullControls modules={moduleIds} bundles={bundleIds} />
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
      return '#475569' // slate-600 (more contrast than #888)
    case 'property':
      return '#2563eb' // blue-600 (more saturated)
    case 'subobject':
      return '#7c3aed' // violet-600 (more saturated)
    case 'subobject_property':
      return '#0d9488' // teal-600 (more saturated)
    case 'template':
      return '#f59e0b' // amber-500 - distinct from other edge types
    case 'module_dashboard':
      return '#dc2626' // red-600 - matches dashboard color
    case 'category_resource':
      return '#0891b2' // cyan-600 - matches resource color
    default:
      return '#475569'
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
    case 'subobject_property':
      return '5,5' // dashed (like property edges)
    case 'template':
      return '8,3' // long dash
    case 'module_dashboard':
      return '8,4' // long dash - distinct
    case 'category_resource':
      return '3,3' // short dash - distinct
    default:
      return undefined
  }
}
