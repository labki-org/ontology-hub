import { create } from 'zustand'

interface DetailState {
  // Modal open state
  isOpen: boolean

  // Edit mode toggle
  isEditing: boolean

  // Currently viewed entity (may differ from selected in graph)
  entityKey: string | null
  entityType: string | null

  // Navigation breadcrumb trail
  breadcrumbs: Array<{ key: string; type: string; label: string }>

  // Actions
  openDetail: (entityKey: string, entityType: string) => void
  closeDetail: () => void
  setEditing: (editing: boolean) => void
  pushBreadcrumb: (key: string, type: string, label: string) => void
  navigateToBreadcrumb: (index: number) => void
  clearBreadcrumbs: () => void
}

export const useDetailStore = create<DetailState>((set, get) => ({
  isOpen: false,
  isEditing: false,
  entityKey: null,
  entityType: null,
  breadcrumbs: [],

  openDetail: (entityKey, entityType) => {
    const { entityKey: currentKey } = get()

    // If opening from closed state, start fresh breadcrumbs
    if (!get().isOpen) {
      set({
        isOpen: true,
        entityKey,
        entityType,
        breadcrumbs: [], // Will be populated when entity loads
        isEditing: false, // Reset edit mode on new modal
      })
    } else if (currentKey !== entityKey) {
      // Navigating to different entity while modal open - add to breadcrumbs
      set({
        entityKey,
        entityType,
        // Breadcrumb added by component after label loads
      })
    }
  },

  closeDetail: () =>
    set({
      isOpen: false,
      entityKey: null,
      entityType: null,
      breadcrumbs: [],
      isEditing: false,
    }),

  setEditing: (editing) => set({ isEditing: editing }),

  pushBreadcrumb: (key, type, label) =>
    set((state) => ({
      breadcrumbs: [
        ...state.breadcrumbs.filter((b) => b.key !== key), // Avoid duplicates
        { key, type, label },
      ],
    })),

  navigateToBreadcrumb: (index) => {
    const { breadcrumbs } = get()
    if (index < breadcrumbs.length) {
      const target = breadcrumbs[index]
      set({
        entityKey: target.key,
        entityType: target.type,
        breadcrumbs: breadcrumbs.slice(0, index + 1),
      })
    }
  },

  clearBreadcrumbs: () => set({ breadcrumbs: [] }),
}))
