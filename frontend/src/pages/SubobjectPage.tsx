import { useParams } from 'react-router-dom'
import { useEntity } from '@/api/entities'
import { EntityDetail } from '@/components/entity/EntityDetail'
import { SchemaTable } from '@/components/entity/SchemaTable'
import { PropertyList } from '@/components/entity/PropertyList'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function SubobjectPage() {
  const { entityId } = useParams<{ entityId: string }>()
  const { data: entity, isLoading, error } = useEntity('subobject', entityId!)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error || !entity) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <h1 className="text-xl font-semibold text-destructive">Subobject Not Found</h1>
          <p className="text-muted-foreground mt-2">
            The subobject "{entityId}" could not be found.
          </p>
        </CardContent>
      </Card>
    )
  }

  const schema = entity.schema_definition as {
    properties?: string[]
    [key: string]: unknown
  }

  return (
    <div className="space-y-6">
      <EntityDetail entity={entity} />

      {/* Properties */}
      {schema.properties && schema.properties.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Properties</h2>
          <PropertyList
            properties={schema.properties}
            subobjects={[]}
          />
        </section>
      )}

      {/* Used-by placeholder - implemented in Plan 03-03 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Used By</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Categories using this subobject will be shown here.
          </p>
        </CardContent>
      </Card>

      {/* Schema Definition */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Schema Definition</h2>
        <SchemaTable schema={schema} entityType="subobject" />
      </section>
    </div>
  )
}
