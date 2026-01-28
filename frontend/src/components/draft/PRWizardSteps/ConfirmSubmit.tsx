import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface ConfirmSubmitProps {
  draftToken: string
  prTitle: string
  userComment: string
  suggestedSemver?: string
  onBack: () => void
  onSuccess: (prUrl: string) => void
  onError: (error: string) => void
}

export function ConfirmSubmit({
  draftToken,
  prTitle,
  userComment,
  suggestedSemver,
  onBack,
}: ConfirmSubmitProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = () => {
    if (isSubmitting) return // Prevent double-click
    setIsSubmitting(true)

    // Redirect to OAuth login with draft parameters
    const params = new URLSearchParams({
      draft_token: draftToken,
      pr_title: prTitle,
      user_comment: userComment,
    })
    if (suggestedSemver) {
      params.set('suggested_semver', suggestedSemver)
    }

    // Redirect to GitHub OAuth login endpoint using current origin
    // Backend will handle PR creation in the OAuth callback
    window.location.href = `${window.location.origin}/api/v1/oauth/github/login?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      {/* Pre-submit information */}
      <div className="space-y-4">
        {isSubmitting ? (
          <div className="border rounded-md p-4 bg-amber-50 dark:bg-amber-950">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div>
                <p className="font-medium">Redirecting to GitHub...</p>
                <p className="text-sm text-muted-foreground">
                  You'll authorize the Ontology Hub to create a pull request on your behalf.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="border rounded-md p-4 bg-blue-50 dark:bg-blue-950">
            <h3 className="font-medium mb-2">GitHub Authorization Required</h3>
            <p className="text-sm text-muted-foreground">
              You will be redirected to GitHub to authorize this application. After
              authorization, your pull request will be created automatically.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="font-medium text-sm">Pull Request Details:</h3>
          <div className="border rounded-md p-3 space-y-2">
            <div>
              <div className="text-xs text-muted-foreground">Title</div>
              <div className="text-sm font-medium">{prTitle}</div>
            </div>
            {userComment && (
              <div>
                <div className="text-xs text-muted-foreground">Comments</div>
                <div className="text-sm whitespace-pre-wrap">{userComment}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Redirecting to GitHub...
            </>
          ) : (
            'Submit Pull Request'
          )}
        </Button>
      </div>
    </div>
  )
}
