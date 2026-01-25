import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { bundleCreateSchema, type BundleCreateFormData } from './schemas'
import { FormField } from './FormField'
import { EntityCombobox } from './EntityCombobox'
import { RelationshipChips } from './RelationshipChips'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useModules } from '@/api/entitiesV2'

interface BundleFormProps {
  /** Callback when form is submitted with valid data */
  onSubmit: (data: BundleCreateFormData) => void
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
  initialData?: Partial<BundleCreateFormData>
}

/**
 * Bundle creation form with ID, Version, Label, Description, and Modules fields.
 *
 * Features:
 * - Validates on blur (per CONTEXT.md)
 * - Create button disabled until form is valid
 * - ID field validates for kebab-case format
 * - Version field for semantic versioning
 * - Uses relaxed bundleCreateSchema (allows creation without modules initially)
 * - EntityCombobox for module selection with cascading create support
 *
 * @example
 * ```tsx
 * <BundleForm
 *   onSubmit={(data) => createBundle(data)}
 *   onCancel={() => closeModal()}
 *   onCreateRelatedEntity={(type, id) => openCreateModal(type, id)}
 *   isSubmitting={mutation.isPending}
 *   draftId={currentDraftId}
 * />
 * ```
 */
export function BundleForm({
  onSubmit,
  onCancel,
  onCreateRelatedEntity,
  setOnNestedEntityCreated,
  isSubmitting = false,
  draftId,
  initialData,
}: BundleFormProps) {
  // Fetch available modules for selection
  const { data: modulesData } = useModules(undefined, undefined, draftId)
  const availableModules = (modulesData?.items || []).map((m) => ({
    key: m.entity_key,
    label: m.label,
  }))

  const form = useForm<BundleCreateFormData>({
    resolver: zodResolver(bundleCreateSchema),
    mode: 'onBlur',
    defaultValues: {
      id: initialData?.id ?? '',
      version: initialData?.version ?? '',
      label: initialData?.label ?? '',
      description: initialData?.description ?? '',
      modules: initialData?.modules ?? [],
    },
  })

  const { isValid } = form.formState

  // Helper to get label for a key
  const getLabel = (key: string) => {
    const found = availableModules.find((m) => m.key === key)
    return found ? found.label : key
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        name="id"
        label="ID"
        required
        control={form.control}
        description="Unique identifier for the bundle (lowercase, numbers, hyphens)"
        render={(field) => (
          <Input
            {...field}
            id="id"
            placeholder="bundle-name"
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
            placeholder="Bundle Name"
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
            placeholder="A brief description of this bundle..."
            rows={3}
          />
        )}
      />

      {/* Modules relationship field */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1">
          Modules
          <span className="text-muted-foreground text-xs font-normal ml-1">
            (add modules now or after creation)
          </span>
        </Label>
        <EntityCombobox
          entityType="module"
          availableEntities={availableModules}
          selectedKeys={form.watch('modules') || []}
          onChange={(keys) => form.setValue('modules', keys)}
          onCreateNew={
            onCreateRelatedEntity && setOnNestedEntityCreated
              ? (id) => {
                  setOnNestedEntityCreated((newKey: string) => {
                    const current = form.getValues('modules') || []
                    form.setValue('modules', [...current, newKey])
                  })
                  onCreateRelatedEntity('module', id)
                }
              : undefined
          }
          placeholder="Add module..."
        />
        <RelationshipChips
          values={form.watch('modules') || []}
          onRemove={(key) => {
            const current = form.getValues('modules') || []
            form.setValue(
              'modules',
              current.filter((k) => k !== key)
            )
          }}
          getLabel={getLabel}
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
        <Button type="submit" disabled={!isValid || isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create'}
        </Button>
      </div>
    </form>
  )
}
