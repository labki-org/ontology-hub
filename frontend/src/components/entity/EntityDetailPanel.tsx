// Full detail components
import { CategoryDetail } from './detail/CategoryDetail'
import { PropertyDetail } from './detail/PropertyDetail'
import { SubobjectDetail } from './detail/SubobjectDetail'
import { ModuleDetail } from './detail/ModuleDetail'
import { BundleDetail } from './detail/BundleDetail'
import { TemplateDetail } from './detail/TemplateDetail'
import { DashboardDetail } from './detail/DashboardDetail'
import { ResourceDetail } from './detail/ResourceDetail'

interface EntityDetailPanelProps {
  entityKey: string | null
  entityType?: string
  /** Draft UUID for query params (fetching effective views) */
  draftId?: string
  /** Draft capability token for mutations */
  draftToken?: string
}

/**
 * Detail panel component that shows the selected entity's full information.
 *
 * Displays in the side panel overlay on the right. Shows details for whatever
 * entity is selected in graphStore.
 *
 * In draft mode (draftId present), editing is automatically enabled.
 * Detail components handle their own data fetching.
 */
export function EntityDetailPanel({
  entityKey,
  entityType = 'category',
  draftId,
  draftToken,
}: EntityDetailPanelProps) {
  // Editing is enabled when in draft mode
  const isEditing = !!draftId

  if (!entityKey) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium mb-2">Select an entity to view details</p>
          <p className="text-sm">Click an entity in the sidebar or graph to see its information</p>
        </div>
      </div>
    )
  }

  // Render the appropriate detail component based on entity type
  const renderDetail = () => {
    const props = {
      entityKey,
      draftId,
      draftToken,
      isEditing,
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
      case 'dashboard':
        return <DashboardDetail {...props} />
      case 'resource':
        return <ResourceDetail {...props} />
      default:
        return (
          <div className="p-6 text-center text-muted-foreground">
            <p className="font-medium">Unknown entity type: {entityType}</p>
          </div>
        )
    }
  }

  return (
    <div className="h-full overflow-auto">
      {renderDetail()}
    </div>
  )
}
