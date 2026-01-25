import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { categorySchema, type CategoryFormData } from './schemas'
import { FormField } from './FormField'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

interface CategoryFormProps {
  /** Callback when form is submitted with valid data */
  onSubmit: (data: CategoryFormData) => void
  /** Callback when cancel button is clicked */
  onCancel: () => void
  /** Whether the form is currently submitting */
  isSubmitting?: boolean
}

/**
 * Category creation form with ID, Label, and Description fields.
 *
 * Features:
 * - Validates on blur (per CONTEXT.md)
 * - Create button disabled until form is valid
 * - ID field validates for kebab-case format
 * - Parents relationship field handled in Plan 05 with EntityCombobox
 *
 * @example
 * ```tsx
 * <CategoryForm
 *   onSubmit={(data) => createCategory(data)}
 *   onCancel={() => closeModal()}
 *   isSubmitting={mutation.isPending}
 * />
 * ```
 */
export function CategoryForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
}: CategoryFormProps) {
  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    mode: 'onBlur',
    defaultValues: {
      id: '',
      label: '',
      description: '',
      parents: [],
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
        description="Unique identifier for the category (lowercase, numbers, hyphens)"
        render={(field) => (
          <Input
            {...field}
            id="id"
            placeholder="category-name"
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
            placeholder="Category Name"
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
            placeholder="A brief description of this category..."
            rows={3}
          />
        )}
      />

      {/* Parents field will be added in Plan 05 with EntityCombobox */}

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
