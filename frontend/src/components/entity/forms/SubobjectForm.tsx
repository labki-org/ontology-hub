import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { subobjectSchema, type SubobjectFormData } from './schemas'
import { FormField } from './FormField'
import { EntityCombobox } from './EntityCombobox'
import { RelationshipChips } from './RelationshipChips'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useProperties } from '@/api/entitiesV2'

interface SubobjectFormProps {
  /** Callback when form is submitted with valid data */
  onSubmit: (data: SubobjectFormData) => void
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
  initialData?: Partial<SubobjectFormData>
}

/**
 * Subobject creation form with ID, Label, and Description fields.
 *
 * Features:
 * - Validates on blur (per CONTEXT.md)
 * - Create button disabled until form is valid
 * - ID field validates for kebab-case format
 * - Properties relationship field handled in Plan 05 with EntityCombobox
 *
 * @example
 * ```tsx
 * <SubobjectForm
 *   onSubmit={(data) => createSubobject(data)}
 *   onCancel={() => closeModal()}
 *   isSubmitting={mutation.isPending}
 * />
 * ```
 */
export function SubobjectForm({
  onSubmit,
  onCancel,
  onCreateRelatedEntity,
  setOnNestedEntityCreated,
  isSubmitting = false,
  draftId,
  initialData,
}: SubobjectFormProps) {
  // Fetch available properties
  const { data: propertiesData } = useProperties(undefined, undefined, draftId)
  const availableProperties = (propertiesData?.items || []).map((p) => ({
    key: p.entity_key,
    label: p.label,
  }))

  const form = useForm<SubobjectFormData>({
    resolver: zodResolver(subobjectSchema),
    mode: 'onBlur',
    defaultValues: {
      id: initialData?.id ?? '',
      label: initialData?.label ?? '',
      description: initialData?.description ?? '',
      required_properties: initialData?.required_properties ?? [],
      optional_properties: initialData?.optional_properties ?? [],
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
            placeholder="Address_info"
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
            placeholder="Subobject Name"
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
            placeholder="A brief description of this subobject..."
            rows={3}
          />
        )}
      />

      {/* Properties Section */}
      <div className="space-y-4">
        <Label className="text-base font-semibold">Properties</Label>

        {/* Required Properties */}
        <div className="space-y-2">
          <Label className="text-sm">Required Properties</Label>
          <EntityCombobox
            entityType="property"
            availableEntities={availableProperties.filter(
              (p) =>
                !(form.watch('required_properties') || []).includes(p.key) &&
                !(form.watch('optional_properties') || []).includes(p.key)
            )}
            selectedKeys={[]}
            onChange={(keys) => {
              if (keys.length > 0) {
                const current = form.getValues('required_properties') || []
                form.setValue('required_properties', [...current, keys[0]])
              }
            }}
            onCreateNew={
              onCreateRelatedEntity && setOnNestedEntityCreated
                ? (id) => {
                    setOnNestedEntityCreated((newKey: string) => {
                      const current = form.getValues('required_properties') || []
                      form.setValue('required_properties', [...current, newKey])
                    })
                    onCreateRelatedEntity('property', id)
                  }
                : undefined
            }
            placeholder="Add required property..."
          />
          <RelationshipChips
            values={form.watch('required_properties') || []}
            onRemove={(key) => {
              const current = form.getValues('required_properties') || []
              form.setValue(
                'required_properties',
                current.filter((k) => k !== key)
              )
            }}
            getLabel={(key) => {
              const found = availableProperties.find((p) => p.key === key)
              return found ? found.label : key
            }}
          />
        </div>

        {/* Optional Properties */}
        <div className="space-y-2">
          <Label className="text-sm">Optional Properties</Label>
          <EntityCombobox
            entityType="property"
            availableEntities={availableProperties.filter(
              (p) =>
                !(form.watch('required_properties') || []).includes(p.key) &&
                !(form.watch('optional_properties') || []).includes(p.key)
            )}
            selectedKeys={[]}
            onChange={(keys) => {
              if (keys.length > 0) {
                const current = form.getValues('optional_properties') || []
                form.setValue('optional_properties', [...current, keys[0]])
              }
            }}
            onCreateNew={
              onCreateRelatedEntity && setOnNestedEntityCreated
                ? (id) => {
                    setOnNestedEntityCreated((newKey: string) => {
                      const current = form.getValues('optional_properties') || []
                      form.setValue('optional_properties', [...current, newKey])
                    })
                    onCreateRelatedEntity('property', id)
                  }
                : undefined
            }
            placeholder="Add optional property..."
          />
          <RelationshipChips
            values={form.watch('optional_properties') || []}
            onRemove={(key) => {
              const current = form.getValues('optional_properties') || []
              form.setValue(
                'optional_properties',
                current.filter((k) => k !== key)
              )
            }}
            getLabel={(key) => {
              const found = availableProperties.find((p) => p.key === key)
              return found ? found.label : key
            }}
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
