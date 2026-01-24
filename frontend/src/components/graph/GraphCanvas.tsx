import { useMemo, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Edge,
  type Node,
  MarkerType,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useNeighborhoodGraph } from '@/api/graph'
import { useGraphStore } from '@/stores/graphStore'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'
import { graphNodeTypes } from './GraphNode'
import { GraphControls } from './GraphControls'
import { useForceLayout } from './useForceLayout'
import type { GraphNode as ApiGraphNode, GraphEdge as ApiGraphEdge } from '@/api/types'

interface GraphCanvasProps {
  entityKey?: string
  draftId?: string
}

/**
 * Main graph canvas component with force-directed layout.
 *
 * Features:
 * - Fetches neighborhood graph via useNeighborhoodGraph
 * - Applies force-directed layout via useForceLayout
 * - Filters edges based on graphStore.edgeTypeFilter
 * - Overlays GraphControls for depth/filter adjustments
 * - Shows change status indicators in draft mode
 * - Displays cycle warning badge
 */
export function GraphCanvas({ entityKey: propEntityKey, draftId }: GraphCanvasProps) {
  const selectedEntityKey = useGraphStore((s) => s.selectedEntityKey)
  const depth = useGraphStore((s) => s.depth)
  const edgeTypeFilter = useGraphStore((s) => s.edgeTypeFilter)

  // Use prop entityKey or fall back to selectedEntityKey from store
  const entityKey = propEntityKey ?? selectedEntityKey

  // Fetch graph data
  const { data, isLoading, error } = useNeighborhoodGraph(
    entityKey,
    'category',
    depth,
    draftId
  )

  // Convert API response to React Flow format
  const { initialNodes, filteredEdges } = useMemo(() => {
    if (!data) return { initialNodes: [], filteredEdges: [] }

    // Convert nodes
    const nodes: Node[] = data.nodes.map((node: ApiGraphNode) => ({
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
    const edges: Edge[] = data.edges
      .filter((edge: ApiGraphEdge) => edgeTypeFilter.has(edge.edge_type))
      .map((edge: ApiGraphEdge, index: number) => ({
        id: `e${index}-${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: 'default',
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
  }, [data, edgeTypeFilter])

  // Apply force layout
  const { nodes, isRunning, restartSimulation } = useForceLayout(
    initialNodes,
    filteredEdges
  )

  // Track if this is the first render for fitView
  const hasFitViewRef = useRef(false)
  const { fitView } = useReactFlow()

  // Fit view only on initial load (not on every update)
  useEffect(() => {
    if (nodes.length > 0 && !hasFitViewRef.current) {
      // Delay fitView slightly to ensure nodes are rendered
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 300 })
        hasFitViewRef.current = true
      }, 100)
    }
  }, [nodes, fitView])

  // Reset hasFitViewRef when entityKey changes (new graph)
  useEffect(() => {
    hasFitViewRef.current = false
  }, [entityKey])

  if (isLoading) {
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

  if (!entityKey) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Select an entity to visualize
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        No graph data for this entity
      </div>
    )
  }

  return (
    <div className="h-full w-full relative">
      {data?.has_cycles && (
        <Badge
          variant="destructive"
          className="absolute top-2 left-2 z-10 flex items-center gap-1"
        >
          <AlertTriangle className="h-3 w-3" />
          Circular inheritance detected
        </Badge>
      )}

      <GraphControls onResetLayout={restartSimulation} isSimulating={isRunning} />

      <ReactFlow
        nodes={nodes}
        edges={filteredEdges}
        nodeTypes={graphNodeTypes}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#ddd" gap={16} />
        <Controls />
      </ReactFlow>
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
