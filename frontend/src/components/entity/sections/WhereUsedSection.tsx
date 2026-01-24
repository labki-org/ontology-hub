import { Badge } from '@/components/ui/badge'
import { useDetailStore } from '@/stores/detailStore'
import { AccordionSection } from './AccordionSection'

interface WhereUsedItem {
  entityKey: string
  entityType: string
  label?: string
}

interface WhereUsedSectionProps {
  items: WhereUsedItem[]
  title?: string
}

/**
 * Shows entities that reference this entity.
 * E.g., for a property: which categories use it.
 * E.g., for a subobject: which categories/properties reference it.
 */
export function WhereUsedSection({
  items,
  title = 'Used By',
}: WhereUsedSectionProps) {
  const openDetail = useDetailStore((s) => s.openDetail)

  if (items.length === 0) {
    return (
      <AccordionSection id="where-used" title={title} count={0} defaultOpen={false}>
        <p className="text-sm text-muted-foreground italic">Not used by any entities</p>
      </AccordionSection>
    )
  }

  // Group items by entity type
  const grouped = items.reduce(
    (acc, item) => {
      const type = item.entityType
      if (!acc[type]) acc[type] = []
      acc[type].push(item)
      return acc
    },
    {} as Record<string, WhereUsedItem[]>
  )

  const typeLabels: Record<string, string> = {
    category: 'Categories',
    property: 'Properties',
    subobject: 'Subobjects',
    module: 'Modules',
    bundle: 'Bundles',
    template: 'Templates',
  }

  return (
    <AccordionSection id="where-used" title={title} count={items.length}>
      <div className="space-y-4">
        {Object.entries(grouped).map(([type, typeItems]) => (
          <div key={type}>
            <h4 className="text-sm font-medium mb-2">{typeLabels[type] || type}</h4>
            <div className="flex flex-wrap gap-2">
              {typeItems.map((item) => (
                <Badge
                  key={item.entityKey}
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => openDetail(item.entityKey, item.entityType)}
                >
                  {item.label || item.entityKey}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AccordionSection>
  )
}
