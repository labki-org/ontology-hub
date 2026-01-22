import { useState, useCallback, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'

interface SearchInputProps {
  /** Placeholder text for the input */
  placeholder?: string
  /** Additional CSS classes */
  className?: string
}

/**
 * Search input with debounce navigation to search page.
 * Reads and syncs with URL query parameter.
 */
export function SearchInput({
  placeholder = 'Search entities...',
  className = '',
}: SearchInputProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Initialize from URL query param
  const initialQuery = searchParams.get('q') || ''
  const [query, setQuery] = useState(initialQuery)

  // Debounce query changes
  const debouncedQuery = useDebounce(query, 300)

  // Navigate on debounced query change (only if minimum length met)
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      navigate(`/search?q=${encodeURIComponent(debouncedQuery)}`, { replace: true })
    }
  }, [debouncedQuery, navigate])

  // Handle form submission
  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      if (query.length >= 2) {
        navigate(`/search?q=${encodeURIComponent(query)}`)
      }
    },
    [query, navigate]
  )

  // Clear the search input
  const handleClear = useCallback(() => {
    setQuery('')
    navigate('/')
  }, [navigate])

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-8 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Search entities"
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  )
}
