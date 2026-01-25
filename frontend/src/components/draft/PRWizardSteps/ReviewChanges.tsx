import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { DraftChangeV2, ValidationReportV2 } from '@/api/draftApiV2'

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
  const createCount = changes.filter((c) => c.change_type === 'CREATE').length
  const updateCount = changes.filter((c) => c.change_type === 'UPDATE').length
  const deleteCount = changes.filter((c) => c.change_type === 'DELETE').length

  // Determine validation status badge
  const validationBadge = validationReport.is_valid ? (
    <Badge className="bg-green-100 text-green-800">Valid</Badge>
  ) : (
    <Badge className="bg-red-100 text-red-800">
      {validationReport.errors.length} Error{validationReport.errors.length !== 1 ? 's' : ''}
    </Badge>
  )

  // Get semver badge styling
  const semverBadgeClass =
    validationReport.suggested_semver === 'major'
      ? 'bg-red-100 text-red-800'
      : validationReport.suggested_semver === 'minor'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-blue-100 text-blue-800'

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
        <div className="border rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Schema Validation:</span>
            {validationBadge}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Suggested Version Bump:</span>
            <Badge className={semverBadgeClass}>
              {validationReport.suggested_semver}
            </Badge>
          </div>
        </div>
      </div>

      {/* Semver reasons */}
      {validationReport.semver_reasons.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-sm">Version Bump Reasons:</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {validationReport.semver_reasons.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
