import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { templateSchema, type TemplateFormData } from './schemas'
import { FormField } from './FormField'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

interface TemplateFormProps {
  /** Callback when form is submitted with valid data */
  onSubmit: (data: TemplateFormData) => void
  /** Callback when cancel button is clicked */
  onCancel: () => void
  /** Whether the form is currently submitting */
  isSubmitting?: boolean
  /** Optional initial data to prefill the form (e.g., from nested create) */
  initialData?: Partial<TemplateFormData>
}

/**
 * Template creation form with ID, Label, Description, and Wikitext fields.
 *
 * Features:
 * - Validates on blur (per CONTEXT.md)
 * - Create button disabled until form is valid
 * - ID field validates for kebab-case format
 * - Wikitext field with monospace font for MediaWiki template syntax
 *
 * @example
 * ```tsx
 * <TemplateForm
 *   onSubmit={(data) => createTemplate(data)}
 *   onCancel={() => closeModal()}
 *   isSubmitting={mutation.isPending}
 * />
 * ```
 */
export function TemplateForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
  initialData,
}: TemplateFormProps) {
  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    mode: 'onBlur',
    defaultValues: {
      id: initialData?.id ?? '',
      label: initialData?.label ?? '',
      description: initialData?.description ?? '',
      wikitext: initialData?.wikitext ?? '',
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
            placeholder="Infobox_template"
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
            placeholder="Template Name"
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
            placeholder="A brief description of this template..."
            rows={3}
          />
        )}
      />

      <FormField
        name="wikitext"
        label="Wikitext"
        required
        control={form.control}
        description="MediaWiki template syntax"
        render={(field) => (
          <Textarea
            {...field}
            id="wikitext"
            placeholder="{{#template:...}}"
            className="font-mono min-h-[150px]"
            rows={6}
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
