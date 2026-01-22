import { useState } from 'react'
import { Package, Search, X } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { useModules } from '@/api/modules'
import { ModuleCard } from '@/components/module/ModuleCard'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function ModulesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Only search if query has at least 2 characters (API requirement)
  const searchParam = debouncedSearch.length >= 2 ? debouncedSearch : undefined
  const { data: modules, isLoading, error } = useModules(searchParam)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Modules</h1>
        </div>
        <p className="text-muted-foreground mt-2">
          Browse modules - groupings of related categories, properties, and subobjects.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search modules..."
          className="w-full pl-8 pr-8 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Search modules"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load modules</p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6 space-y-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Module Grid */}
      {modules && !isLoading && (
        <>
          {modules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  {searchQuery
                    ? `No modules found matching "${searchQuery}"`
                    : 'No modules found'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {modules.map((module) => (
                <ModuleCard key={module.id} module={module} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
