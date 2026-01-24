import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'

interface AccordionSectionProps {
  id: string
  title: string
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
}

/**
 * Collapsible accordion section for organizing entity details.
 * Per CONTEXT.md: sections reset to default state on navigation.
 */
export function AccordionSection({
  id,
  title,
  count,
  defaultOpen = true,
  children,
}: AccordionSectionProps) {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen ? id : undefined}
    >
      <AccordionItem value={id}>
        <AccordionTrigger className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          <span className="flex items-center gap-2">
            {title}
            {count !== undefined && (
              <Badge variant="secondary" className="text-xs">
                {count}
              </Badge>
            )}
          </span>
        </AccordionTrigger>
        <AccordionContent>{children}</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
