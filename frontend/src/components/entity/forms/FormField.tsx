import type { ReactNode } from 'react'
import type { Control, FieldValues, Path } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FormFieldProps<TFieldValues extends FieldValues> {
  /** Field name in the form */
  name: Path<TFieldValues>
  /** Label text to display */
  label: string
  /** Whether the field is required */
  required?: boolean
  /** React Hook Form control object */
  control: Control<TFieldValues>
  /** Render function that receives field props and renders the input */
  /* eslint-disable @typescript-eslint/no-explicit-any -- React Hook Form types use any */
  render: (field: {
    value: string
    onChange: (...event: any[]) => void
    onBlur: () => void
    name: string
    ref: React.Ref<any>
    'data-invalid'?: boolean
  }) => ReactNode
  /* eslint-enable @typescript-eslint/no-explicit-any */
  /** Optional description text below the label */
  description?: string
  /** Additional CSS classes for the wrapper */
  className?: string
}

/**
 * Reusable form field wrapper with consistent label, required indicator, and error display.
 *
 * Features:
 * - Label with red asterisk (*) for required fields
 * - Error message display with role="alert" for accessibility
 * - data-invalid attribute passed to child for TailwindCSS styling
 * - Uses react-hook-form Controller for controlled inputs
 *
 * @example
 * ```tsx
 * <FormField
 *   name="id"
 *   label="ID"
 *   required
 *   control={form.control}
 *   render={(field) => (
 *     <Input {...field} placeholder="category-name" />
 *   )}
 * />
 * ```
 */
export function FormField<TFieldValues extends FieldValues>({
  name,
  label,
  required,
  control,
  render,
  description,
  className,
}: FormFieldProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <div className={cn('space-y-2', className)}>
          <Label htmlFor={name} className="flex items-center gap-1">
            {label}
            {required && (
              <span
                className="text-red-600 dark:text-red-500"
                aria-label="required"
              >
                *
              </span>
            )}
          </Label>

          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}

          {render({
            ...field,
            'data-invalid': fieldState.invalid || undefined,
          })}

          {fieldState.error && (
            <p
              className="text-sm text-red-600 dark:text-red-500"
              role="alert"
              id={`${name}-error`}
            >
              {fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  )
}
