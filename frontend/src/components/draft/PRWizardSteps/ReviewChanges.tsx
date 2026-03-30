import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { DraftChangeV2, ValidationReportV2 } from '@/api/drafts'

interface ReviewChangesProps {
  changes: DraftChangeV2[]
  validationReport: ValidationReportV2
  onNext: () => void
}

export function ReviewChanges({
  changes,
  validationReport,
  onNext,
}: ReviewChangesProps) {
  // Calculate change counts by type
  const createCount = changes.filter((c) => c.change_type === 'create').length
  const updateCount = changes.filter((c) => c.change_type === 'update').length
  const deleteCount = changes.filter((c) => c.change_type === 'delete').length

  // Determine validation status badge
  const validationBadge = validationReport.is_valid ? (
    <Badge className="bg-green-100 text-green-800">Valid</Badge>
  ) : (
    <Badge className="bg-red-100 text-red-800">
      {validationReport.errors.length} Error{validationReport.errors.length !== 1 ? 's' : ''}
    </Badge>
  )

  return (
    <div className="space-y-6">
      {/* Change summary */}
      <div className="space-y-3">
        <h3 className="font-medium">Change Summary</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="border rounded-md p-3">
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              +{createCount}
            </div>
            <div className="text-sm text-muted-foreground">Added</div>
          </div>
          <div className="border rounded-md p-3">
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              ~{updateCount}
            </div>
            <div className="text-sm text-muted-foreground">Modified</div>
          </div>
          <div className="border rounded-md p-3">
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">
              -{deleteCount}
            </div>
            <div className="text-sm text-muted-foreground">Deleted</div>
          </div>
        </div>
      </div>

      {/* Validation status */}
      <div className="space-y-3">
        <h3 className="font-medium">Validation Status</h3>
        <div className="border rounded-md p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Schema Validation:</span>
            {validationBadge}
          </div>
        </div>
      </div>

      {/* Warnings */}
      {validationReport.warnings.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-sm">Warnings:</h3>
          <div className="space-y-1">
            {validationReport.warnings.map((warning, idx) => (
              <div
                key={idx}
                className="text-sm p-2 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded"
              >
                {warning.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next button */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={onNext}>Next</Button>
      </div>
    </div>
  )
}
