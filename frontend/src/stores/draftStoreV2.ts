import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { enableMapSet } from 'immer'
import type { ValidationReportV2 } from '@/api/draftApiV2'
import type { GraphNode, GraphEdge } from '@/api/types'
import type { DependentEntity } from '@/lib/dependencyChecker'
import { computeAffectedEntities } from '@/lib/dependencyGraph'

// Enable Map and Set support in immer (required for Zustand immer middleware)
enableMapSet()

/**
 * Zustand store for v2 draft workflow state.
 *
 * This store holds ephemeral UI state for the draft validation and submission workflow.
 * Draft data itself is managed by TanStack Query (useDraftV2, useDraftChanges).
 *
 * State includes:
 * - Current draft token (for capability-based access)
 * - Validation report from last validation run
 * - Loading states for async operations
 * - PR wizard modal state
 * - Submitted PR URL for display
 * - Change tracking for direct edits and transitive effects
 */
/** Entity types that can be created */
export type CreateModalEntityType = 'category' | 'property' | 'subobject' | 'template' | 'module' | 'bundle'

interface DraftStoreV2State {
  // Draft context
  draftToken: string | null

  // Validation state
  validationReport: ValidationReportV2 | null
  isValidating: boolean

  // Submission state
  isSubmitting: boolean
  submittedPrUrl: string | null

  // UI state
  prWizardOpen: boolean

  // Create modal state
  createModalOpen: boolean
  createModalEntityType: CreateModalEntityType | null

  // Change tracking state
  directlyEditedEntities: Set<string>
  transitivelyAffectedEntities: Set<string>

  // Deletion tracking state
  // Maps entityKey -> changeId for undo capability
  deletedEntityChanges: Map<string, string>
  // Entity that cannot be deleted due to dependents
  deleteBlockedEntity: { key: string; label: string; dependents: DependentEntity[] } | null

  // Actions
  setDraftToken: (token: string | null) => void
  setValidationReport: (report: ValidationReportV2 | null) => void
  setIsValidating: (validating: boolean) => void
  setIsSubmitting: (submitting: boolean) => void
  setPrWizardOpen: (open: boolean) => void
  setSubmittedPrUrl: (url: string | null) => void
  clearValidation: () => void
  markEntityEdited: (entityKey: string, allNodes: GraphNode[], allEdges: GraphEdge[]) => void
  clearChangeTracking: () => void
  openCreateModal: (entityType: CreateModalEntityType) => void
  closeCreateModal: () => void
  trackDeletedEntity: (entityKey: string, changeId: string) => void
  untrackDeletedEntity: (entityKey: string) => void
  setDeleteBlocked: (entity: { key: string; label: string; dependents: DependentEntity[] } | null) => void
  reset: () => void
}

const initialState = {
  draftToken: null,
  validationReport: null,
  isValidating: false,
  isSubmitting: false,
  prWizardOpen: false,
  submittedPrUrl: null,
  createModalOpen: false,
  createModalEntityType: null as CreateModalEntityType | null,
  directlyEditedEntities: new Set<string>(),
  transitivelyAffectedEntities: new Set<string>(),
  deletedEntityChanges: new Map<string, string>(),
  deleteBlockedEntity: null as { key: string; label: string; dependents: DependentEntity[] } | null,
}

export const useDraftStoreV2 = create<DraftStoreV2State>()(
  immer((set) => ({
    ...initialState,

    setDraftToken: (token) => {
      set((state) => {
        state.draftToken = token
      })
    },

    setValidationReport: (report) => {
      set((state) => {
        state.validationReport = report
      })
    },

    setIsValidating: (validating) => {
      set((state) => {
        state.isValidating = validating
      })
    },

    setIsSubmitting: (submitting) => {
      set((state) => {
        state.isSubmitting = submitting
      })
    },

    setPrWizardOpen: (open) => {
      set((state) => {
        state.prWizardOpen = open
      })
    },

    setSubmittedPrUrl: (url) => {
      set((state) => {
        state.submittedPrUrl = url
      })
    },

    clearValidation: () => {
      set((state) => {
        state.validationReport = null
        state.isValidating = false
      })
    },

    markEntityEdited: (entityKey, allNodes, allEdges) => {
      set((state) => {
        // Add to directly edited set
        state.directlyEditedEntities.add(entityKey)

        // Compute transitive effects from all directly edited entities
        const allAffected = new Set<string>()
        for (const editedKey of state.directlyEditedEntities) {
          const affected = computeAffectedEntities(editedKey, allNodes, allEdges)
          for (const key of affected) {
            allAffected.add(key)
          }
        }

        // Remove direct edits from transitive set (direct wins)
        for (const directKey of state.directlyEditedEntities) {
          allAffected.delete(directKey)
        }

        state.transitivelyAffectedEntities = allAffected
      })
    },

    clearChangeTracking: () => {
      set((state) => {
        state.directlyEditedEntities = new Set<string>()
        state.transitivelyAffectedEntities = new Set<string>()
      })
    },

    openCreateModal: (entityType) => {
      set((state) => {
        state.createModalOpen = true
        state.createModalEntityType = entityType
      })
    },

    closeCreateModal: () => {
      set((state) => {
        state.createModalOpen = false
        state.createModalEntityType = null
      })
    },

    trackDeletedEntity: (entityKey, changeId) => {
      set((state) => {
        state.deletedEntityChanges.set(entityKey, changeId)
      })
    },

    untrackDeletedEntity: (entityKey) => {
      set((state) => {
        state.deletedEntityChanges.delete(entityKey)
      })
    },

    setDeleteBlocked: (entity) => {
      set((state) => {
        state.deleteBlockedEntity = entity
      })
    },

    reset: () => {
      set((state) => {
        state.draftToken = null
        state.validationReport = null
        state.isValidating = false
        state.isSubmitting = false
        state.prWizardOpen = false
        state.submittedPrUrl = null
        state.createModalOpen = false
        state.createModalEntityType = null
        state.directlyEditedEntities = new Set<string>()
        state.transitivelyAffectedEntities = new Set<string>()
        state.deletedEntityChanges = new Map<string, string>()
        state.deleteBlockedEntity = null
      })
    },
  }))
)
