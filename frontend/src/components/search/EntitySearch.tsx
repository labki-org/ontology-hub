import { Search } from 'lucide-react'

interface EntitySearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

/**
 * Live search component for filtering entities in sidebar.
 * Filters as user types without needing to press enter.
 */
export function EntitySearch({
  value,
  onChange,
  placeholder = 'Search entities...',
}: EntitySearchProps) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Search entities"
      />
    </div>
  )
}

/**
 * Hook to filter entities based on search term.
 * Returns filtered list where label contains search term (case-insensitive).
 *
 * @param searchTerm - The search term to filter by
 * @param entities - The list of entities to filter
 * @returns Filtered entity list
 */
// eslint-disable-next-line react-refresh/only-export-components -- Hook co-located with component
export function useSearchFilter<T extends { label: string }>(
  searchTerm: string,
  entities: T[]
): T[] {
  if (!searchTerm.trim()) {
    return entities
  }

  const lowerSearch = searchTerm.toLowerCase()
  return entities.filter((entity) =>
    entity.label.toLowerCase().includes(lowerSearch)
  )
}
