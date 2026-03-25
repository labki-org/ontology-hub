import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getEntityColors, type EntityType } from '@/lib/entityColors'

interface AccordionSectionProps {
  id: string
  title: React.ReactNode
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
  /** Entity type for semantic color tinting of the section card. */
  colorHint?: EntityType
}

/**
 * Collapsible accordion section for organizing entity details.
 * Renders as a tinted card with semantic coloring when colorHint is provided.
 * Per CONTEXT.md: sections reset to default state on navigation.
 */
export function AccordionSection({
  id,
  title,
  count,
  defaultOpen = true,
  children,
  colorHint,
}: AccordionSectionProps) {
  const colors = getEntityColors(colorHint)

  return (
    <div className={cn('rounded-lg border p-3 mt-6 first:mt-3', colors.sectionBg, colors.sectionBorder)}>
      <Accordion
        type="single"
        collapsible
        defaultValue={defaultOpen ? id : undefined}
      >
        <AccordionItem value={id} className="border-b-0">
          <AccordionTrigger className="py-0 text-sm font-bold text-foreground tracking-wide hover:no-underline">
            <span className="flex items-center gap-2">
              {title}
              {count !== undefined && count > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[1.25rem] justify-center font-normal tracking-normal opacity-50">
                  {count}
                </Badge>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-0">
            <div className="pt-2">{children}</div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
