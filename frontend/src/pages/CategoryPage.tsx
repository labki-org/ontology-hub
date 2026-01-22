import { useParams, Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { useEntity } from '@/api/entities'
import { EntityDetail } from '@/components/entity/EntityDetail'
import { SchemaTable } from '@/components/entity/SchemaTable'
import { PropertyList } from '@/components/entity/PropertyList'
import { InheritanceGraph } from '@/components/graph/InheritanceGraph'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function CategoryPage() {
  const { entityId } = useParams<{ entityId: string }>()
  const { data: entity, isLoading, error } = useEntity('category', entityId!)

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
          <h1 className="text-xl font-semibold text-destructive">Category Not Found</h1>
          <p className="text-muted-foreground mt-2">
            The category "{entityId}" could not be found.
          </p>
        </CardContent>
      </Card>
    )
  }

  const schema = entity.schema_definition as {
    parent?: string
    properties?: string[]
    subobjects?: string[]
    [key: string]: unknown
  }

  return (
    <div className="space-y-6">
      <EntityDetail entity={entity} entityType="category" />

      {/* Inheritance Graph */}
      <section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inheritance</CardTitle>
            <Link to={`/graph/${entityId}`}>
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-4 w-4 mr-1" />
                Full Graph
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="h-64">
            <InheritanceGraph entityId={entityId!} compact />
          </CardContent>
        </Card>
      </section>

      {/* Properties and Subobjects */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Properties & Subobjects</h2>
        <PropertyList
          properties={schema.properties || []}
          subobjects={schema.subobjects || []}
        />
      </section>

      {/* Schema Definition */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Schema Definition</h2>
        <SchemaTable schema={schema} entityType="category" />
      </section>
    </div>
  )
}
