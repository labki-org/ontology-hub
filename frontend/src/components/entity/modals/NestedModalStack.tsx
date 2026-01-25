import { useEffect } from 'react'
import { useDraftStoreV2 } from '@/stores/draftStoreV2'
import { useCreateEntityChange } from '@/api/draftApiV2'
import { CreateEntityModal } from './CreateEntityModal'
import { CategoryForm } from '../forms/CategoryForm'
import { PropertyForm } from '../forms/PropertyForm'
import { SubobjectForm } from '../forms/SubobjectForm'
import { TemplateForm } from '../forms/TemplateForm'
import { ModuleForm } from '../forms/ModuleForm'
import { BundleForm } from '../forms/BundleForm'

interface NestedModalStackProps {
  draftToken: string
}

/**
 * Handles the nested create modal for cascading entity creation.
 * When user clicks "Create [entity]" from a relationship combobox,
 * this modal opens on top of the primary create modal.
 *
 * After creation, the new entity key is passed back to the parent
 * form via the onNestedEntityCreated callback.
 *
 * Features:
 * - Prefills ID from autocomplete input
 * - Shows context hint about parent entity/field
 * - Limited to 1 level of nesting (nested forms don't allow further nesting)
 * - Reuses CreateEntityModal for consistent styling
 */
export function NestedModalStack({ draftToken }: NestedModalStackProps) {
  const nestedCreateModal = useDraftStoreV2((s) => s.nestedCreateModal)
  const closeNestedCreateModal = useDraftStoreV2((s) => s.closeNestedCreateModal)
  const onNestedEntityCreated = useDraftStoreV2((s) => s.onNestedEntityCreated)
  const setOnNestedEntityCreated = useDraftStoreV2((s) => s.setOnNestedEntityCreated)

  const createEntity = useCreateEntityChange(draftToken)

  // Clean up callback on unmount
  useEffect(() => {
    return () => setOnNestedEntityCreated(null)
  }, [setOnNestedEntityCreated])

  const handleSubmit = async (data: Record<string, unknown>) => {
    if (!nestedCreateModal.entityType) return

    try {
      await createEntity.mutateAsync({
        entityType: nestedCreateModal.entityType,
        entityKey: data.id as string,
        data,
      })

      // Notify parent form about new entity
      if (onNestedEntityCreated) {
        onNestedEntityCreated(data.id as string)
      }

      closeNestedCreateModal()
    } catch (error) {
      console.error('Failed to create nested entity:', error)
    }
  }

  const { entityType, prefilledId, parentContext } = nestedCreateModal

  // Build title with context
  const title = entityType
    ? `Create ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`
    : ''

  const contextHint = parentContext
    ? `Creating ${entityType} for ${parentContext.entityType}'s ${parentContext.fieldName}`
    : ''

  // Initial data with prefilled ID
  const initialData = prefilledId ? { id: prefilledId } : undefined

  return (
    <CreateEntityModal
      isOpen={nestedCreateModal.isOpen}
      onClose={closeNestedCreateModal}
      title={title}
    >
      {/* Context breadcrumb */}
      {contextHint && (
        <p className="text-sm text-muted-foreground mb-4 italic">
          {contextHint}
        </p>
      )}

      {entityType === 'category' && (
        <CategoryForm
          onSubmit={handleSubmit}
          onCancel={closeNestedCreateModal}
          isSubmitting={createEntity.isPending}
          initialData={initialData}
          draftId={draftToken}
          // Don't allow nested-nested create (limit to 1 level)
        />
      )}
      {entityType === 'property' && (
        <PropertyForm
          onSubmit={handleSubmit}
          onCancel={closeNestedCreateModal}
          isSubmitting={createEntity.isPending}
          initialData={initialData}
        />
      )}
      {entityType === 'subobject' && (
        <SubobjectForm
          onSubmit={handleSubmit}
          onCancel={closeNestedCreateModal}
          isSubmitting={createEntity.isPending}
          initialData={initialData}
        />
      )}
      {entityType === 'template' && (
        <TemplateForm
          onSubmit={handleSubmit}
          onCancel={closeNestedCreateModal}
          isSubmitting={createEntity.isPending}
          initialData={initialData}
        />
      )}
      {entityType === 'module' && (
        <ModuleForm
          onSubmit={handleSubmit}
          onCancel={closeNestedCreateModal}
          isSubmitting={createEntity.isPending}
          initialData={initialData}
          draftId={draftToken}
          // Don't allow nested-nested create (limit to 1 level)
        />
      )}
      {entityType === 'bundle' && (
        <BundleForm
          onSubmit={handleSubmit}
          onCancel={closeNestedCreateModal}
          isSubmitting={createEntity.isPending}
          initialData={initialData}
          draftId={draftToken}
          // Don't allow nested-nested create (limit to 1 level)
        />
      )}
    </CreateEntityModal>
  )
}
