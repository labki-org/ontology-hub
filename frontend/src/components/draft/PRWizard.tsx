import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { DraftChangeV2, ValidationReportV2 } from '@/api/drafts'
import { ReviewChanges } from './PRWizardSteps/ReviewChanges'
import { EditDetails } from './PRWizardSteps/EditDetails'
import { ConfirmSubmit } from './PRWizardSteps/ConfirmSubmit'

/**
 * Generate an informative PR title based on the draft changes.
 * Examples:
 * - "Add category: Lab_member"
 * - "Update property: Has_email"
 * - "Add 2 categories, update 1 property"
 * - "Schema changes: 3 additions, 2 updates, 1 deletion"
 */
function generatePrTitle(changes: DraftChangeV2[]): string {
  if (changes.length === 0) {
    return 'Schema update (no changes)'
  }

  // Count changes by type
  const creates = changes.filter((c) => c.change_type === 'create')
  const updates = changes.filter((c) => c.change_type === 'update')
  const deletes = changes.filter((c) => c.change_type === 'delete')

  // For a single change, be specific
  if (changes.length === 1) {
    const change = changes[0]
    const action =
      change.change_type === 'create'
        ? 'Add'
        : change.change_type === 'update'
          ? 'Update'
          : 'Delete'
    return `${action} ${change.entity_type}: ${change.entity_key}`
  }

  // For 2-3 changes of the same type, list them
  if (changes.length <= 3 && (creates.length === changes.length || updates.length === changes.length || deletes.length === changes.length)) {
    const action =
      creates.length === changes.length
        ? 'Add'
        : updates.length === changes.length
          ? 'Update'
          : 'Delete'
    const entityType = changes[0].entity_type
    const allSameType = changes.every((c) => c.entity_type === entityType)

    if (allSameType) {
      const keys = changes.map((c) => c.entity_key).join(', ')
      const plural = changes.length > 1 ? 'ies' : 'y'
      const typeLabel = entityType === 'category' ? `categor${plural}` : `${entityType}s`
      return `${action} ${typeLabel}: ${keys}`
    }
  }

  // For mixed changes, summarize by action
  const parts: string[] = []
  if (creates.length > 0) {
    parts.push(`${creates.length} addition${creates.length !== 1 ? 's' : ''}`)
  }
  if (updates.length > 0) {
    parts.push(`${updates.length} update${updates.length !== 1 ? 's' : ''}`)
  }
  if (deletes.length > 0) {
    parts.push(`${deletes.length} deletion${deletes.length !== 1 ? 's' : ''}`)
  }

  return `Schema changes: ${parts.join(', ')}`
}

interface PRWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draftToken: string
  changes: DraftChangeV2[]
  validationReport: ValidationReportV2
}

type Step = 'review' | 'details' | 'confirm' | 'success'

export function PRWizard({
  open,
  onOpenChange,
  draftToken,
  changes,
  validationReport,
}: PRWizardProps) {
  const [step, setStep] = useState<Step>('review')
  const [prTitle, setPrTitle] = useState('')
  const [userComment, setUserComment] = useState('')
  const [submittedPrUrl, setSubmittedPrUrl] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Auto-generate informative PR title based on changes
  useEffect(() => {
    if (open && !prTitle) {
      setPrTitle(generatePrTitle(changes))
    }
  }, [open, changes, prTitle])

  // Check for pr_url in URL params (set by OAuth callback redirect)
  useEffect(() => {
    if (open) {
      const params = new URLSearchParams(window.location.search)
      const prUrl = params.get('pr_url')
      if (prUrl) {
        setSubmittedPrUrl(prUrl)
        setStep('success')
        // Clean up URL, preserving draft_token and other params
        params.delete('pr_url')
        const newUrl = params.toString()
          ? `${window.location.pathname}?${params.toString()}`
          : window.location.pathname
        window.history.replaceState({}, '', newUrl)
      }
    }
  }, [open])

  const handleSuccess = (prUrl: string) => {
    setSubmittedPrUrl(prUrl)
    setStep('success')
  }

  const handleError = (error: string) => {
    setSubmitError(error)
  }

  const resetWizard = () => {
    setStep('review')
    setPrTitle(generatePrTitle(changes))
    setUserComment('')
    setSubmittedPrUrl(null)
    setSubmitError(null)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetWizard()
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'review' && 'Review Changes'}
            {step === 'details' && 'Edit PR Details'}
            {step === 'confirm' && 'Submit Pull Request'}
            {step === 'success' && 'Pull Request Submitted'}
          </DialogTitle>
        </DialogHeader>

        {/* Step progress indicator */}
        <div className="flex items-center gap-2 pb-4 border-b">
          <div
            className={`flex-1 h-2 rounded ${
              step === 'review' || step === 'details' || step === 'confirm' || step === 'success'
                ? 'bg-primary'
                : 'bg-muted'
            }`}
          />
          <div
            className={`flex-1 h-2 rounded ${
              step === 'details' || step === 'confirm' || step === 'success'
                ? 'bg-primary'
                : 'bg-muted'
            }`}
          />
          <div
            className={`flex-1 h-2 rounded ${
              step === 'confirm' || step === 'success' ? 'bg-primary' : 'bg-muted'
            }`}
          />
        </div>

        {/* Step content */}
        {step === 'review' && (
          <ReviewChanges
            changes={changes}
            validationReport={validationReport}
            onNext={() => setStep('details')}
          />
        )}

        {step === 'details' && (
          <EditDetails
            prTitle={prTitle}
            userComment={userComment}
            onUserCommentChange={setUserComment}
            onNext={() => setStep('confirm')}
            onBack={() => setStep('review')}
          />
        )}

        {step === 'confirm' && (
          <ConfirmSubmit
            draftToken={draftToken}
            prTitle={prTitle}
            userComment={userComment}
            suggestedSemver={validationReport.suggested_semver}
            onBack={() => setStep('details')}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        )}

        {step === 'success' && (
          <div className="space-y-4">
            <div className="text-center py-8">
              <div className="text-green-600 dark:text-green-400 text-4xl mb-4">✓</div>
              <p className="text-lg font-medium mb-2">Pull Request Created Successfully</p>
              {submittedPrUrl && (
                <a
                  href={submittedPrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View Pull Request
                </a>
              )}
            </div>
          </div>
        )}

        {submitError && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded text-sm">
            {submitError}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
