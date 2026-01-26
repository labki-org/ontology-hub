import { useState } from 'react'
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
import { Plus, Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type EntityType = 'category' | 'property' | 'subobject' | 'template' | 'module' | 'bundle'

interface EntityComboboxProps {
  /** Type of entity being selected */
  entityType: EntityType
  /** Available entities to select from */
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
}

/**
 * Autocomplete combobox for selecting related entities.
 *
 * Features:
 * - Type-ahead search with keyboard navigation (via cmdk)
 * - "Create" option appears when typing non-existent entity ID
 * - Filters out already-selected entities to prevent duplicates
 * - Searches both key (ID) and label fields
 *
 * @example
 * ```tsx
 * <EntityCombobox
 *   entityType="category"
 *   availableEntities={categories}
 *   selectedKeys={form.watch('parents') || []}
 *   onChange={(keys) => form.setValue('parents', keys)}
 *   onCreateNew={(id) => onCreateRelatedEntity('category', id)}
 *   placeholder="Add parent category..."
 * />
 * ```
 */
export function EntityCombobox({
  entityType,
  availableEntities,
  selectedKeys,
  onChange,
  onCreateNew,
  placeholder = 'Search...',
  disabled,
}: EntityComboboxProps) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')

  // Filter out already selected entities
  const unselectedEntities = availableEntities.filter(
    (e) => !selectedKeys.includes(e.key)
  )

  // Filter by search (searches both key and label)
  const filteredEntities = unselectedEntities.filter(
    (e) =>
      e.key.toLowerCase().includes(inputValue.toLowerCase()) ||
      e.label.toLowerCase().includes(inputValue.toLowerCase())
  )

  // Check if exact match exists (in all entities, not just unselected)
  const exactMatch = availableEntities.find(
    (e) => e.key.toLowerCase() === inputValue.toLowerCase().trim()
  )

  // Show "Create" option only when:
  // 1. Input has value
  // 2. No exact match exists
  // 3. onCreateNew handler is provided
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
              {showCreateOption ? (
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
              {filteredEntities.map((entity) => (
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
            {showCreateOption && filteredEntities.length > 0 && (
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
