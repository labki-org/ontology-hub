import { useState } from 'react'
import { AlertCircle, CheckCircle, GitPullRequest, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ValidationSummaryV2 } from './ValidationSummaryV2'
import type { DraftV2, ValidationReportV2 } from '@/api/draftApiV2'

interface DraftBannerV2Props {
  draft: DraftV2
  onValidate: () => void
  onSubmitPR: () => void
  onExit: () => void
  isValidating?: boolean
  validationReport?: ValidationReportV2 | null
}

/**
 * v2 draft banner with updated workflow status and validation integration.
 * Shows status (Draft -> Validated -> Submitted -> Merged), action buttons, and collapsible validation summary.
 */
export function DraftBannerV2({
  draft,
  onValidate,
  onSubmitPR,
  onExit,
  isValidating = false,
  validationReport,
}: DraftBannerV2Props) {
  const [isReportOpen, setIsReportOpen] = useState(false)

  // DEBUG: Trace received props
  console.log('[DraftBannerV2] draft:', draft)
  console.log('[DraftBannerV2] draft.status:', draft?.status)
  console.log('[DraftBannerV2] isDraft:', draft?.status === 'DRAFT')
  console.log('[DraftBannerV2] isValidated:', draft?.status === 'VALIDATED')

  // Status badge variant based on draft status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return (
          <Badge variant="outline" className="uppercase">
            {status}
          </Badge>
        )
      case 'validated':
        return (
          <Badge className="bg-green-500 hover:bg-green-600 border-green-600 text-white uppercase">
            {status}
          </Badge>
        )
      case 'submitted':
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600 border-blue-600 text-white uppercase">
            {status}
          </Badge>
        )
      case 'merged':
        return (
          <Badge className="bg-purple-500 hover:bg-purple-600 border-purple-600 text-white uppercase">
            {status}
          </Badge>
        )
      case 'rejected':
        return (
          <Badge className="bg-red-500 hover:bg-red-600 border-red-600 text-white uppercase">
            {status}
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const isDraft = draft.status === 'draft'
  const isValidated = draft.status === 'validated'

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      {/* Main banner bar */}
      <div className="px-4 py-2 flex items-center justify-between">
        {/* Left side: Icon + Title + Status */}
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <div className="flex items-center gap-2">
            <span className="font-medium text-amber-900">
              Draft: {draft.title || draft.id}
            </span>
            {getStatusBadge(draft.status)}
          </div>
        </div>

        {/* Right side: Action buttons */}
        <div className="flex items-center gap-2">
          {/* Validate button - only show when status is DRAFT */}
          {isDraft && (
            <Button
              variant="outline"
              size="sm"
              onClick={onValidate}
              disabled={isValidating}
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Validating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Validate
                </>
              )}
            </Button>
          )}

          {/* Submit PR button - enabled only when status is VALIDATED */}
          <Button
            variant="default"
            size="sm"
            onClick={onSubmitPR}
            disabled={!isValidated}
            title={isValidated ? 'Open PR submission wizard' : 'Draft must be validated first'}
          >
            <GitPullRequest className="h-4 w-4 mr-1" />
            Submit PR
          </Button>

          {/* Exit button */}
          <Button variant="ghost" size="sm" onClick={onExit} title="Exit draft mode">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Collapsible validation report */}
      {validationReport && (
        <Collapsible open={isReportOpen} onOpenChange={setIsReportOpen}>
          <div className="px-4 border-t border-amber-200">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2 h-auto text-amber-900 hover:bg-amber-100">
                <div className="flex items-center gap-2">
                  {validationReport.is_valid ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="font-medium">Validation passed</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="font-medium">
                        Validation failed ({validationReport.errors.length} errors)
                      </span>
                    </>
                  )}
                </div>
                {isReportOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pb-2">
              <ValidationSummaryV2 report={validationReport} />
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}
    </div>
  )
}
