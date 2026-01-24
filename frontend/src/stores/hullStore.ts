import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface HullState {
  // Hull visibility state
  visibleModules: Set<string>

  // Actions
  toggleModule: (moduleId: string) => void
  showModule: (moduleId: string) => void
  hideModule: (moduleId: string) => void
  showAll: (moduleIds: string[]) => void
  hideAll: () => void
  isVisible: (moduleId: string) => boolean
}

export const useHullStore = create<HullState>()(
  persist(
    (set, get) => ({
      visibleModules: new Set<string>(),

      toggleModule: (moduleId) => {
        set((state) => {
          const next = new Set(state.visibleModules)
          if (next.has(moduleId)) {
            next.delete(moduleId)
          } else {
            next.add(moduleId)
          }
          return { visibleModules: next }
        })
      },

      showModule: (moduleId) => {
        set((state) => {
          const next = new Set(state.visibleModules)
          next.add(moduleId)
          return { visibleModules: next }
        })
      },

      hideModule: (moduleId) => {
        set((state) => {
          const next = new Set(state.visibleModules)
          next.delete(moduleId)
          return { visibleModules: next }
        })
      },

      showAll: (moduleIds) => {
        set({ visibleModules: new Set(moduleIds) })
      },

      hideAll: () => {
        set({ visibleModules: new Set<string>() })
      },

      isVisible: (moduleId) => {
        return get().visibleModules.has(moduleId)
      },
    }),
    {
      name: 'hull-visibility',
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const parsed = JSON.parse(str)
          return JSON.stringify({
            state: {
              ...parsed.state,
              visibleModules: new Set(parsed.state.visibleModules),
            },
          })
        },
        setItem: (name, value) => {
          const parsed = typeof value === 'string' ? JSON.parse(value) : value
          localStorage.setItem(
            name,
            JSON.stringify({
              state: {
                ...parsed.state,
                visibleModules: Array.from(parsed.state.visibleModules),
              },
            })
          )
        },
        removeItem: (name) => localStorage.removeItem(name),
      })),
    }
  )
)
