import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface RelationshipChipsProps {
  /** Array of selected entity keys */
  values: string[]
  /** Callback when a chip is removed */
  onRemove: (value: string) => void
  /** Whether removal is disabled */
  disabled?: boolean
  /** Optional function to resolve display label from key */
  getLabel?: (key: string) => string
}

/**
 * Displays selected relationships as removable chips/badges.
 *
 * Features:
 * - X button to remove relationships (per CONTEXT: not hover trash icon)
 * - Optional label resolver for custom display
 * - Disabled state hides remove buttons
 *
 * @example
 * ```tsx
 * <RelationshipChips
 *   values={['parent-category-1', 'parent-category-2']}
 *   onRemove={(key) => removeParent(key)}
 *   getLabel={(key) => categoriesMap[key]?.label || key}
 * />
 * ```
 */
export function RelationshipChips({
  values,
  onRemove,
  disabled,
  getLabel,
}: RelationshipChipsProps) {
  if (values.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <Badge
          key={value}
          variant="secondary"
          className="flex items-center gap-1 pr-1"
        >
          <span>{getLabel ? getLabel(value) : value}</span>
          {!disabled && (
            <button
              type="button"
              onClick={() => onRemove(value)}
              className="ml-1 h-4 w-4 rounded-full hover:bg-muted flex items-center justify-center"
              aria-label={`Remove ${value}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
    </div>
  )
}
