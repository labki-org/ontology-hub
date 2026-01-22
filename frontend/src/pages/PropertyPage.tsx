import { useParams } from 'react-router-dom'
import { useEntity } from '@/api/entities'
import { EntityDetail } from '@/components/entity/EntityDetail'
import { SchemaTable } from '@/components/entity/SchemaTable'
import { UsedByList } from '@/components/entity/UsedByList'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function PropertyPage() {
  const { entityId } = useParams<{ entityId: string }>()
  const { data: entity, isLoading, error } = useEntity('property', entityId!)

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
          <h1 className="text-xl font-semibold text-destructive">Property Not Found</h1>
          <p className="text-muted-foreground mt-2">
            The property "{entityId}" could not be found.
          </p>
        </CardContent>
      </Card>
    )
  }

  const schema = entity.schema_definition as {
    datatype?: string
    cardinality?: string
    allowed_values?: string[]
    [key: string]: unknown
  }

  return (
    <div className="space-y-6">
      <EntityDetail entity={entity} entityType="property" />

      {/* Key Property Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Datatype</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="text-base">
              {schema.datatype || 'Not specified'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cardinality</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="text-base">
              {schema.cardinality || 'Not specified'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Allowed Values */}
      {schema.allowed_values && schema.allowed_values.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Allowed Values</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {schema.allowed_values.map((value) => (
                <Badge key={value} variant="secondary">
                  {value}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Used-by - categories using this property */}
      <UsedByList entityType="property" entityId={entityId!} />

      {/* Schema Definition */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Schema Definition</h2>
        <SchemaTable schema={schema} entityType="property" />
      </section>
    </div>
  )
}
