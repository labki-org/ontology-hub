import { useNavigate } from 'react-router-dom'
import { X, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { DraftPublic } from '@/api/types'

interface DraftBannerProps {
  draft: DraftPublic
  onValidate?: () => void
  onSubmit?: () => void
  onExit: () => void
}

/**
 * Persistent top banner when in draft mode.
 * Shows draft info, status, and action buttons.
 */
export function DraftBanner({ draft, onValidate, onSubmit, onExit }: DraftBannerProps) {
  const navigate = useNavigate()

  const isValidated = draft.status === 'validated'
  const isSubmitted = draft.status === 'submitted'
  const isExpired = draft.status === 'expired'

  const handleExit = () => {
    onExit()
    // Remove draft_id from URL
    navigate('/', { replace: true })
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600" />
        <div className="flex items-center gap-2">
          <span className="font-medium text-amber-900">
            Draft: {draft.payload.wiki_url || draft.id}
          </span>
          <Badge
            variant={
              isValidated
                ? 'default'
                : isSubmitted
                ? 'secondary'
                : isExpired
                ? 'destructive'
                : 'outline'
            }
            className={
              isValidated
                ? 'bg-green-500 hover:bg-green-600 border-green-600 text-white'
                : isSubmitted
                ? 'bg-blue-500 hover:bg-blue-600 border-blue-600 text-white'
                : ''
            }
          >
            {draft.status.toUpperCase()}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onValidate && !isValidated && !isSubmitted && !isExpired && (
          <Button variant="outline" size="sm" onClick={onValidate}>
            <CheckCircle className="h-4 w-4" />
            Validate
          </Button>
        )}
        {onSubmit && (
          <Button
            variant="default"
            size="sm"
            onClick={onSubmit}
            disabled={!isValidated}
            title={isValidated ? 'Submit draft for review' : 'Draft must be validated first'}
          >
            Submit PR
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={handleExit} title="Exit draft mode">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
