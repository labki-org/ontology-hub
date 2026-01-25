import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { DraftChangeV2, ValidationReportV2 } from '@/api/draftApiV2'
import { ReviewChanges } from './PRWizardSteps/ReviewChanges'
import { EditDetails } from './PRWizardSteps/EditDetails'
import { ConfirmSubmit } from './PRWizardSteps/ConfirmSubmit'

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

  // Auto-generate PR title on mount
  useEffect(() => {
    if (open && !prTitle) {
      const changeCount = changes.length
      setPrTitle(`Schema update: ${changeCount} change${changeCount !== 1 ? 's' : ''}`)
    }
  }, [open, changes.length, prTitle])

  // Check for pr_url in URL params (set by OAuth callback redirect)
  useEffect(() => {
    if (open) {
      const params = new URLSearchParams(window.location.search)
      const prUrl = params.get('pr_url')
      if (prUrl) {
        setSubmittedPrUrl(prUrl)
        setStep('success')
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname)
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
    setPrTitle(`Schema update: ${changes.length} change${changes.length !== 1 ? 's' : ''}`)
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
            onPrTitleChange={setPrTitle}
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
