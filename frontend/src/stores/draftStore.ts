import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { enableMapSet } from 'immer'

// Enable Map and Set support in immer (required for Zustand immer middleware)
enableMapSet()
import type {
  DraftPublic,
  EntityDefinition,
  VersionDiffResponse,
  ModuleAssignmentState,
  NewModule,
  ProfileDefinition,
  ModulePublic,
} from '@/api/types'

interface DraftState {
  // Draft data
  draft: DraftPublic | null
  originalDiff: VersionDiffResponse | null

  // Editing state
  // Map key format: "entityType:entityId" (e.g., "categories:Person")
  editedEntities: Map<string, Partial<EntityDefinition>>
  // Set key format: "entityType:entityId:field" (e.g., "categories:Person:label")
  editingFields: Set<string>

  // Module assignment state
  // Map key format: "entityId" -> assignments
  moduleAssignments: Map<string, ModuleAssignmentState>
  // Profile edits: profile_id -> module_ids
  profileEdits: Map<string, string[]>
  // Modules created as part of draft
  newModules: NewModule[]
  // Profiles created as part of draft
  newProfiles: ProfileDefinition[]

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

  // Module assignment actions
  assignToModule: (entityId: string, moduleId: string) => void
  removeFromModule: (entityId: string, moduleId: string, dependentChildren?: string[]) => void
  bulkAssignToModule: (entityIds: string[], moduleId: string) => void
  updateProfileModules: (profileId: string, moduleIds: string[]) => void
  addNewModule: (module: NewModule) => void
  addNewProfile: (profile: ProfileDefinition) => void
  computeAutoIncludes: (modules: ModulePublic[]) => void
  getEffectiveModules: (entityId: string, entityType: 'category' | 'property' | 'subobject', parentCategories?: string[]) => string[]
}

const initialState = {
  draft: null,
  originalDiff: null,
  editedEntities: new Map<string, Partial<EntityDefinition>>(),
  editingFields: new Set<string>(),
  moduleAssignments: new Map<string, ModuleAssignmentState>(),
  profileEdits: new Map<string, string[]>(),
  newModules: [] as NewModule[],
  newProfiles: [] as ProfileDefinition[],
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
        state.moduleAssignments = new Map()
        state.profileEdits = new Map()
        state.newModules = []
        state.newProfiles = []
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

    // Module assignment actions

    assignToModule: (entityId, moduleId) => {
      set((state) => {
        const existing = state.moduleAssignments.get(entityId) || {
          explicit: [],
          autoIncluded: [],
        }

        // Only add if not already explicitly assigned
        if (!existing.explicit.includes(moduleId)) {
          existing.explicit = [...existing.explicit, moduleId]
          // Remove from autoIncluded if it was there
          existing.autoIncluded = existing.autoIncluded.filter((id: string) => id !== moduleId)
          state.moduleAssignments.set(entityId, existing)
          state.hasUnsavedChanges = true
        }
      })
    },

    removeFromModule: (entityId, moduleId, dependentChildren) => {
      set((state) => {
        const existing = state.moduleAssignments.get(entityId)
        if (!existing) return

        // If has children depending on it, convert to autoIncluded instead
        if (dependentChildren && dependentChildren.length > 0) {
          existing.explicit = existing.explicit.filter((id: string) => id !== moduleId)
          if (!existing.autoIncluded.includes(moduleId)) {
            existing.autoIncluded = [...existing.autoIncluded, moduleId]
          }
        } else {
          // Remove completely
          existing.explicit = existing.explicit.filter((id: string) => id !== moduleId)
          existing.autoIncluded = existing.autoIncluded.filter((id: string) => id !== moduleId)
        }

        state.moduleAssignments.set(entityId, existing)
        state.hasUnsavedChanges = true
      })
    },

    bulkAssignToModule: (entityIds, moduleId) => {
      set((state) => {
        for (const entityId of entityIds) {
          const existing = state.moduleAssignments.get(entityId) || {
            explicit: [],
            autoIncluded: [],
          }

          if (!existing.explicit.includes(moduleId)) {
            existing.explicit = [...existing.explicit, moduleId]
            existing.autoIncluded = existing.autoIncluded.filter((id: string) => id !== moduleId)
            state.moduleAssignments.set(entityId, existing)
          }
        }
        state.hasUnsavedChanges = true
      })
    },

    updateProfileModules: (profileId, moduleIds) => {
      set((state) => {
        state.profileEdits.set(profileId, moduleIds)
        state.hasUnsavedChanges = true
      })
    },

    addNewModule: (module) => {
      set((state) => {
        // Check if module_id already exists
        const exists = state.newModules.some((m: NewModule) => m.module_id === module.module_id)
        if (!exists) {
          state.newModules.push(module)
          state.hasUnsavedChanges = true
        }
      })
    },

    addNewProfile: (profile) => {
      set((state) => {
        // Check if profile_id already exists
        const exists = state.newProfiles.some((p: ProfileDefinition) => p.profile_id === profile.profile_id)
        if (!exists) {
          state.newProfiles.push(profile)
          state.hasUnsavedChanges = true
        }
      })
    },

    computeAutoIncludes: (modules) => {
      set((state) => {
        // Build dependency map
        const depMap = new Map<string, string[]>()
        for (const mod of modules) {
          depMap.set(mod.module_id, mod.dependencies)
        }

        // For each entity with assignments, compute auto-includes
        for (const [entityId, assignments] of state.moduleAssignments) {
          const allRequired = new Set<string>()

          // For each explicitly assigned module, find all its dependencies
          for (const moduleId of assignments.explicit) {
            const deps = depMap.get(moduleId) || []
            for (const dep of deps) {
              if (!assignments.explicit.includes(dep)) {
                allRequired.add(dep)
              }
            }
          }

          assignments.autoIncluded = Array.from(allRequired)
          state.moduleAssignments.set(entityId, assignments)
        }
      })
    },

    getEffectiveModules: (entityId, entityType, parentCategories) => {
      const state = get()

      // For properties/subobjects, look up via parent categories
      if (entityType !== 'category' && parentCategories) {
        const inherited = new Set<string>()
        for (const catId of parentCategories) {
          const catAssignments = state.moduleAssignments.get(catId)
          if (catAssignments) {
            for (const modId of catAssignments.explicit) {
              inherited.add(modId)
            }
            for (const modId of catAssignments.autoIncluded) {
              inherited.add(modId)
            }
          }
        }
        return Array.from(inherited)
      }

      // For categories, return combined explicit + autoIncluded
      const assignments = state.moduleAssignments.get(entityId)
      if (!assignments) return []

      return [...assignments.explicit, ...assignments.autoIncluded]
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
