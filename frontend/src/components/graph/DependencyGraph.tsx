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

import type { ModulePublic } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'
import { moduleNodeTypes } from './ModuleNode'
import { getLayoutedElements } from './useGraphLayout'

interface DependencyGraphProps {
  modules: ModulePublic[]
  currentModuleId?: string
  compact?: boolean
}

/**
 * Detect if there are circular dependencies in the module graph.
 * Uses DFS with tracking of visited and in-progress nodes.
 */
function detectCycles(modules: ModulePublic[]): boolean {
  const moduleMap = new Map(modules.map(m => [m.module_id, m]))
  const visited = new Set<string>()
  const inProgress = new Set<string>()

  function dfs(moduleId: string): boolean {
    if (inProgress.has(moduleId)) return true // Cycle detected
    if (visited.has(moduleId)) return false

    inProgress.add(moduleId)

    const module = moduleMap.get(moduleId)
    if (module) {
      for (const depId of module.dependencies || []) {
        if (moduleMap.has(depId) && dfs(depId)) {
          return true
        }
      }
    }

    inProgress.delete(moduleId)
    visited.add(moduleId)
    return false
  }

  for (const module of modules) {
    if (dfs(module.module_id)) {
      return true
    }
  }

  return false
}

export function DependencyGraph({ modules, currentModuleId, compact = false }: DependencyGraphProps) {
  const { nodes, edges, hasCycle } = useMemo(() => {
    if (!modules || modules.length === 0) {
      return { nodes: [], edges: [], hasCycle: false }
    }

    // Check for circular dependencies
    const hasCycle = detectCycles(modules)

    // Build nodes from modules
    const graphNodes: Node[] = modules.map((m) => ({
      id: m.module_id,
      type: 'module',
      position: { x: 0, y: 0 }, // Will be set by layout
      data: {
        label: m.label,
        moduleId: m.module_id,
        entityCount: m.category_ids?.length || 0,
        isCurrent: m.module_id === currentModuleId,
      },
    }))

    // Build edges from dependencies field
    // Edge direction: dependency -> dependent (arrow shows "depends on")
    // Only create edges where both source and target exist in our modules
    const moduleIds = new Set(modules.map(m => m.module_id))
    const graphEdges: Edge[] = modules.flatMap((m) =>
      (m.dependencies || [])
        .filter(depId => moduleIds.has(depId))
        .map((depId) => ({
          id: `${depId}->${m.module_id}`,
          source: depId,
          target: m.module_id,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 15,
            height: 15,
            color: '#888',
          },
          style: { stroke: '#888', strokeWidth: 1.5 },
        }))
    )

    // Apply dagre layout
    const layouted = getLayoutedElements(graphNodes, graphEdges)
    return { ...layouted, hasCycle }
  }, [modules, currentModuleId])

  if (!modules || modules.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        No modules to display
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        No dependency data
      </div>
    )
  }

  return (
    <div className="h-full w-full relative">
      {hasCycle && (
        <Badge variant="destructive" className="absolute top-2 right-2 z-10 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Circular dependency detected
        </Badge>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={moduleNodeTypes}
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
