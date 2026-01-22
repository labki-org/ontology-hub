import { Link } from 'react-router-dom'
import { Boxes, Tag, Package } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useEntityOverview } from '@/api/entities'

export function HomePage() {
  const { data, isLoading, error } = useEntityOverview()

  const getCount = (type: string) => {
    return data?.types.find(t => t.entity_type === type)?.count ?? 0
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome to Ontology Hub</h1>
        <p className="text-muted-foreground mt-2">
          Browse and explore schema entities - categories, properties, and subobjects.
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load entity overview</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{getCount('category')}</div>
                <CardDescription>
                  <Link to="/category/Person" className="hover:underline">
                    Browse categories
                  </Link>
                </CardDescription>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Properties</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{getCount('property')}</div>
                <CardDescription>
                  <Link to="/property/has_name" className="hover:underline">
                    Browse properties
                  </Link>
                </CardDescription>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subobjects</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{getCount('subobject')}</div>
                <CardDescription>
                  <Link to="/subobject/Address" className="hover:underline">
                    Browse subobjects
                  </Link>
                </CardDescription>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {data && (
        <Card>
          <CardHeader>
            <CardTitle>Total Entities</CardTitle>
            <CardDescription>
              {data.total} entities indexed from schema files
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}
