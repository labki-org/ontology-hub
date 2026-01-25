import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { propertySchema, type PropertyFormData } from './schemas'
import { FormField } from './FormField'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** Datatype options for property fields */
const DATATYPE_OPTIONS = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date/Time' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'page', label: 'Page' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'telephone', label: 'Telephone' },
] as const

/** Cardinality options for property fields */
const CARDINALITY_OPTIONS = [
  { value: 'single', label: 'Single value' },
  { value: 'multiple', label: 'Multiple values' },
] as const

interface PropertyFormProps {
  /** Callback when form is submitted with valid data */
  onSubmit: (data: PropertyFormData) => void
  /** Callback when cancel button is clicked */
  onCancel: () => void
  /** Whether the form is currently submitting */
  isSubmitting?: boolean
  /** Optional initial data to prefill the form (e.g., from nested create) */
  initialData?: Partial<PropertyFormData>
}

/**
 * Property creation form with ID, Label, Description, Datatype, and Cardinality fields.
 *
 * Features:
 * - Validates on blur (per CONTEXT.md)
 * - Create button disabled until form is valid
 * - ID field validates for kebab-case format
 * - Datatype select with 9 options (text, number, date, etc.)
 * - Cardinality select (single/multiple)
 *
 * @example
 * ```tsx
 * <PropertyForm
 *   onSubmit={(data) => createProperty(data)}
 *   onCancel={() => closeModal()}
 *   isSubmitting={mutation.isPending}
 * />
 * ```
 */
export function PropertyForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
  initialData,
}: PropertyFormProps) {
  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    mode: 'onBlur',
    defaultValues: {
      id: initialData?.id ?? '',
      label: initialData?.label ?? '',
      description: initialData?.description ?? '',
      datatype: initialData?.datatype ?? '',
      cardinality: initialData?.cardinality ?? '',
    },
  })

  const { isValid } = form.formState

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        name="id"
        label="ID"
        required
        control={form.control}
        description="Page title format: starts uppercase, underscores between words"
        render={(field) => (
          <Input
            {...field}
            id="id"
            placeholder="Has_property"
            autoComplete="off"
          />
        )}
      />

      <FormField
        name="label"
        label="Label"
        required
        control={form.control}
        render={(field) => (
          <Input
            {...field}
            id="label"
            placeholder="Property Name"
            autoComplete="off"
          />
        )}
      />

      <FormField
        name="description"
        label="Description"
        required
        control={form.control}
        render={(field) => (
          <Textarea
            {...field}
            id="description"
            placeholder="A brief description of this property..."
            rows={3}
          />
        )}
      />

      {/* Datatype select using Controller */}
      <div className="space-y-2">
        <label
          htmlFor="datatype"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"
        >
          Datatype
          <span className="text-red-600 dark:text-red-500" aria-label="required">
            *
          </span>
        </label>
        <Controller
          name="datatype"
          control={form.control}
          render={({ field, fieldState }) => (
            <>
              <Select
                onValueChange={(value) => {
                  field.onChange(value)
                  // Trigger validation since mode='onBlur' doesn't catch Select changes
                  form.trigger('datatype')
                }}
                value={field.value}
              >
                <SelectTrigger
                  id="datatype"
                  className="w-full"
                  data-invalid={fieldState.invalid || undefined}
                >
                  <SelectValue placeholder="Select datatype" />
                </SelectTrigger>
                <SelectContent>
                  {DATATYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.error && (
                <p
                  className="text-sm text-red-600 dark:text-red-500"
                  role="alert"
                  id="datatype-error"
                >
                  {fieldState.error.message}
                </p>
              )}
            </>
          )}
        />
      </div>

      {/* Cardinality select using Controller */}
      <div className="space-y-2">
        <label
          htmlFor="cardinality"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"
        >
          Cardinality
          <span className="text-red-600 dark:text-red-500" aria-label="required">
            *
          </span>
        </label>
        <Controller
          name="cardinality"
          control={form.control}
          render={({ field, fieldState }) => (
            <>
              <Select
                onValueChange={(value) => {
                  field.onChange(value)
                  // Trigger validation since mode='onBlur' doesn't catch Select changes
                  form.trigger('cardinality')
                }}
                value={field.value}
              >
                <SelectTrigger
                  id="cardinality"
                  className="w-full"
                  data-invalid={fieldState.invalid || undefined}
                >
                  <SelectValue placeholder="Select cardinality" />
                </SelectTrigger>
                <SelectContent>
                  {CARDINALITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.error && (
                <p
                  className="text-sm text-red-600 dark:text-red-500"
                  role="alert"
                  id="cardinality-error"
                >
                  {fieldState.error.message}
                </p>
              )}
            </>
          )}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create'}
        </Button>
      </div>
    </form>
  )
}
