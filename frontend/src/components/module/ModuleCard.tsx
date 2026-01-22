import { Link } from 'react-router-dom'
import { Package, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ModulePublic } from '@/api/types'

interface ModuleCardProps {
  module: ModulePublic
  /** Whether to show a compact version (for use in profile pages) */
  compact?: boolean
}

/**
 * Card component for displaying a module in list views.
 * Shows label, entity count, preview entity badges, and dependencies.
 */
export function ModuleCard({ module, compact = false }: ModuleCardProps) {
  const categoryCount = module.category_ids?.length || 0
  const previewCategories = module.category_ids?.slice(0, 4) || []
  const hasMoreCategories = categoryCount > 4
  const hasDependencies = module.dependencies && module.dependencies.length > 0

  if (compact) {
    return (
      <Link to={`/module/${module.module_id}`}>
        <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">{module.label}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-xs">
                {categoryCount} {categoryCount === 1 ? 'category' : 'categories'}
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  return (
    <Link to={`/module/${module.module_id}`}>
      <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <CardTitle>{module.label}</CardTitle>
            </div>
            <Badge variant="outline">
              {categoryCount} {categoryCount === 1 ? 'category' : 'categories'}
            </Badge>
          </div>
          {module.description && (
            <CardDescription className="line-clamp-2">
              {module.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Preview entities */}
          {previewCategories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {previewCategories.map((catId) => (
                <Badge key={catId} variant="secondary" className="text-xs">
                  {catId}
                </Badge>
              ))}
              {hasMoreCategories && (
                <Badge variant="secondary" className="text-xs">
                  +{categoryCount - 4} more
                </Badge>
              )}
            </div>
          )}

          {/* Dependencies */}
          {hasDependencies && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Depends on:</span>
              <div className="flex flex-wrap gap-1">
                {module.dependencies.map((dep) => (
                  <Badge key={dep} variant="outline" className="text-xs">
                    {dep}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
