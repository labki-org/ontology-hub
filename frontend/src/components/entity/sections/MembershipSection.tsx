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
      <AccordionSection id="membership" title="Membership" defaultOpen={false}>
        <p className="text-xs text-muted-foreground/60">
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
          <div className="space-y-1.5">
            <h4 className="text-sm font-semibold text-foreground/70">Modules</h4>
            <div className="pl-2 flex flex-wrap gap-1.5">
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
          <div className="space-y-1.5">
            <h4 className="text-sm font-semibold text-foreground/70">Bundles</h4>
            <div className="pl-2 flex flex-wrap gap-1.5">
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
