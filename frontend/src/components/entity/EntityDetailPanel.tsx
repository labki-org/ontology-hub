import { useCategory } from '@/api/entitiesV2'
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
}

/**
 * Detail panel component that shows the selected entity's information.
 *
 * Displays in the bottom panel of the split layout. Shows details for whatever
 * entity is selected in graphStore.
 *
 * For now, focuses on category as primary entity type. Full detail pages with
 * edit mode are Phase 13.
 */
export function EntityDetailPanel({
  entityKey,
  entityType = 'category',
  draftId,
}: EntityDetailPanelProps) {
  const setSelectedEntity = useGraphStore((s) => s.setSelectedEntity)

  // Fetch category data (main use case for now)
  const { data, isLoading, error } = useCategory(entityKey || '', draftId)

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

  // Type guard to check if data is CategoryDetailV2
  const categoryData = data as CategoryDetailV2

  return (
    <div className="h-full overflow-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-2xl">{categoryData.label}</CardTitle>
            {categoryData.change_status && categoryData.change_status !== 'unchanged' && (
              <Badge
                variant={
                  categoryData.change_status === 'added'
                    ? 'default'
                    : categoryData.change_status === 'modified'
                    ? 'secondary'
                    : 'destructive'
                }
                className={
                  categoryData.change_status === 'added'
                    ? 'bg-green-500 hover:bg-green-600'
                    : categoryData.change_status === 'modified'
                    ? 'bg-yellow-500 hover:bg-yellow-600'
                    : ''
                }
              >
                {categoryData.change_status === 'added'
                  ? '+ Added'
                  : categoryData.change_status === 'modified'
                  ? '~ Modified'
                  : '- Deleted'}
              </Badge>
            )}
          </div>
          {categoryData.description && (
            <CardDescription>{categoryData.description}</CardDescription>
          )}
          {categoryData.patch_error && (
            <div className="mt-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
              <strong>Patch Error:</strong> {categoryData.patch_error}
            </div>
          )}
        </CardHeader>

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
                    onClick={() => setSelectedEntity(parent)}
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
                        onClick={() => setSelectedEntity(prop.entity_key)}
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
                          onClick={() => setSelectedEntity(prop.source_category)}
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
      </Card>
    </div>
  )
}
