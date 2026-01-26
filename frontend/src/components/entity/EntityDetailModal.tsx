import {
  Dialog,
  DialogContent,
  DialogHeader,
} from '@/components/ui/dialog'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useDetailStore } from '@/stores/detailStore'
import { Fragment } from 'react'

// Entity detail components will be lazy-loaded
import { CategoryDetail } from './detail/CategoryDetail'
import { PropertyDetail } from './detail/PropertyDetail'
import { SubobjectDetail } from './detail/SubobjectDetail'
import { ModuleDetail } from './detail/ModuleDetail'
import { BundleDetail } from './detail/BundleDetail'
import { TemplateDetail } from './detail/TemplateDetail'

interface EntityDetailModalProps {
  /** Draft UUID for query params (fetching effective views) */
  draftId?: string
  /** Draft capability token for mutations (creating/updating changes) */
  draftToken?: string
}

/**
 * Full detail view modal overlay.
 * Per CONTEXT.md: modal overlay hides graph behind, global edit toggle at top.
 */
export function EntityDetailModal({ draftId, draftToken }: EntityDetailModalProps) {
  const {
    isOpen,
    isEditing,
    entityKey,
    entityType,
    breadcrumbs,
    closeDetail,
    setEditing,
    navigateToBreadcrumb,
  } = useDetailStore()

  // Only show edit toggle when draft context is active
  const canEdit = !!draftId

  // Render the appropriate detail component based on entity type
  const renderDetail = () => {
    if (!entityKey || !entityType) return null

    const props = {
      entityKey,
      draftId,
      draftToken,
      isEditing: canEdit && isEditing,
    }

    switch (entityType) {
      case 'category':
        return <CategoryDetail {...props} />
      case 'property':
        return <PropertyDetail {...props} />
      case 'subobject':
        return <SubobjectDetail {...props} />
      case 'module':
        return <ModuleDetail {...props} />
      case 'bundle':
        return <BundleDetail {...props} />
      case 'template':
        return <TemplateDetail {...props} />
      default:
        return <div>Unknown entity type: {entityType}</div>
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeDetail()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            {/* Breadcrumb navigation */}
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => (
                  <Fragment key={crumb.key}>
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {index === breadcrumbs.length - 1 ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            navigateToBreadcrumb(index)
                          }}
                        >
                          {crumb.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>

            {/* Edit mode toggle - only shown in draft context */}
            {canEdit && (
              <div className="flex items-center gap-2">
                <Switch
                  id="edit-mode"
                  checked={isEditing}
                  onCheckedChange={setEditing}
                />
                <Label htmlFor="edit-mode" className="text-sm">
                  Edit Mode
                </Label>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {renderDetail()}
        </div>
      </DialogContent>
    </Dialog>
  )
}
