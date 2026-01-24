import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { enableMapSet } from 'immer'

// Enable Map and Set support in immer (required for Zustand immer middleware)
enableMapSet()

interface GraphState {
  // Selection and expansion state
  selectedEntityKey: string | null
  selectedEntityType: string
  expandedNodes: Set<string>

  // View settings
  depth: number
  showProperties: boolean
  showSubobjects: boolean
  showTemplates: boolean
  edgeTypeFilter: Set<string>

  // Actions
  setSelectedEntity: (key: string | null, entityType?: string) => void
  toggleNodeExpanded: (key: string) => void
  setDepth: (depth: number) => void
  toggleEntityType: (type: 'property' | 'subobject' | 'template') => void
  setEdgeTypeFilter: (types: string[]) => void
  resetGraph: () => void
}

const initialState = {
  selectedEntityKey: null,
  selectedEntityType: 'category',
  expandedNodes: new Set<string>(),
  depth: 2,
  showProperties: false,
  showSubobjects: false,
  showTemplates: false,
  edgeTypeFilter: new Set<string>(['parent', 'property', 'subobject']),
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

    resetGraph: () => {
      set((state) => {
        state.selectedEntityKey = null
        state.selectedEntityType = 'category'
        state.expandedNodes = new Set<string>()
        state.depth = 2
        state.showProperties = false
        state.showSubobjects = false
        state.showTemplates = false
        state.edgeTypeFilter = new Set<string>(['parent', 'property', 'subobject'])
      })
    },
  }))
)
