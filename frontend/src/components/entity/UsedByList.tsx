import { Link } from 'react-router-dom'
import { Folder } from 'lucide-react'
import { useUsedBy } from '@/api/entities'
import type { EntityType } from '@/api/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface UsedByListProps {
  entityType: EntityType
  entityId: string
}

export function UsedByList({ entityType, entityId }: UsedByListProps) {
  const { data: categories, isLoading, error } = useUsedBy(entityType, entityId)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Used By</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Used By</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Failed to load used-by references
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Used By</CardTitle>
      </CardHeader>
      <CardContent>
        {categories && categories.length > 0 ? (
          <ul className="space-y-2">
            {categories.map((category) => (
              <li key={category.entity_id}>
                <Link
                  to={`/category/${category.entity_id}`}
                  className="flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors"
                >
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-sm">{category.entity_id}</span>
                  {category.label !== category.entity_id && (
                    <span className="text-sm text-muted-foreground">
                      ({category.label})
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            Not used by any categories
          </p>
        )}
      </CardContent>
    </Card>
  )
}
