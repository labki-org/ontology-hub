import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'

interface EditableListProps {
  items: string[]
  onAdd: (item: string) => void
  onRemove: (item: string) => void
  isEditing: boolean
  renderItem?: (item: string) => React.ReactNode
  placeholder?: string
  emptyMessage?: string
}

/**
 * List that allows adding/removing items in edit mode.
 * Shows edit icons in draft mode per CONTEXT.md.
 */
export function EditableList({
  items,
  onAdd,
  onRemove,
  isEditing,
  renderItem,
  placeholder = 'Add item...',
  emptyMessage = 'No items',
}: EditableListProps) {
  const [newItem, setNewItem] = useState('')

  const handleAdd = () => {
    if (newItem.trim()) {
      onAdd(newItem.trim())
      setNewItem('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd()
      e.preventDefault()
    }
  }

  if (items.length === 0 && !isEditing) {
    return <p className="text-sm text-muted-foreground italic">{emptyMessage}</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-1">
            {renderItem ? (
              renderItem(item)
            ) : (
              <Badge variant="secondary">{item}</Badge>
            )}
            {isEditing && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => onRemove(item)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {isEditing && (
        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="max-w-xs"
          />
          <Button variant="outline" size="sm" onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      )}
    </div>
  )
}
