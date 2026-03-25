import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useQueries } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { resourceSchema, type ResourceFormData } from './schemas'
import { FormField } from './FormField'
import { EntityCombobox } from './EntityCombobox'
import { RelationshipChips } from './RelationshipChips'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useCategories } from '@/api/entities'
import { apiFetch } from '@/api/client'
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

  // Fetch category details for all selected categories (for dynamic fields)
  const categoryQueries = useQueries({
    queries: selectedCategories.map((catKey) => ({
      queryKey: ['v2', 'category', catKey, { draftId }],
      queryFn: () => apiFetch(`/categories/${catKey}${draftId ? `?draft_id=${draftId}` : ''}`, { v2: true }) as Promise<CategoryDetailV2>,
      enabled: !!catKey,
    })),
  })

  // Merge properties from all categories, deduplicating by entity_key
  const mergedProperties = useMemo(() => {
    const propMap = new Map<string, { entity_key: string; label: string; is_required: boolean }>()
    for (const query of categoryQueries) {
      const catDetail = query.data as CategoryDetailV2 | undefined
      if (!catDetail?.properties) continue
      for (const prop of catDetail.properties) {
        const existing = propMap.get(prop.entity_key)
        if (existing) {
          if (prop.is_required) existing.is_required = true
        } else {
          propMap.set(prop.entity_key, {
            entity_key: prop.entity_key,
            label: prop.label,
            is_required: prop.is_required,
          })
        }
      }
    }
    return Array.from(propMap.values()).sort((a, b) => {
      if (a.is_required !== b.is_required) return a.is_required ? -1 : 1
      return a.label.localeCompare(b.label)
    })
    // Stabilize on actual data content, not the query array reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryQueries.map((q) => q.data).join(',')])

  // Handle category change
  const handleCategoryChange = (keys: string[]) => {
    form.setValue('category_keys', keys, { shouldValidate: true })
    form.setValue('dynamic_fields', {})
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
          {mergedProperties.length > 0 ? (
            <div className="space-y-3">
              {mergedProperties.map((prop) => (
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
            <p className="text-xs text-muted-foreground/60">
              No properties defined for this category.
            </p>
          )}
        </div>
      )}

      {selectedCategories.length === 0 && (
        <p className="text-xs text-muted-foreground/60">
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
