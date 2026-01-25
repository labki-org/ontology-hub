import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { categorySchema, type CategoryFormData } from './schemas'
import { FormField } from './FormField'
import { EntityCombobox } from './EntityCombobox'
import { RelationshipChips } from './RelationshipChips'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useCategories } from '@/api/entitiesV2'

interface CategoryFormProps {
  /** Callback when form is submitted with valid data */
  onSubmit: (data: CategoryFormData) => void
  /** Callback when cancel button is clicked */
  onCancel: () => void
  /** Callback when user wants to create a related entity */
  onCreateRelatedEntity?: (type: string, id: string) => void
  /** Setter for the callback that will be invoked when nested entity is created */
  setOnNestedEntityCreated?: (callback: ((entityKey: string) => void) | null) => void
  /** Whether the form is currently submitting */
  isSubmitting?: boolean
  /** Optional draft ID for entity resolution */
  draftId?: string
  /** Optional initial data to prefill the form (e.g., from nested create) */
  initialData?: Partial<CategoryFormData>
}

/**
 * Category creation form with ID, Label, Description, and Parent Categories fields.
 *
 * Features:
 * - Validates on blur (per CONTEXT.md)
 * - Create button disabled until form is valid
 * - ID field validates for kebab-case format
 * - Parents field with EntityCombobox for relationship management
 *
 * @example
 * ```tsx
 * <CategoryForm
 *   onSubmit={(data) => createCategory(data)}
 *   onCancel={() => closeModal()}
 *   onCreateRelatedEntity={(type, id) => openCreateModal(type, id)}
 *   isSubmitting={mutation.isPending}
 *   draftId={currentDraftId}
 * />
 * ```
 */
export function CategoryForm({
  onSubmit,
  onCancel,
  onCreateRelatedEntity,
  setOnNestedEntityCreated,
  isSubmitting = false,
  draftId,
  initialData,
}: CategoryFormProps) {
  // Fetch available categories for parent selection
  const { data: categoriesData } = useCategories(undefined, undefined, draftId)
  const availableCategories = (categoriesData?.items || []).map((c) => ({
    key: c.entity_key,
    label: c.label,
  }))
  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    mode: 'onBlur',
    defaultValues: {
      id: initialData?.id ?? '',
      label: initialData?.label ?? '',
      description: initialData?.description ?? '',
      parents: initialData?.parents ?? [],
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
            placeholder="My_category"
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

      {/* Parent Categories relationship field */}
      <div className="space-y-2">
        <Label>Parent Categories</Label>
        <EntityCombobox
          entityType="category"
          availableEntities={availableCategories}
          selectedKeys={form.watch('parents') || []}
          onChange={(keys) => form.setValue('parents', keys)}
          onCreateNew={
            onCreateRelatedEntity && setOnNestedEntityCreated
              ? (id) => {
                  // Set callback to add created entity to this form's selection
                  setOnNestedEntityCreated((newKey: string) => {
                    const current = form.getValues('parents') || []
                    form.setValue('parents', [...current, newKey])
                  })
                  onCreateRelatedEntity('category', id)
                }
              : undefined
          }
          placeholder="Add parent category..."
        />
        <RelationshipChips
          values={form.watch('parents') || []}
          onRemove={(key) => {
            const current = form.getValues('parents') || []
            form.setValue(
              'parents',
              current.filter((k) => k !== key)
            )
          }}
          getLabel={(key) => {
            const found = availableCategories.find((c) => c.key === key)
            return found ? found.label : key
          }}
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
