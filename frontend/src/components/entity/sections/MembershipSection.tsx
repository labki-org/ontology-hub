import { Badge } from '@/components/ui/badge'
import { useGraphStore } from '@/stores/graphStore'
import { AccordionSection } from './AccordionSection'

interface MembershipSectionProps {
  modules?: string[]
  bundles?: string[]
}

/**
 * Shows which modules/bundles contain this entity.
 * Clicking a module/bundle navigates to its detail view.
 */
export function MembershipSection({ modules = [], bundles = [] }: MembershipSectionProps) {
  const setSelectedEntity = useGraphStore((s) => s.setSelectedEntity)

  const hasContent = modules.length > 0 || bundles.length > 0

  if (!hasContent) {
    return (
      <AccordionSection id="membership" title="Membership" count={0} defaultOpen={false}>
        <p className="text-sm text-muted-foreground italic">
          Not assigned to any modules or bundles
        </p>
      </AccordionSection>
    )
  }

  return (
    <AccordionSection
      id="membership"
      title="Membership"
      count={modules.length + bundles.length}
      defaultOpen={false}
    >
      <div className="space-y-4">
        {modules.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Modules</h4>
            <div className="flex flex-wrap gap-2">
              {modules.map((moduleKey) => (
                <Badge
                  key={moduleKey}
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => setSelectedEntity(moduleKey, 'module')}
                >
                  {moduleKey}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {bundles.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Bundles</h4>
            <div className="flex flex-wrap gap-2">
              {bundles.map((bundleKey) => (
                <Badge
                  key={bundleKey}
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => setSelectedEntity(bundleKey, 'bundle')}
                >
                  {bundleKey}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </AccordionSection>
  )
}
