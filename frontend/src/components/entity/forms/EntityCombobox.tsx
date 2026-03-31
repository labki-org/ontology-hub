import { useState, useMemo } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Plus, Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEntitySearch } from '@/api/entities'

type EntityType = 'category' | 'property' | 'subobject' | 'template' | 'module' | 'bundle'

interface EntityComboboxProps {
  /** Type of entity being selected */
  entityType: EntityType
  /** Pre-loaded entities (shown when search is empty) */
  availableEntities: Array<{ key: string; label: string }>
  /** Currently selected entity keys */
  selectedKeys: string[]
  /** Callback when selection changes */
  onChange: (keys: string[]) => void
  /** Optional callback when user wants to create a new entity */
  onCreateNew?: (id: string) => void
  /** Placeholder text for the trigger button */
  placeholder?: string
  /** Whether the combobox is disabled */
  disabled?: boolean
  /** Draft ID for server-side search context */
  draftId?: string
}

/**
 * Autocomplete combobox for selecting related entities.
 *
 * Uses server-side search when the user types, falling back to
 * pre-loaded entities when the search box is empty. This ensures
 * all entities are findable regardless of list size.
 */
export function EntityCombobox({
  entityType,
  availableEntities,
  selectedKeys,
  onChange,
  onCreateNew,
  placeholder = 'Search...',
  disabled,
  draftId,
}: EntityComboboxProps) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')

  // Server-side search when user types
  const { data: searchResults, isLoading: isSearching } = useEntitySearch(
    entityType === 'category' ? 'categories' :
    entityType === 'property' ? 'properties' :
    entityType === 'subobject' ? 'subobjects' :
    entityType === 'template' ? 'templates' :
    entityType === 'module' ? 'modules' :
    'bundles',
    inputValue,
    draftId,
  )

  // Use server results when searching, pre-loaded when idle
  const displayEntities = useMemo(() => {
    const source = inputValue && searchResults?.items
      ? searchResults.items.map((e) => ({ key: e.entity_key, label: e.label }))
      : availableEntities

    // Filter out already selected
    return source.filter((e) => !selectedKeys.includes(e.key))
  }, [inputValue, searchResults, availableEntities, selectedKeys])

  // Check if exact match exists
  const allEntities = inputValue && searchResults?.items
    ? searchResults.items.map((e) => ({ key: e.entity_key, label: e.label }))
    : availableEntities
  const exactMatch = allEntities.find(
    (e) => e.key.toLowerCase() === inputValue.toLowerCase().trim()
  )

  const showCreateOption = inputValue.trim() && !exactMatch && onCreateNew

  const handleSelect = (key: string) => {
    onChange([...selectedKeys, key])
    setInputValue('')
    setOpen(false)
  }

  const handleCreate = () => {
    if (onCreateNew && inputValue.trim()) {
      onCreateNew(inputValue.trim())
      setInputValue('')
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Search ${entityType}...`}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
              {isSearching ? (
                <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </div>
              ) : showCreateOption ? (
                <button
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded-sm text-left"
                  onClick={handleCreate}
                >
                  <Plus className="h-4 w-4" />
                  Create &quot;{inputValue}&quot;
                </button>
              ) : (
                'No results found.'
              )}
            </CommandEmpty>
            <CommandGroup>
              {displayEntities.map((entity) => (
                <CommandItem
                  key={entity.key}
                  value={entity.key}
                  onSelect={() => handleSelect(entity.key)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedKeys.includes(entity.key)
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                  {entity.label}
                  <span className="ml-2 text-muted-foreground text-xs">
                    ({entity.key})
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            {showCreateOption && displayEntities.length > 0 && (
              <CommandGroup>
                <CommandSeparator />
                <CommandItem
                  value={`create-${inputValue}`}
                  onSelect={handleCreate}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create &quot;{inputValue}&quot;
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
