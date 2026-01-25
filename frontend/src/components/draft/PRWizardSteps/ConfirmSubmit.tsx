import { Button } from '@/components/ui/button'

interface ConfirmSubmitProps {
  draftToken: string
  prTitle: string
  userComment: string
  onBack: () => void
  onSuccess: (prUrl: string) => void
  onError: (error: string) => void
}

export function ConfirmSubmit({
  draftToken,
  prTitle,
  userComment,
  onBack,
}: ConfirmSubmitProps) {
  const handleSubmit = () => {
    // Redirect to OAuth login with draft parameters
    const params = new URLSearchParams({
      draft_token: draftToken,
      pr_title: prTitle,
      user_comment: userComment,
    })

    // Redirect to GitHub OAuth login endpoint
    // Backend will handle PR creation in the OAuth callback
    window.location.href = `/api/oauth/github/login?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      {/* Pre-submit information */}
      <div className="space-y-4">
        <div className="border rounded-md p-4 bg-blue-50 dark:bg-blue-950">
          <h3 className="font-medium mb-2">GitHub Authorization Required</h3>
          <p className="text-sm text-muted-foreground">
            You will be redirected to GitHub to authorize this application. After
            authorization, your pull request will be created automatically.
          </p>
        </div>

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
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleSubmit}>Submit Pull Request</Button>
      </div>
    </div>
  )
}
