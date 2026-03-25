import { cn } from '@/lib/utils'

interface SubsectionHeaderProps {
  children: React.ReactNode
  className?: string
}

/**
 * Consistent subsection header for detail panel content.
 * Used for labels like "Required", "Optional", "Inherited", "Modules", etc.
 *
 * Type scale: text-sm / font-semibold / text-foreground-70 (14px, 600)
 */
export function SubsectionHeader({ children, className }: SubsectionHeaderProps) {
  return (
    <h4 className={cn('text-sm font-semibold text-foreground/70', className)}>
      {children}
    </h4>
  )
}
