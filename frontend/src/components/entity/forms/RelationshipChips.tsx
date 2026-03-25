import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getEntityColors, type EntityType } from '@/lib/entityColors'

interface RelationshipChipsProps {
  /** Array of selected entity keys */
  values: string[]
  /** Callback when a chip is removed */
  onRemove: (value: string) => void
  /** Whether removal is disabled */
  disabled?: boolean
  /** Optional function to resolve display label from key */
  getLabel?: (key: string) => string
  /** Entity type for semantic chip coloring */
  colorHint?: EntityType
}

/**
 * Displays selected relationships as removable chips/badges.
 * When colorHint is provided, chips use semantic colors matching the entity type.
 */
export function RelationshipChips({
  values,
  onRemove,
  disabled,
  getLabel,
  colorHint,
}: RelationshipChipsProps) {
  if (values.length === 0) return null

  const colors = getEntityColors(colorHint)
  const hasSemanticColor = colorHint && colors.chipBg

  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <Badge
          key={value}
          variant={hasSemanticColor ? 'outline' : 'secondary'}
          className={cn(
            'flex items-center gap-1 pr-1',
            hasSemanticColor && `${colors.chipBg} ${colors.chipText} ${colors.chipBorder}`
          )}
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
