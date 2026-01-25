import { create } from 'zustand'
import type { ValidationReportV2 } from '@/api/draftApiV2'

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
 */
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

  // Actions
  setDraftToken: (token: string | null) => void
  setValidationReport: (report: ValidationReportV2 | null) => void
  setIsValidating: (validating: boolean) => void
  setIsSubmitting: (submitting: boolean) => void
  setPrWizardOpen: (open: boolean) => void
  setSubmittedPrUrl: (url: string | null) => void
  clearValidation: () => void
  reset: () => void
}

const initialState = {
  draftToken: null,
  validationReport: null,
  isValidating: false,
  isSubmitting: false,
  prWizardOpen: false,
  submittedPrUrl: null,
}

export const useDraftStoreV2 = create<DraftStoreV2State>((set) => ({
  ...initialState,

  setDraftToken: (token) => {
    set({ draftToken: token })
  },

  setValidationReport: (report) => {
    set({ validationReport: report })
  },

  setIsValidating: (validating) => {
    set({ isValidating: validating })
  },

  setIsSubmitting: (submitting) => {
    set({ isSubmitting: submitting })
  },

  setPrWizardOpen: (open) => {
    set({ prWizardOpen: open })
  },

  setSubmittedPrUrl: (url) => {
    set({ submittedPrUrl: url })
  },

  clearValidation: () => {
    set({
      validationReport: null,
      isValidating: false,
    })
  },

  reset: () => {
    set(initialState)
  },
}))
