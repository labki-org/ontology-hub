import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { moduleCreateSchema, type ModuleCreateFormData } from './schemas'
import { FormField } from './FormField'
import { EntityCombobox } from './EntityCombobox'
import { RelationshipChips } from './RelationshipChips'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  useCategories,
  useProperties,
  useSubobjects,
  useTemplates,
} from '@/api/entitiesV2'

interface ModuleFormProps {
  /** Callback when form is submitted with valid data */
  onSubmit: (data: ModuleCreateFormData) => void
  /** Callback when cancel button is clicked */
  onCancel: () => void
  /** Callback when user wants to create a related entity */
  onCreateRelatedEntity?: (type: string, id: string) => void
  /** Whether the form is currently submitting */
  isSubmitting?: boolean
  /** Optional draft ID for entity resolution */
  draftId?: string
  /** Optional initial data to prefill the form (e.g., from nested create) */
  initialData?: Partial<ModuleCreateFormData>
}

/**
 * Module creation form with ID, Version, Label, Description, and entity relationship fields.
 *
 * Features:
 * - Validates on blur (per CONTEXT.md)
 * - Create button disabled until form is valid
 * - ID field validates for kebab-case format
 * - Version field for semantic versioning
 * - Uses relaxed moduleCreateSchema (allows creation without entities)
 * - EntityCombobox for categories, properties, subobjects, and templates
 *
 * @example
 * ```tsx
 * <ModuleForm
 *   onSubmit={(data) => createModule(data)}
 *   onCancel={() => closeModal()}
 *   onCreateRelatedEntity={(type, id) => openCreateModal(type, id)}
 *   isSubmitting={mutation.isPending}
 *   draftId={currentDraftId}
 * />
 * ```
 */
export function ModuleForm({
  onSubmit,
  onCancel,
  onCreateRelatedEntity,
  isSubmitting = false,
  draftId,
  initialData,
}: ModuleFormProps) {
  // Fetch available entities for relationship selection
  const { data: categoriesData } = useCategories(undefined, undefined, draftId)
  const { data: propertiesData } = useProperties(undefined, undefined, draftId)
  const { data: subobjectsData } = useSubobjects(undefined, undefined, draftId)
  const { data: templatesData } = useTemplates(undefined, undefined, draftId)

  const availableCategories = (categoriesData?.items || []).map((c) => ({
    key: c.entity_key,
    label: c.label,
  }))
  const availableProperties = (propertiesData?.items || []).map((p) => ({
    key: p.entity_key,
    label: p.label,
  }))
  const availableSubobjects = (subobjectsData?.items || []).map((s) => ({
    key: s.entity_key,
    label: s.label,
  }))
  const availableTemplates = (templatesData?.items || []).map((t) => ({
    key: t.entity_key,
    label: t.label,
  }))

  // Helper to get label for a key from available entities
  const getLabel = (
    key: string,
    available: Array<{ key: string; label: string }>
  ) => {
    const found = available.find((e) => e.key === key)
    return found ? found.label : key
  }

  const form = useForm<ModuleCreateFormData>({
    resolver: zodResolver(moduleCreateSchema),
    mode: 'onBlur',
    defaultValues: {
      id: initialData?.id ?? '',
      version: initialData?.version ?? '',
      label: initialData?.label ?? '',
      description: initialData?.description ?? '',
      categories: initialData?.categories ?? [],
      properties: initialData?.properties ?? [],
      subobjects: initialData?.subobjects ?? [],
      templates: initialData?.templates ?? [],
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
        description="Unique identifier for the module (lowercase, numbers, hyphens)"
        render={(field) => (
          <Input
            {...field}
            id="id"
            placeholder="module-name"
            autoComplete="off"
          />
        )}
      />

      <FormField
        name="version"
        label="Version"
        required
        control={form.control}
        description="Semantic version (e.g., 1.0.0)"
        render={(field) => (
          <Input
            {...field}
            id="version"
            placeholder="1.0.0"
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
            placeholder="Module Name"
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
            placeholder="A brief description of this module..."
            rows={3}
          />
        )}
      />

      {/* Entity relationship fields */}
      <div className="space-y-4 border-t pt-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Included Entities</p>
          <p className="text-sm text-muted-foreground">
            Optionally add categories, properties, subobjects, or templates
          </p>
        </div>

        {/* Categories */}
        <div className="space-y-2">
          <Label>Categories</Label>
          <EntityCombobox
            entityType="category"
            availableEntities={availableCategories}
            selectedKeys={form.watch('categories') || []}
            onChange={(keys) => form.setValue('categories', keys)}
            onCreateNew={(id) => onCreateRelatedEntity?.('category', id)}
            placeholder="Add category..."
          />
          <RelationshipChips
            values={form.watch('categories') || []}
            onRemove={(key) => {
              const current = form.getValues('categories') || []
              form.setValue(
                'categories',
                current.filter((k) => k !== key)
              )
            }}
            getLabel={(key) => getLabel(key, availableCategories)}
          />
        </div>

        {/* Properties */}
        <div className="space-y-2">
          <Label>Properties</Label>
          <EntityCombobox
            entityType="property"
            availableEntities={availableProperties}
            selectedKeys={form.watch('properties') || []}
            onChange={(keys) => form.setValue('properties', keys)}
            onCreateNew={(id) => onCreateRelatedEntity?.('property', id)}
            placeholder="Add property..."
          />
          <RelationshipChips
            values={form.watch('properties') || []}
            onRemove={(key) => {
              const current = form.getValues('properties') || []
              form.setValue(
                'properties',
                current.filter((k) => k !== key)
              )
            }}
            getLabel={(key) => getLabel(key, availableProperties)}
          />
        </div>

        {/* Subobjects */}
        <div className="space-y-2">
          <Label>Subobjects</Label>
          <EntityCombobox
            entityType="subobject"
            availableEntities={availableSubobjects}
            selectedKeys={form.watch('subobjects') || []}
            onChange={(keys) => form.setValue('subobjects', keys)}
            onCreateNew={(id) => onCreateRelatedEntity?.('subobject', id)}
            placeholder="Add subobject..."
          />
          <RelationshipChips
            values={form.watch('subobjects') || []}
            onRemove={(key) => {
              const current = form.getValues('subobjects') || []
              form.setValue(
                'subobjects',
                current.filter((k) => k !== key)
              )
            }}
            getLabel={(key) => getLabel(key, availableSubobjects)}
          />
        </div>

        {/* Templates */}
        <div className="space-y-2">
          <Label>Templates</Label>
          <EntityCombobox
            entityType="template"
            availableEntities={availableTemplates}
            selectedKeys={form.watch('templates') || []}
            onChange={(keys) => form.setValue('templates', keys)}
            onCreateNew={(id) => onCreateRelatedEntity?.('template', id)}
            placeholder="Add template..."
          />
          <RelationshipChips
            values={form.watch('templates') || []}
            onRemove={(key) => {
              const current = form.getValues('templates') || []
              form.setValue(
                'templates',
                current.filter((k) => k !== key)
              )
            }}
            getLabel={(key) => getLabel(key, availableTemplates)}
          />
        </div>
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
        <Button type="submit" disabled={!isValid || isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create'}
        </Button>
      </div>
    </form>
  )
}
