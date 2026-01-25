import { CheckCircle, GitPullRequest, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { DraftV2 } from '@/api/draftApiV2'

interface FloatingActionBarProps {
  draft: DraftV2
  onValidate: () => void
  onSubmitPR: () => void
  isValidating?: boolean
}

/**
 * Floating action bar that provides sticky access to validation and PR submission.
 * Positioned at bottom center of the screen.
 * Only renders when draft context is active (draft prop is not null).
 */
export function FloatingActionBar({
  draft,
  onValidate,
  onSubmitPR,
  isValidating = false,
}: FloatingActionBarProps) {
  // DEBUG: Trace received props
  console.log('[FloatingActionBar] draft:', draft)
  console.log('[FloatingActionBar] draft.status:', draft?.status)
  console.log('[FloatingActionBar] isDraft:', draft?.status === 'DRAFT')

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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <Card className="shadow-lg px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Status badge */}
          {getStatusBadge(draft.status)}

          <div className="h-6 w-px bg-border" />

          {/* Validate button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onValidate}
            disabled={!isDraft || isValidating}
            title={isDraft ? 'Validate draft' : 'Only DRAFT status can be validated'}
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

          {/* Submit PR button */}
          <Button
            variant="default"
            size="sm"
            onClick={onSubmitPR}
            disabled={!isValidated}
            title={isValidated ? 'Submit PR' : 'Draft must be validated first'}
          >
            <GitPullRequest className="h-4 w-4 mr-1" />
            Submit PR
          </Button>
        </div>
      </Card>
    </div>
  )
}
