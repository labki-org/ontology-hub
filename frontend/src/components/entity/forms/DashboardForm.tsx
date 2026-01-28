import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { dashboardSchema, type DashboardFormData } from './schemas'
import { FormField } from './FormField'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Plus, Trash2 } from 'lucide-react'

interface DashboardFormProps {
  /** Callback when form is submitted with valid data */
  onSubmit: (data: DashboardFormData) => void
  /** Callback when cancel button is clicked */
  onCancel: () => void
  /** Whether the form is currently submitting */
  isSubmitting?: boolean
  /** Optional draft ID for entity resolution */
  draftId?: string
  /** Optional initial data to prefill the form (e.g., from nested create) */
  initialData?: Partial<DashboardFormData>
}

/**
 * Dashboard creation form with ID, Label, Description, and Pages management.
 *
 * Features:
 * - Validates on blur (per CONTEXT.md)
 * - Create button disabled until form is valid
 * - ID field validates for generic entity pattern
 * - Pages section with accordion for one-at-a-time page expansion
 * - Auto-creates root page (empty name) on init
 * - Add/remove pages with wikitext editing
 *
 * @example
 * ```tsx
 * <DashboardForm
 *   onSubmit={(data) => createDashboard(data)}
 *   onCancel={() => closeModal()}
 *   isSubmitting={mutation.isPending}
 *   draftId={currentDraftId}
 * />
 * ```
 */
export function DashboardForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
  initialData,
}: DashboardFormProps) {
  const form = useForm<DashboardFormData>({
    resolver: zodResolver(dashboardSchema),
    mode: 'onBlur',
    defaultValues: {
      id: initialData?.id ?? '',
      label: initialData?.label ?? '',
      description: initialData?.description ?? '',
      // Root page auto-created: empty name string = root page
      pages: initialData?.pages ?? [{ name: '', wikitext: '' }],
    },
  })

  const { isValid } = form.formState
  const pages = form.watch('pages')

  // Add a new page with auto-generated name
  const handleAddPage = () => {
    const currentPages = form.getValues('pages')
    const newPageName = `page-${currentPages.length}`
    form.setValue('pages', [...currentPages, { name: newPageName, wikitext: '' }], {
      shouldValidate: true,
    })
  }

  // Remove a page by index (only for non-root pages, index > 0)
  const handleRemovePage = (index: number) => {
    if (index === 0) return // Don't allow removing root page
    const currentPages = form.getValues('pages')
    form.setValue(
      'pages',
      currentPages.filter((_, i) => i !== index),
      { shouldValidate: true }
    )
  }

  // Update page name (only for non-root pages, index > 0)
  const handlePageNameChange = (index: number, name: string) => {
    if (index === 0) return // Root page name stays empty
    const currentPages = form.getValues('pages')
    const updated = [...currentPages]
    updated[index] = { ...updated[index], name }
    form.setValue('pages', updated, { shouldValidate: true })
  }

  // Update page wikitext
  const handlePageWikitextChange = (index: number, wikitext: string) => {
    const currentPages = form.getValues('pages')
    const updated = [...currentPages]
    updated[index] = { ...updated[index], wikitext }
    form.setValue('pages', updated, { shouldValidate: true })
  }

  // Get display name for page (root page has empty string name)
  const getPageDisplayName = (page: { name: string; wikitext: string }): string => {
    return page.name || '(Root Page)'
  }

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
            placeholder="My_dashboard"
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
            placeholder="Dashboard Name"
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
            placeholder="A brief description of this dashboard..."
            rows={3}
          />
        )}
      />

      {/* Pages Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">
            Pages ({pages.length})
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddPage}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Add Page
          </Button>
        </div>

        {pages.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No pages defined. At least one page is required.
          </p>
        ) : (
          <Accordion type="single" collapsible className="w-full border rounded-md">
            {pages.map((page, index) => (
              <AccordionItem key={`page-${index}`} value={`page-${index}`}>
                <AccordionTrigger className="px-4 text-sm font-medium">
                  <div className="flex items-center gap-2">
                    {getPageDisplayName(page)}
                    {index === 0 && (
                      <span className="text-xs text-muted-foreground">(required)</span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 space-y-3">
                  {/* Page name field (not for root page) */}
                  {index > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor={`page-name-${index}`} className="text-sm">
                        Page Name
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id={`page-name-${index}`}
                          value={page.name}
                          onChange={(e) => handlePageNameChange(index, e.target.value)}
                          placeholder="Page name"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => handleRemovePage(index)}
                          title="Remove page"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Wikitext field */}
                  <div className="space-y-2">
                    <Label htmlFor={`page-wikitext-${index}`} className="text-sm">
                      Wikitext
                    </Label>
                    <Textarea
                      id={`page-wikitext-${index}`}
                      value={page.wikitext}
                      onChange={(e) => handlePageWikitextChange(index, e.target.value)}
                      placeholder="Enter wikitext content..."
                      className="min-h-[150px] font-mono text-sm"
                      rows={6}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
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
