import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { moduleCreateSchema, type ModuleCreateFormData } from './schemas'
import { FormField } from './FormField'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface ModuleFormProps {
  /** Callback when form is submitted with valid data */
  onSubmit: (data: ModuleCreateFormData) => void
  /** Callback when cancel button is clicked */
  onCancel: () => void
  /** Whether the form is currently submitting */
  isSubmitting?: boolean
}

/**
 * Module creation form with ID, Version, Label, and Description fields.
 *
 * Features:
 * - Validates on blur (per CONTEXT.md)
 * - Create button disabled until form is valid
 * - ID field validates for kebab-case format
 * - Version field for semantic versioning
 * - Uses relaxed moduleCreateSchema (entities added after creation)
 * - Entity relationships (categories, properties, subobjects, templates)
 *   will be managed via EntityCombobox in Plan 05
 *
 * @example
 * ```tsx
 * <ModuleForm
 *   onSubmit={(data) => createModule(data)}
 *   onCancel={() => closeModal()}
 *   isSubmitting={mutation.isPending}
 * />
 * ```
 */
export function ModuleForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ModuleFormProps) {
  const form = useForm<ModuleCreateFormData>({
    resolver: zodResolver(moduleCreateSchema),
    mode: 'onBlur',
    defaultValues: {
      id: '',
      version: '',
      label: '',
      description: '',
      categories: [],
      properties: [],
      subobjects: [],
      templates: [],
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

      {/* Placeholder - entity relationships will use EntityCombobox in Plan 05 */}
      <div className="space-y-2 rounded-md border border-dashed border-muted-foreground/30 p-4">
        <Label className="text-muted-foreground">Included Entities</Label>
        <p className="text-sm text-muted-foreground">
          Add categories, properties, subobjects, or templates after creation.
        </p>
      </div>

      {/* Form-level error display (for superRefine validation when editing) */}
      {form.formState.errors.root && (
        <p className="text-sm text-red-600 dark:text-red-500" role="alert">
          {form.formState.errors.root.message}
        </p>
      )}

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
