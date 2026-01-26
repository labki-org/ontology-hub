import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface EditDetailsProps {
  prTitle: string
  userComment: string
  onUserCommentChange: (comment: string) => void
  onNext: () => void
  onBack: () => void
}

export function EditDetails({
  prTitle,
  userComment,
  onUserCommentChange,
  onNext,
  onBack,
}: EditDetailsProps) {
  return (
    <div className="space-y-6">
      {/* PR Title (auto-generated, read-only) */}
      <div className="space-y-2">
        <Label>Pull Request Title</Label>
        <div className="px-3 py-2 border rounded-md bg-muted/50 text-sm">
          {prTitle}
        </div>
        <p className="text-xs text-muted-foreground">
          Auto-generated based on your changes
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
        <Button onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  )
}
