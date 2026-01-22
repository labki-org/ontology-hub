import { useState, useRef, useEffect } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDraftStore, buildFieldKey } from '@/stores/draftStore'
import { cn } from '@/lib/utils'

interface EditableFieldProps {
  entityType: string
  entityId: string
  fieldName: string
  value: unknown
  originalValue?: unknown
  fieldType?: 'text' | 'textarea' | 'number'
  className?: string
}

export function EditableField({
  entityType,
  entityId,
  fieldName,
  value,
  originalValue,
  fieldType = 'text',
  className,
}: EditableFieldProps) {
  const fieldKey = buildFieldKey(entityType, entityId, fieldName)
  const {
    editingFields,
    startEditingField,
    stopEditingField,
    updateEntityField,
  } = useDraftStore()

  const isEditing = editingFields.has(fieldKey)
  const [localValue, setLocalValue] = useState(String(value ?? ''))
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  // Determine if value differs from original
  const hasChanged =
    originalValue !== undefined &&
    JSON.stringify(value) !== JSON.stringify(originalValue)

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Sync local value when prop changes
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(String(value ?? ''))
    }
  }, [value, isEditing])

  const handleStartEdit = () => {
    setLocalValue(String(value ?? ''))
    startEditingField(fieldKey)
  }

  const handleSave = () => {
    const parsedValue =
      fieldType === 'number' ? Number(localValue) : localValue
    updateEntityField(entityType, entityId, fieldName, parsedValue)
    stopEditingField(fieldKey)
  }

  const handleCancel = () => {
    setLocalValue(String(value ?? ''))
    stopEditingField(fieldKey)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel()
    } else if (e.key === 'Enter' && fieldType !== 'textarea') {
      e.preventDefault()
      handleSave()
    }
  }

  if (isEditing) {
    const inputClassName =
      'flex-1 px-2 py-1 text-sm border rounded bg-background focus:outline-none focus:ring-2 focus:ring-ring'

    return (
      <div className={cn('flex items-start gap-1', className)}>
        {fieldType === 'textarea' ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(inputClassName, 'min-h-[60px] resize-y')}
            rows={3}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={fieldType}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={inputClassName}
          />
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleSave}
          className="text-green-600 hover:text-green-700 hover:bg-green-100"
          title="Save"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCancel}
          className="text-red-600 hover:text-red-700 hover:bg-red-100"
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  // Display mode
  const displayValue =
    typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')

  return (
    <div className={cn('group flex items-center gap-1', className)}>
      <span
        className={cn(
          'text-sm',
          hasChanged && 'text-yellow-600 dark:text-yellow-400'
        )}
        title={hasChanged ? 'Modified from original' : undefined}
      >
        {displayValue || <span className="text-muted-foreground italic">empty</span>}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleStartEdit}
        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
        title="Edit"
      >
        <Pencil className="h-3 w-3" />
      </Button>
    </div>
  )
}
