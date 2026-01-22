import { AlertCircle, AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { DraftValidationReport, ValidationResult } from '@/api/types'

interface ValidationSummaryProps {
  report: DraftValidationReport
}

const semverColors: Record<string, string> = {
  major: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  minor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  patch: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
}

function ValidationResultItem({ result }: { result: ValidationResult }) {
  return (
    <li className="text-sm">
      <span className="font-mono text-xs bg-muted px-1 rounded">{result.entity_id}</span>
      {result.field && <span className="text-muted-foreground">.{result.field}</span>}
      <span className="ml-2">{result.message}</span>
      {result.old_value && result.new_value && (
        <span className="ml-2 text-xs text-muted-foreground">
          ({result.old_value} -&gt; {result.new_value})
        </span>
      )}
    </li>
  )
}

function ValidationSection({
  title,
  icon: Icon,
  iconClassName,
  items,
  defaultOpen = false,
}: {
  title: string
  icon: typeof AlertCircle
  iconClassName: string
  items: ValidationResult[]
  defaultOpen?: boolean
}) {
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
        <ul className="space-y-1 ml-6 list-disc">
          {items.map((item, i) => (
            <ValidationResultItem key={`${item.entity_id}-${item.code}-${i}`} result={item} />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function ValidationSummary({ report }: ValidationSummaryProps) {
  const StatusIcon = report.is_valid ? CheckCircle : AlertCircle
  const statusColor = report.is_valid ? 'text-green-600' : 'text-red-600'
  const statusText = report.is_valid ? 'Valid' : 'Has Errors'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${statusColor}`} />
            <span>Validation: {statusText}</span>
          </div>
          <Badge className={semverColors[report.suggested_semver]}>
            Suggested: {report.suggested_semver.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <ValidationSection
          title="Errors"
          icon={AlertCircle}
          iconClassName="text-red-600"
          items={report.errors}
          defaultOpen={report.errors.length > 0}
        />

        <ValidationSection
          title="Warnings"
          icon={AlertTriangle}
          iconClassName="text-yellow-600"
          items={report.warnings}
          defaultOpen={report.warnings.length > 0 && report.errors.length === 0}
        />

        <ValidationSection
          title="Info"
          icon={Info}
          iconClassName="text-blue-600"
          items={report.info}
        />

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
      </CardContent>
    </Card>
  )
}
