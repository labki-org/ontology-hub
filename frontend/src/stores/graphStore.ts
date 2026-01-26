import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { enableMapSet } from 'immer'
import type { GraphNode, GraphEdge } from '@/api/types'

// Enable Map and Set support in immer (required for Zustand immer middleware)
enableMapSet()

export type LayoutAlgorithm = 'force' | 'dagre' | 'hybrid' | 'radial'
export type LayoutDirection = 'TB' | 'LR'

interface GraphState {
  // Selection and expansion state
  selectedEntityKey: string | null
  selectedEntityType: string
  expandedNodes: Set<string>
  hoveredNodeId: string | null

  // Current graph data (populated by GraphCanvas when graph loads)
  nodes: GraphNode[]
  edges: GraphEdge[]

  // View settings
  depth: number
  showProperties: boolean
  showSubobjects: boolean
  showTemplates: boolean
  edgeTypeFilter: Set<string>

  // Layout settings
  layoutAlgorithm: LayoutAlgorithm
  layoutDirection: LayoutDirection

  // Actions
  setSelectedEntity: (key: string | null, entityType?: string) => void
  toggleNodeExpanded: (key: string) => void
  setHoveredNode: (key: string | null) => void
  setGraphData: (nodes: GraphNode[], edges: GraphEdge[]) => void
  setDepth: (depth: number) => void
  toggleEntityType: (type: 'property' | 'subobject' | 'template') => void
  setEdgeTypeFilter: (types: string[]) => void
  setLayoutAlgorithm: (algorithm: LayoutAlgorithm) => void
  setLayoutDirection: (direction: LayoutDirection) => void
  resetGraph: () => void
}

const initialState = {
  selectedEntityKey: null,
  selectedEntityType: 'category',
  expandedNodes: new Set<string>(),
  hoveredNodeId: null as string | null,
  nodes: [] as GraphNode[],
  edges: [] as GraphEdge[],
  depth: 2,
  showProperties: false,
  showSubobjects: false,
  showTemplates: false,
  edgeTypeFilter: new Set<string>(['parent', 'property', 'subobject', 'subobject_property']),
  layoutAlgorithm: 'radial' as LayoutAlgorithm,
  layoutDirection: 'TB' as LayoutDirection,
}

export const useGraphStore = create<GraphState>()(
  immer((set) => ({
    ...initialState,

    setSelectedEntity: (key, entityType = 'category') => {
      set((state) => {
        state.selectedEntityKey = key
        state.selectedEntityType = entityType
      })
    },

    toggleNodeExpanded: (key) => {
      set((state) => {
        if (state.expandedNodes.has(key)) {
          state.expandedNodes.delete(key)
        } else {
          state.expandedNodes.add(key)
        }
      })
    },

    setHoveredNode: (key) => {
      set((state) => {
        state.hoveredNodeId = key
      })
    },

    setGraphData: (nodes, edges) => {
      set((state) => {
        state.nodes = nodes
        state.edges = edges
      })
    },

    setDepth: (depth) => {
      set((state) => {
        // Clamp depth to 1-3 range
        state.depth = Math.min(3, Math.max(1, depth))
      })
    },

    toggleEntityType: (type) => {
      set((state) => {
        switch (type) {
          case 'property':
            state.showProperties = !state.showProperties
            break
          case 'subobject':
            state.showSubobjects = !state.showSubobjects
            break
          case 'template':
            state.showTemplates = !state.showTemplates
            break
        }
      })
    },

    setEdgeTypeFilter: (types) => {
      set((state) => {
        state.edgeTypeFilter = new Set(types)
      })
    },

    setLayoutAlgorithm: (algorithm) => {
      set((state) => {
        state.layoutAlgorithm = algorithm
      })
    },

    setLayoutDirection: (direction) => {
      set((state) => {
        state.layoutDirection = direction
      })
    },

    resetGraph: () => {
      set((state) => {
        state.selectedEntityKey = null
        state.selectedEntityType = 'category'
        state.expandedNodes = new Set<string>()
        state.hoveredNodeId = null
        state.nodes = []
        state.edges = []
        state.depth = 2
        state.showProperties = false
        state.showSubobjects = false
        state.showTemplates = false
        state.edgeTypeFilter = new Set<string>(['parent', 'property', 'subobject', 'subobject_property'])
        state.layoutAlgorithm = 'radial'
        state.layoutDirection = 'TB'
      })
    },
  }))
)
