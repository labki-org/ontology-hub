import { Badge } from '@/components/ui/badge'
import { Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DeletedItemBadgeProps {
  /** The item's display name */
  label: string
  /** Callback to restore the item */
  onUndo: () => void
  /** Additional CSS classes */
  className?: string
}

/**
 * Visual indicator for soft-deleted items.
 *
 * Shows:
 * - Grayed out, strike-through text for the item label
 * - "Deleted" badge indicator
 * - Undo icon button for easy reversal
 *
 * Items marked for deletion stay in their original position
 * per CONTEXT.md - they are not moved to a separate section.
 */
export function DeletedItemBadge({
  label,
  onUndo,
  className,
}: DeletedItemBadgeProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 opacity-50',
        className
      )}
    >
      <span className="line-through text-muted-foreground text-sm">
        {label}
      </span>
      <Badge variant="secondary" className="text-xs">
        Deleted
      </Badge>
      <button
        type="button"
        onClick={(e) => {
          console.log('Undo button clicked for:', label)
          e.stopPropagation()
          e.preventDefault()
          onUndo()
        }}
        className="h-6 w-6 flex items-center justify-center rounded text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/30"
        aria-label="Undo deletion"
      >
        <Undo2 className="h-4 w-4" />
      </button>
    </div>
  )
}
