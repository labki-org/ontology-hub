import { useSearchParams } from 'react-router-dom'
import { useSearch } from '@/api/entities'
import { useDebounce } from '@/hooks/useDebounce'
import { SearchResults } from '@/components/search/SearchResults'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import type { EntityType } from '@/api/types'

const entityTypes: { value: EntityType | ''; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'category', label: 'Categories' },
  { value: 'property', label: 'Properties' },
  { value: 'subobject', label: 'Subobjects' },
]

/**
 * Search results page.
 * Reads query and type from URL params, displays results.
 */
export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const query = searchParams.get('q') || ''
  const typeParam = searchParams.get('type') as EntityType | null
  const entityType = typeParam || undefined

  // Debounce query for API calls
  const debouncedQuery = useDebounce(query, 300)

  // Fetch search results
  const { data, isLoading, error } = useSearch(debouncedQuery, entityType)

  // Handle type filter change
  const handleTypeChange = (newType: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (newType) {
      newParams.set('type', newType)
    } else {
      newParams.delete('type')
    }
    setSearchParams(newParams)
  }

  // Show minimum query length message
  if (query.length > 0 && query.length < 2) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Search Results</h1>
          <p className="text-muted-foreground mt-1">
            Please enter at least 2 characters to search
          </p>
        </div>
      </div>
    )
  }

  // Show empty state when no query
  if (!query) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Search</h1>
          <p className="text-muted-foreground mt-1">
            Enter a search term in the sidebar to find entities
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Search Results</h1>
          <p className="text-muted-foreground mt-1">
            {isLoading ? (
              'Searching...'
            ) : data ? (
              `${data.items.length} result${data.items.length === 1 ? '' : 's'} for "${query}"`
            ) : (
              `Searching for "${query}"`
            )}
          </p>
        </div>

        {/* Type filter */}
        <select
          value={entityType || ''}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="px-3 py-2 text-sm rounded-md border border-input bg-background"
          aria-label="Filter by entity type"
        >
          {entityTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to search: {error.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {/* Results */}
      {data && !isLoading && <SearchResults items={data.items} query={query} />}
    </div>
  )
}
