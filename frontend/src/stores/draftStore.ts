import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { DraftPublic, EntityDefinition, VersionDiffResponse } from '@/api/types'

interface DraftState {
  // Draft data
  draft: DraftPublic | null
  originalDiff: VersionDiffResponse | null

  // Editing state
  // Map key format: "entityType:entityId" (e.g., "categories:Person")
  editedEntities: Map<string, Partial<EntityDefinition>>
  // Set key format: "entityType:entityId:field" (e.g., "categories:Person:label")
  editingFields: Set<string>
  hasUnsavedChanges: boolean

  // Actions
  setDraft: (draft: DraftPublic, diff: VersionDiffResponse) => void
  startEditingField: (fieldKey: string) => void
  stopEditingField: (fieldKey: string) => void
  updateEntityField: (
    entityType: string,
    entityId: string,
    field: string,
    value: unknown
  ) => void
  discardChanges: () => void
  getEditedValue: (
    entityType: string,
    entityId: string,
    field: string
  ) => unknown | undefined
  reset: () => void
}

const initialState = {
  draft: null,
  originalDiff: null,
  editedEntities: new Map<string, Partial<EntityDefinition>>(),
  editingFields: new Set<string>(),
  hasUnsavedChanges: false,
}

export const useDraftStore = create<DraftState>()(
  immer((set, get) => ({
    ...initialState,

    setDraft: (draft, diff) => {
      set((state) => {
        state.draft = draft
        state.originalDiff = diff
        // Reset editing state when loading new draft
        state.editedEntities = new Map()
        state.editingFields = new Set()
        state.hasUnsavedChanges = false
      })
    },

    startEditingField: (fieldKey) => {
      set((state) => {
        state.editingFields.add(fieldKey)
      })
    },

    stopEditingField: (fieldKey) => {
      set((state) => {
        state.editingFields.delete(fieldKey)
      })
    },

    updateEntityField: (entityType, entityId, field, value) => {
      set((state) => {
        const key = `${entityType}:${entityId}`
        const existing = state.editedEntities.get(key) || {}

        state.editedEntities.set(key, {
          ...existing,
          [field]: value,
        })
        state.hasUnsavedChanges = true
      })
    },

    discardChanges: () => {
      set((state) => {
        state.editedEntities = new Map()
        state.editingFields = new Set()
        state.hasUnsavedChanges = false
      })
    },

    getEditedValue: (entityType, entityId, field) => {
      const key = `${entityType}:${entityId}`
      const edited = get().editedEntities.get(key)
      return edited?.[field as keyof EntityDefinition]
    },

    reset: () => {
      set(initialState)
    },
  }))
)

// Helper to build field key
export function buildFieldKey(
  entityType: string,
  entityId: string,
  field: string
): string {
  return `${entityType}:${entityId}:${field}`
}
