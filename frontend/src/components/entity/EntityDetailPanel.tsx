import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useGraphStore } from '@/stores/graphStore'
import type { CategoryDetailV2 } from '@/api/types'

interface EntityDetailPanelProps {
  entityKey: string | null
  entityType?: string
  draftId?: string
  // Data passed from parent (BrowsePage handles fetching)
  data?: unknown
  isLoading?: boolean
  error?: Error | null
}

/**
 * Detail panel component that shows the selected entity's information.
 *
 * Displays in the bottom panel of the split layout. Shows details for whatever
 * entity is selected in graphStore.
 *
 * Data fetching is done by BrowsePage and passed as props to work around
 * a rendering issue where hooks weren't executing in this component.
 */
export function EntityDetailPanel({
  entityKey,
  entityType = 'category',
  data,
  isLoading = false,
  error = null,
}: EntityDetailPanelProps) {
  const setSelectedEntity = useGraphStore((s) => s.setSelectedEntity)

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

  if (isLoading) {
    return (
      <div className="h-full overflow-auto p-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center text-destructive">
          <p className="font-medium">Failed to load entity details</p>
          <p className="text-sm text-muted-foreground mt-1">Please try again</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          <p className="font-medium">Entity not found</p>
        </div>
      </div>
    )
  }

  // Type-specific rendering
  const entityData = data as Record<string, unknown>
  const label = entityData.label as string
  const description = entityData.description as string | undefined
  const changeStatus = entityData.change_status as string | undefined

  // Render change status badge
  const renderChangeStatusBadge = () => {
    if (!changeStatus || changeStatus === 'unchanged') return null
    return (
      <Badge
        variant={
          changeStatus === 'added'
            ? 'default'
            : changeStatus === 'modified'
            ? 'secondary'
            : 'destructive'
        }
        className={
          changeStatus === 'added'
            ? 'bg-green-500 hover:bg-green-600'
            : changeStatus === 'modified'
            ? 'bg-yellow-500 hover:bg-yellow-600'
            : ''
        }
      >
        {changeStatus === 'added'
          ? '+ Added'
          : changeStatus === 'modified'
          ? '~ Modified'
          : '- Deleted'}
      </Badge>
    )
  }

  // Render category-specific content
  const renderCategoryContent = () => {
    const categoryData = data as CategoryDetailV2
    return (
      <CardContent className="space-y-6">
        {/* Parents section */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Parent Categories
          </h3>
          {categoryData.parents && categoryData.parents.length > 0 ? (
            <div className="space-y-1">
              {categoryData.parents.map((parent) => (
                <button
                  key={parent}
                  onClick={() => setSelectedEntity(parent, 'category')}
                  className="block text-sm text-primary hover:underline text-left"
                >
                  {parent}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No parent categories</p>
          )}
        </div>

        {/* Properties section */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Properties
          </h3>
          {categoryData.properties && categoryData.properties.length > 0 ? (
            <div className="space-y-2">
              {categoryData.properties.map((prop) => (
                <div
                  key={prop.entity_key}
                  className="p-3 border rounded-md bg-muted/30"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      onClick={() => setSelectedEntity(prop.entity_key, 'property')}
                      className="font-medium text-sm text-primary hover:underline"
                    >
                      {prop.label}
                    </button>
                    {prop.is_required && (
                      <Badge variant="outline" className="text-xs">
                        Required
                      </Badge>
                    )}
                    {prop.is_direct && (
                      <Badge variant="default" className="text-xs bg-blue-500">
                        Direct
                      </Badge>
                    )}
                    {prop.is_inherited && !prop.is_direct && (
                      <Badge variant="secondary" className="text-xs">
                        Inherited
                      </Badge>
                    )}
                  </div>
                  {prop.is_inherited && prop.source_category && (
                    <p className="text-xs text-muted-foreground">
                      From:{' '}
                      <button
                        onClick={() => setSelectedEntity(prop.source_category, 'category')}
                        className="text-primary hover:underline"
                      >
                        {prop.source_category}
                      </button>
                      {prop.inheritance_depth > 0 && (
                        <span> (depth: {prop.inheritance_depth})</span>
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No properties</p>
          )}
        </div>
      </CardContent>
    )
  }

  // Render property-specific content
  const renderPropertyContent = () => {
    const propertyData = entityData
    const datatype = propertyData.datatype as string | undefined
    const cardinality = propertyData.cardinality as string | undefined

    return (
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {datatype && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Datatype
              </h3>
              <Badge variant="outline">{datatype}</Badge>
            </div>
          )}
          {cardinality && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Cardinality
              </h3>
              <Badge variant="outline">{cardinality}</Badge>
            </div>
          )}
        </div>
      </CardContent>
    )
  }

  // Render subobject-specific content
  const renderSubobjectContent = () => {
    return (
      <CardContent>
        <p className="text-sm text-muted-foreground">Subobject details</p>
      </CardContent>
    )
  }

  // Render module-specific content
  const renderModuleContent = () => {
    const moduleData = entityData
    const entities = moduleData.entities as string[] | undefined

    return (
      <CardContent className="space-y-4">
        {entities && entities.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Entities
            </h3>
            <div className="flex flex-wrap gap-2">
              {entities.map((entity) => (
                <Badge key={entity} variant="secondary">
                  {entity}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    )
  }

  // Render generic content for other entity types
  const renderGenericContent = () => {
    return (
      <CardContent>
        <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
          {JSON.stringify(data, null, 2)}
        </pre>
      </CardContent>
    )
  }

  // Select content renderer based on entity type
  const renderContent = () => {
    switch (entityType) {
      case 'category':
        return renderCategoryContent()
      case 'property':
        return renderPropertyContent()
      case 'subobject':
        return renderSubobjectContent()
      case 'module':
        return renderModuleContent()
      default:
        return renderGenericContent()
    }
  }

  return (
    <div className="h-full overflow-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-2xl">{label}</CardTitle>
            <Badge variant="outline" className="text-xs">
              {entityType}
            </Badge>
            {renderChangeStatusBadge()}
          </div>
          {description && (
            <CardDescription>{description}</CardDescription>
          )}
        </CardHeader>
        {renderContent()}
      </Card>
    </div>
  )
}
