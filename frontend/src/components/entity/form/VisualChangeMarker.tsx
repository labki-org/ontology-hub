import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type ChangeStatus = 'modified' | 'added' | 'deleted' | 'unchanged'

interface VisualChangeMarkerProps {
  children: React.ReactNode
  status: ChangeStatus
  originalValue?: string
  className?: string
}

/**
 * Wrapper that adds visual change indicators based on CONTEXT.md decisions:
 * - Modified: Background shading + left border accent, hover shows original
 * - Added: Green badge + full green border
 * - Deleted: Red overlay/styling + 'DELETED' badge
 * - Unchanged: No styling
 */
export function VisualChangeMarker({
  children,
  status,
  originalValue,
  className,
}: VisualChangeMarkerProps) {
  if (status === 'unchanged') {
    return <div className={className}>{children}</div>
  }

  const statusStyles = {
    modified: 'bg-yellow-50 border-l-4 border-l-yellow-500 pl-2',
    added: 'bg-green-50 border-2 border-green-500 rounded',
    deleted: 'bg-red-50 border-2 border-red-300 opacity-60',
  }

  const content = (
    <div className={cn(statusStyles[status], 'relative', className)}>
      {status === 'deleted' && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-1 rounded">
          DELETED
        </span>
      )}
      {status === 'added' && (
        <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-1 rounded">
          NEW
        </span>
      )}
      {children}
    </div>
  )

  // Show original value tooltip for modified fields
  if (status === 'modified' && originalValue !== undefined) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">
              <span className="text-muted-foreground">Original: </span>
              {originalValue || '(empty)'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return content
}
