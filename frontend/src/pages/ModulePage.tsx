import { useParams, Link } from 'react-router-dom'
import { Package } from 'lucide-react'
import { useModule, useModuleEntities, useModuleOverlaps } from '@/api/modules'
import { ModuleEntityList } from '@/components/module/ModuleEntityList'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export function ModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>()
  const { data: module, isLoading: moduleLoading, error: moduleError } = useModule(moduleId!)
  const { data: entities, isLoading: entitiesLoading } = useModuleEntities(moduleId!)
  const { data: overlaps } = useModuleOverlaps(moduleId!)

  if (moduleLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (moduleError || !module) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <h1 className="text-xl font-semibold text-destructive">Module Not Found</h1>
          <p className="text-muted-foreground mt-2">
            The module "{moduleId}" could not be found.
          </p>
        </CardContent>
      </Card>
    )
  }

  const hasDependencies = module.dependencies && module.dependencies.length > 0

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-6 w-6 text-muted-foreground" />
              <div>
                <CardTitle className="text-2xl">{module.label}</CardTitle>
                <p className="text-sm text-muted-foreground font-mono mt-1">
                  {module.module_id}
                </p>
              </div>
            </div>
            <Badge variant="outline">
              {module.category_ids?.length || 0} categories
            </Badge>
          </div>
        </CardHeader>
        {module.description && (
          <CardContent>
            <CardDescription className="text-base">
              {module.description}
            </CardDescription>
          </CardContent>
        )}
        <CardFooter className="text-xs text-muted-foreground">
          <div className="flex gap-4">
            {module.commit_sha && (
              <span>Commit: {module.commit_sha.slice(0, 7)}</span>
            )}
            <span>
              Updated: {new Date(module.updated_at).toLocaleDateString()}
            </span>
          </div>
        </CardFooter>
      </Card>

      {/* Dependencies */}
      {hasDependencies && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Dependencies</h2>
          <div className="flex flex-wrap gap-2">
            {module.dependencies.map((dep) => (
              <Link key={dep} to={`/module/${dep}`}>
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                >
                  {dep}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Module Entities */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Included Entities</h2>
        {entitiesLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : entities ? (
          <ModuleEntityList
            categories={entities.categories}
            properties={entities.properties}
            subobjects={entities.subobjects}
            overlaps={overlaps}
          />
        ) : null}
      </section>
    </div>
  )
}
