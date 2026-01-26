import { useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { ValidationReportV2, ValidationResultV2 } from '@/api/drafts'

interface ValidationSummaryProps {
  report: ValidationReportV2
  onEntityClick?: (entityType: string, entityKey: string) => void
}

interface ValidationItemProps {
  result: ValidationResultV2
  onEntityClick?: (entityType: string, entityKey: string) => void
}

/**
 * Single validation result item.
 * Shows entity type + key (clickable if handler provided), code badge, message, and optional field path.
 */
function ValidationItem({ result, onEntityClick }: ValidationItemProps) {
  const SeverityIcon =
    result.severity === 'error'
      ? XCircle
      : result.severity === 'warning'
      ? AlertTriangle
      : Info

  const iconColor =
    result.severity === 'error'
      ? 'text-red-600'
      : result.severity === 'warning'
      ? 'text-amber-600'
      : 'text-blue-600'

  return (
    <div className="flex items-start gap-2 text-sm py-1">
      {/* Severity icon */}
      <SeverityIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${iconColor}`} />

      {/* Entity type + key */}
      <div className="flex-1">
        {onEntityClick ? (
          <button
            onClick={() => onEntityClick(result.entity_type, result.entity_key)}
            className="font-semibold hover:underline text-left"
          >
            {result.entity_type}: {result.entity_key}
          </button>
        ) : (
          <span className="font-semibold">
            {result.entity_type}: {result.entity_key}
          </span>
        )}

        {/* Code badge */}
        <Badge variant="outline" className="ml-2 font-mono text-xs">
          {result.code}
        </Badge>

        {/* Message */}
        <div className="mt-1">{result.message}</div>

        {/* Optional field path */}
        {result.field && (
          <div className="text-xs text-muted-foreground mt-0.5">
            Field: {result.field}
          </div>
        )}
      </div>
    </div>
  )
}

interface ValidationSectionProps {
  title: string
  items: ValidationResultV2[]
  icon: typeof XCircle
  iconClassName: string
  onEntityClick?: (entityType: string, entityKey: string) => void
  defaultOpen?: boolean
}

/**
 * Collapsible section for validation results of a specific severity.
 */
function ValidationSection({
  title,
  items,
  icon: Icon,
  iconClassName,
  onEntityClick,
  defaultOpen = false,
}: ValidationSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  if (items.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-2 h-auto">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${iconClassName}`} />
            <span className="font-medium">{title}</span>
            <Badge variant="secondary" className="ml-1">
              {items.length}
            </Badge>
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pb-2">
        <div className="space-y-1">
          {items.map((item, i) => (
            <ValidationItem
              key={`${item.entity_key}-${item.code}-${i}`}
              result={item}
              onEntityClick={onEntityClick}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * v2 validation results display component.
 * Shows structured display of errors, warnings, and info with semver suggestion.
 */
export function ValidationSummary({ report, onEntityClick }: ValidationSummaryProps) {
  const StatusIcon = report.is_valid ? CheckCircle : XCircle
  const statusColor = report.is_valid ? 'text-green-600' : 'text-red-600'
  const statusText = report.is_valid ? 'Validation passed' : 'Validation failed'

  const totalIssues = report.errors.length + report.warnings.length + report.info.length

  // Semver badge color
  const semverColor =
    report.suggested_semver === 'major'
      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      : report.suggested_semver === 'minor'
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'

  return (
    <div className="space-y-3">
      {/* Header with pass/fail indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-5 w-5 ${statusColor}`} />
          <span className="font-semibold">{statusText}</span>
        </div>
        <Badge className={semverColor}>
          Suggested: {report.suggested_semver.toUpperCase()}
        </Badge>
      </div>

      {/* Summary stats */}
      {totalIssues > 0 && (
        <div className="flex items-center gap-3 text-sm">
          {report.errors.length > 0 && (
            <span className="text-red-600 font-medium">
              {report.errors.length} error{report.errors.length !== 1 ? 's' : ''}
            </span>
          )}
          {report.warnings.length > 0 && (
            <span className="text-amber-600 font-medium">
              {report.warnings.length} warning{report.warnings.length !== 1 ? 's' : ''}
            </span>
          )}
          {report.info.length > 0 && (
            <span className="text-blue-600 font-medium">
              {report.info.length} info
            </span>
          )}
        </div>
      )}

      {/* Errors section */}
      <ValidationSection
        title="Errors"
        items={report.errors}
        icon={XCircle}
        iconClassName="text-red-600"
        onEntityClick={onEntityClick}
        defaultOpen={report.errors.length > 0}
      />

      {/* Warnings section */}
      <ValidationSection
        title="Warnings"
        items={report.warnings}
        icon={AlertTriangle}
        iconClassName="text-amber-600"
        onEntityClick={onEntityClick}
        defaultOpen={report.warnings.length > 0 && report.errors.length === 0}
      />

      {/* Info section */}
      <ValidationSection
        title="Info"
        items={report.info}
        icon={Info}
        iconClassName="text-blue-600"
        onEntityClick={onEntityClick}
      />

      {/* Semver reasoning */}
      {report.semver_reasons.length > 0 && (
        <div className="text-sm text-muted-foreground border-t pt-3 mt-3">
          <span className="font-medium">Semver reasoning:</span>
          <ul className="ml-4 mt-1 list-disc">
            {report.semver_reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
