import { GitPullRequest, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface OpenPRButtonProps {
  draftToken: string
  isValid: boolean
  hasUnsavedChanges: boolean
}

export function OpenPRButton({
  draftToken,
  isValid,
  hasUnsavedChanges,
}: OpenPRButtonProps) {
  const isDisabled = !isValid || hasUnsavedChanges

  const getTooltipText = () => {
    if (hasUnsavedChanges) {
      return 'Please save your changes before opening a pull request'
    }
    if (!isValid) {
      return 'Draft contains validation errors. Please fix them before opening a pull request'
    }
    return 'Create a GitHub pull request from this draft'
  }

  const handleClick = () => {
    if (isDisabled) return

    // Redirect to backend OAuth endpoint using current origin (works in both dev and production)
    window.location.href = `${window.location.origin}/api/v1/oauth/github/login?draft_token=${draftToken}`
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Button
              onClick={handleClick}
              disabled={isDisabled}
              className="gap-2"
              size="lg"
            >
              <GitPullRequest className="h-5 w-5" />
              Open Pull Request
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="flex items-start gap-2">
            {isDisabled && <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
            <p>{getTooltipText()}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
