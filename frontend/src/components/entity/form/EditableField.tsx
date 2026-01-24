import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { VisualChangeMarker } from './VisualChangeMarker'
import { RotateCcw } from 'lucide-react'

interface EditableFieldProps {
  value: string
  originalValue?: string
  onChange: (value: string) => void
  onRevert?: () => void
  isEditing: boolean
  multiline?: boolean
  label?: string
  placeholder?: string
  className?: string
}

/**
 * Inline editable field that:
 * - Shows text in view mode
 * - Becomes input/textarea in edit mode
 * - Shows visual change marker when value differs from original
 * - Has revert button to restore original value
 * - ESC key reverts, Enter saves (single-line only)
 */
export function EditableField({
  value,
  originalValue,
  onChange,
  onRevert,
  isEditing,
  multiline = false,
  label,
  placeholder,
  className,
}: EditableFieldProps) {
  const [localValue, setLocalValue] = useState(value)

  // Sync local value with prop when it changes externally
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const isModified = originalValue !== undefined && value !== originalValue
  const status = isModified ? 'modified' : 'unchanged'

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = e.target.value
      setLocalValue(newValue)
      onChange(newValue)
    },
    [onChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && onRevert) {
        onRevert()
        e.preventDefault()
      }
      // Enter to save only for single-line inputs
      if (e.key === 'Enter' && !multiline) {
        ;(e.target as HTMLInputElement).blur()
        e.preventDefault()
      }
    },
    [onRevert, multiline]
  )

  // View mode
  if (!isEditing) {
    return (
      <VisualChangeMarker status={status} originalValue={originalValue} className={className}>
        <div className="py-1">
          {label && (
            <span className="text-sm font-medium text-muted-foreground">{label}: </span>
          )}
          <span>{value || <span className="text-muted-foreground italic">(empty)</span>}</span>
        </div>
      </VisualChangeMarker>
    )
  }

  // Edit mode
  const InputComponent = multiline ? Textarea : Input

  return (
    <VisualChangeMarker status={status} originalValue={originalValue} className={className}>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          {label && (
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              {label}
            </label>
          )}
          <InputComponent
            value={localValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={multiline ? 'min-h-[80px]' : ''}
          />
        </div>
        {isModified && onRevert && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRevert}
            title="Revert to original"
            className="mt-6"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>
    </VisualChangeMarker>
  )
}
