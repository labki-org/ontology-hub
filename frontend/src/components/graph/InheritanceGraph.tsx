import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Edge,
  type Node,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useInheritance } from '@/api/entities'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'
import { nodeTypes } from './CategoryNode'
import { getLayoutedElements } from './useGraphLayout'

interface InheritanceGraphProps {
  entityId: string
  compact?: boolean
}

export function InheritanceGraph({ entityId, compact = false }: InheritanceGraphProps) {
  const { data, isLoading, error } = useInheritance(entityId)

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] }

    // Convert API response to React Flow format
    const apiNodes: Node[] = data.nodes.map((node) => ({
      id: node.id,
      type: 'category',
      position: { x: 0, y: 0 }, // Will be set by layout
      data: {
        label: node.label,
        entityId: node.entity_id,
        isCurrent: node.is_current,
      },
    }))

    const apiEdges: Edge[] = data.edges.map((edge, index) => ({
      id: `e${index}-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 15,
        height: 15,
        color: '#888',
      },
      style: { stroke: '#888', strokeWidth: 1.5 },
    }))

    // Apply dagre layout
    return getLayoutedElements(apiNodes, apiEdges)
  }, [data])

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
        Failed to load inheritance graph
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        No inheritance data
      </div>
    )
  }

  return (
    <div className="h-full w-full relative">
      {data?.has_circular && (
        <Badge variant="destructive" className="absolute top-2 right-2 z-10 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Circular inheritance detected
        </Badge>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#ddd" gap={16} />
        {!compact && <Controls />}
      </ReactFlow>
    </div>
  )
}
