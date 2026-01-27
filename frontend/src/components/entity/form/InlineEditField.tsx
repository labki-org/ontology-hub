import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InlineEditFieldProps {
  /** Current value to display/edit */
  value: string
  /** Callback when save button is clicked */
  onSave: (newValue: string) => void
  /** Optional callback when delete button is clicked */
  onDelete?: () => void
  /** Whether the field can be edited (shows pencil icon) */
  isEditable?: boolean
  /** Whether the field can be deleted (shows trash icon) */
  isDeletable?: boolean
  /** Optional label to display before value */
  label?: string
  /** Placeholder text when value is empty */
  placeholder?: string
  /** Additional CSS classes */
  className?: string
}

/**
 * Inline editable field with hover-reveal edit/delete icons.
 *
 * View mode: Display value with hidden edit/delete icons that appear on hover
 * Edit mode: Controlled input with explicit save/cancel buttons
 *
 * Keyboard shortcuts:
 * - Escape: Cancel edit and revert value
 * - Enter: Save (single-line only)
 *
 * Click-away: Discards changes silently (explicit save required)
 */
export function InlineEditField({
  value,
  onSave,
  onDelete,
  isEditable = true,
  isDeletable = false,
  label,
  placeholder,
  className,
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const saveButtonRef = useRef<HTMLButtonElement>(null)

  // Sync edit value when prop changes (e.g., external updates)
  /* eslint-disable react-hooks/set-state-in-effect -- Valid sync with external prop */
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value)
    }
  }, [value, isEditing])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Auto-focus and select text when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleEdit = useCallback(() => {
    setEditValue(value)
    setIsEditing(true)
  }, [value])

  const handleSave = useCallback(() => {
    onSave(editValue)
    setIsEditing(false)
  }, [editValue, onSave])

  const handleCancel = useCallback(() => {
    setEditValue(value)
    setIsEditing(false)
  }, [value])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        handleCancel()
        e.preventDefault()
      } else if (e.key === 'Enter') {
        handleSave()
        e.preventDefault()
      }
    },
    [handleCancel, handleSave]
  )

  // Click-away: discard changes silently (explicit save required)
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      // Check if focus is moving to save button - if so, don't cancel
      if (
        saveButtonRef.current &&
        e.relatedTarget === saveButtonRef.current
      ) {
        return
      }
      // Otherwise, cancel edit on blur
      handleCancel()
    },
    [handleCancel]
  )

  const handleDelete = useCallback(() => {
    onDelete?.()
  }, [onDelete])

  const showIcons = isEditable || isDeletable

  // Edit mode
  if (isEditing) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {label && (
          <span className="text-sm font-medium text-muted-foreground shrink-0">
            {label}:
          </span>
        )}
        <Input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button
          ref={saveButtonRef}
          variant="ghost"
          size="icon-sm"
          onClick={handleSave}
          className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
          aria-label="Save"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCancel}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  // View mode with hover-reveal icons
  return (
    <div
      className={cn(
        'group relative rounded-md px-2 py-1.5 transition-colors',
        showIcons && 'hover:bg-gray-50 dark:hover:bg-gray-800',
        className
      )}
    >
      <div className="flex items-center gap-2 pr-16">
        {label && (
          <span className="text-sm font-medium text-muted-foreground shrink-0">
            {label}:
          </span>
        )}
        <span className="text-sm">
          {value || (
            <span className="text-muted-foreground italic">
              {placeholder || '(empty)'}
            </span>
          )}
        </span>
      </div>

      {/* Hover-reveal icons */}
      {showIcons && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isEditable && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleEdit}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              aria-label="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {isDeletable && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDelete}
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
