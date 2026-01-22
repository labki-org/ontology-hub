import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ValidationResult } from '@/api/types'

interface ValidationBadgeProps {
  result: ValidationResult
  compact?: boolean
}

const severityConfig = {
  error: {
    icon: AlertCircle,
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800',
  },
  warning: {
    icon: AlertTriangle,
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
  },
  info: {
    icon: Info,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800',
  },
}

export function ValidationBadge({ result, compact = false }: ValidationBadgeProps) {
  const config = severityConfig[result.severity]
  const Icon = config.icon

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${config.className} gap-1 cursor-help text-xs`}
          >
            <Icon className="h-3 w-3" />
            {!compact && (
              <>
                {result.code}
                {result.suggested_semver && (
                  <span className="opacity-75">({result.suggested_semver})</span>
                )}
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-medium">{result.code}</p>
          <p className="text-sm">{result.message}</p>
          {result.old_value && result.new_value && (
            <p className="text-xs mt-1 opacity-75">
              {result.old_value} -&gt; {result.new_value}
            </p>
          )}
          {result.suggested_semver && (
            <p className="text-xs mt-1">
              Semver impact: <span className="font-medium">{result.suggested_semver}</span>
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface ValidationBadgesProps {
  results: ValidationResult[]
  compact?: boolean
}

export function ValidationBadges({ results, compact = false }: ValidationBadgesProps) {
  if (results.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1">
      {results.map((result, i) => (
        <ValidationBadge
          key={`${result.entity_id}-${result.code}-${i}`}
          result={result}
          compact={compact}
        />
      ))}
    </div>
  )
}
