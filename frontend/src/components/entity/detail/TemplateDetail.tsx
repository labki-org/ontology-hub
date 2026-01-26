import { useEffect, useState, useCallback, useRef } from 'react'
import { useTemplate } from '@/api/entitiesV2'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useDetailStore } from '@/stores/detailStore'
import { EntityHeader } from '../sections/EntityHeader'
import { AccordionSection } from '../sections/AccordionSection'
import { MembershipSection } from '../sections/MembershipSection'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { VisualChangeMarker } from '../form/VisualChangeMarker'
import type { TemplateDetailV2 } from '@/api/types'

interface TemplateDetailProps {
  entityKey: string
  draftId?: string
  draftToken?: string
  isEditing: boolean
}

/**
 * Template detail view with:
 * - Header (name, label, description)
 * - Wikitext content display (read-only view)
 * - Wikitext editor in draft mode (simple text area)
 * - Module membership display
 *
 * Per CONTEXT.md: Claude's discretion on display approach.
 * Using simple preformatted text for view mode, textarea for edit.
 */
export function TemplateDetail({
  entityKey,
  draftId,
  draftToken,
  isEditing,
}: TemplateDetailProps) {
  const { data, isLoading, error } = useTemplate(entityKey, draftId)
  const pushBreadcrumb = useDetailStore((s) => s.pushBreadcrumb)

  // Cast to TemplateDetailV2
  const template = data as TemplateDetailV2 | undefined

  // Track original values
  const [originalValues, setOriginalValues] = useState<{
    label?: string
    description?: string
    wikitext?: string
  }>({})

  // Local editable state
  const [editedLabel, setEditedLabel] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [editedWikitext, setEditedWikitext] = useState('')

  // Track which entity we've initialized original values for (prevent reset on refetch)
  const initializedEntityRef = useRef<string | null>(null)

  // Auto-save hook
  const { saveChange, isSaving } = useAutoSave({
    draftToken: draftToken || '',
    entityType: 'template',
    entityKey,
    debounceMs: 500,
  })

  // Initialize state
  useEffect(() => {
    if (template) {
      const isNewEntity = initializedEntityRef.current !== entityKey

      // Only reset edited values and original values for a NEW entity
      // (not on refetch after auto-save)
      if (isNewEntity) {
        setEditedLabel(template.label)
        setEditedDescription(template.description || '')
        setEditedWikitext(template.wikitext || '')

        setOriginalValues({
          label: template.label,
          description: template.description || '',
          wikitext: template.wikitext || '',
        })

        initializedEntityRef.current = entityKey
      }

      // Always update breadcrumbs
      pushBreadcrumb(entityKey, 'template', template.label)
    }
  }, [template, entityKey, pushBreadcrumb])

  // Change handlers
  const handleLabelChange = useCallback(
    (value: string) => {
      setEditedLabel(value)
      if (draftToken) saveChange([{ op: 'replace', path: '/label', value }])
    },
    [draftId, saveChange]
  )

  const handleDescriptionChange = useCallback(
    (value: string) => {
      setEditedDescription(value)
      if (draftToken) saveChange([{ op: 'replace', path: '/description', value }])
    },
    [draftId, saveChange]
  )

  const handleWikitextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      setEditedWikitext(value)
      if (draftToken) saveChange([{ op: 'replace', path: '/wikitext', value }])
    },
    [draftId, saveChange]
  )

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !template) {
    return (
      <div className="p-6 text-center text-destructive">
        <p className="font-medium">Failed to load template</p>
        <p className="text-sm text-muted-foreground mt-1">
          {error instanceof Error ? error.message : 'Template not found'}
        </p>
      </div>
    )
  }

  const isWikitextModified = editedWikitext !== originalValues.wikitext

  return (
    <div className="p-6 space-y-6">
      {isSaving && (
        <div className="fixed top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded text-sm">
          Saving...
        </div>
      )}

      {/* Header */}
      <EntityHeader
        entityKey={entityKey}
        label={editedLabel}
        description={editedDescription}
        entityType="template"
        changeStatus={template.change_status}
        isEditing={isEditing}
        originalLabel={originalValues.label}
        originalDescription={originalValues.description}
        onLabelChange={handleLabelChange}
        onDescriptionChange={handleDescriptionChange}
      />

      {/* Wikitext Content */}
      <AccordionSection id="wikitext" title="Wikitext Content">
        {isEditing ? (
          <VisualChangeMarker
            status={isWikitextModified ? 'modified' : 'unchanged'}
            originalValue={originalValues.wikitext}
          >
            <Textarea
              value={editedWikitext}
              onChange={handleWikitextChange}
              className="min-h-[300px] font-mono text-sm"
              placeholder="Enter wikitext content..."
            />
          </VisualChangeMarker>
        ) : (
          <VisualChangeMarker
            status={isWikitextModified ? 'modified' : 'unchanged'}
            originalValue={originalValues.wikitext}
          >
            <div className="bg-muted/30 rounded-md p-4">
              {editedWikitext ? (
                <pre className="whitespace-pre-wrap font-mono text-sm overflow-x-auto">
                  {editedWikitext}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No wikitext content
                </p>
              )}
            </div>
          </VisualChangeMarker>
        )}
      </AccordionSection>

      {/* Module membership - TODO: needs API */}
      <MembershipSection modules={[]} bundles={[]} />
    </div>
  )
}
