import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { resourceSchema, type ResourceFormData } from './schemas'
import { FormField } from './FormField'
import { EntityCombobox } from './EntityCombobox'
import { RelationshipChips } from './RelationshipChips'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useCategories, useCategory } from '@/api/entities'
import type { CategoryDetailV2 } from '@/api/types'

interface ResourceFormProps {
  /** Callback when form is submitted with valid data */
  onSubmit: (data: ResourceFormData) => void
  /** Callback when cancel button is clicked */
  onCancel: () => void
  /** Whether the form is currently submitting */
  isSubmitting?: boolean
  /** Optional draft ID for entity resolution */
  draftId?: string
  /** Optional initial data to prefill the form (e.g., from nested create) */
  initialData?: Partial<ResourceFormData>
}

/**
 * Resource creation form with ID, Category selection, and dynamic fields.
 *
 * Features:
 * - Validates on blur (per CONTEXT.md)
 * - Create button disabled until form is valid
 * - ID field validates for generic entity pattern (becomes wiki page title)
 * - Category selection drives dynamic fields
 * - Dynamic fields populated from selected category's properties
 * - Category change resets dynamic fields
 *
 * Note: Resources don't have separate label/description - just ID (wiki title)
 * and category-driven fields.
 *
 * @example
 * ```tsx
 * <ResourceForm
 *   onSubmit={(data) => createResource(data)}
 *   onCancel={() => closeModal()}
 *   isSubmitting={mutation.isPending}
 *   draftId={currentDraftId}
 * />
 * ```
 */
export function ResourceForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
  draftId,
  initialData,
}: ResourceFormProps) {
  // Fetch available categories for selection
  const { data: categoriesData } = useCategories(undefined, undefined, draftId)
  const availableCategories = (categoriesData?.items || []).map((c) => ({
    key: c.entity_key,
    label: c.label,
  }))

  const form = useForm<ResourceFormData>({
    resolver: zodResolver(resourceSchema),
    mode: 'onBlur',
    defaultValues: {
      id: initialData?.id ?? '',
      category_keys: initialData?.category_keys ?? [],
      dynamic_fields: initialData?.dynamic_fields ?? {},
    },
  })

  const { isValid } = form.formState
  const selectedCategories = form.watch('category_keys')
  const dynamicFields = form.watch('dynamic_fields')

  // Fetch category detail for the first selected category (for dynamic fields)
  const primaryCategory = selectedCategories[0] || ''
  const { data: categoryData } = useCategory(primaryCategory, draftId)
  const categoryDetail = categoryData as CategoryDetailV2 | undefined

  // Handle category change
  const handleCategoryChange = (keys: string[]) => {
    form.setValue('category_keys', keys)
    form.setValue('dynamic_fields', {}) // Reset fields on category change
  }

  // Handle dynamic field value change
  const handleDynamicFieldChange = (propertyKey: string, value: string) => {
    const current = form.getValues('dynamic_fields') || {}
    form.setValue('dynamic_fields', { ...current, [propertyKey]: value })
  }

  // Get label for selected category
  const getCategoryLabel = (key: string) => {
    const found = availableCategories.find((c) => c.key === key)
    return found ? found.label : key
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Category selection at top (multi-select) */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1">
          Categories
          <span className="text-red-600">*</span>
        </Label>
        <EntityCombobox
          entityType="category"
          availableEntities={availableCategories}
          selectedKeys={selectedCategories}
          onChange={handleCategoryChange}
          placeholder="Select categories..."
        />
        {selectedCategories.length > 0 && (
          <RelationshipChips
            values={selectedCategories}
            onRemove={(key) =>
              handleCategoryChange(selectedCategories.filter((k) => k !== key))
            }
            getLabel={getCategoryLabel}
          />
        )}
      </div>

      {/* Dynamic fields section - appears after category selected */}
      {selectedCategories.length > 0 && (
        <div className="space-y-3 p-3 border rounded-md bg-muted/30">
          <Label className="text-sm font-medium text-muted-foreground">
            Category Fields
          </Label>
          {categoryDetail?.properties && categoryDetail.properties.length > 0 ? (
            <div className="space-y-3">
              {categoryDetail.properties.map((prop) => (
                <div key={prop.entity_key} className="space-y-1">
                  <Label className="flex items-center gap-1 text-sm">
                    {prop.label}
                    {prop.is_required && <span className="text-red-600">*</span>}
                  </Label>
                  <Input
                    value={String(dynamicFields?.[prop.entity_key] ?? '')}
                    onChange={(e) => handleDynamicFieldChange(prop.entity_key, e.target.value)}
                    placeholder={`Enter ${prop.label}...`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No properties defined for this category.
            </p>
          )}
        </div>
      )}

      {selectedCategories.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          Select a category to see available fields.
        </p>
      )}

      <FormField
        name="id"
        label="ID (Wiki Page Title)"
        required
        control={form.control}
        description="Page title format: starts uppercase, underscores between words"
        render={(field) => (
          <Input
            {...field}
            id="id"
            placeholder="My_Resource"
            autoComplete="off"
          />
        )}
      />

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
