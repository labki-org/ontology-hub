import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface EditDetailsProps {
  prTitle: string
  userComment: string
  onPrTitleChange: (title: string) => void
  onUserCommentChange: (comment: string) => void
  onNext: () => void
  onBack: () => void
}

export function EditDetails({
  prTitle,
  userComment,
  onPrTitleChange,
  onUserCommentChange,
  onNext,
  onBack,
}: EditDetailsProps) {
  const canProceed = prTitle.trim().length > 0

  return (
    <div className="space-y-6">
      {/* PR Title */}
      <div className="space-y-2">
        <Label htmlFor="pr-title">Pull Request Title</Label>
        <Input
          id="pr-title"
          value={prTitle}
          onChange={(e) => onPrTitleChange(e.target.value)}
          placeholder="Enter a descriptive title for your pull request"
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          This will be the title of the GitHub pull request
        </p>
      </div>

      {/* User Comment */}
      <div className="space-y-2">
        <Label htmlFor="user-comment">Additional Comments (Optional)</Label>
        <Textarea
          id="user-comment"
          value={userComment}
          onChange={(e) => onUserCommentChange(e.target.value)}
          placeholder="Add any context or notes for reviewers..."
          rows={5}
          className="w-full resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Your comments will be included in the PR description
        </p>
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Next
        </Button>
      </div>
    </div>
  )
}
