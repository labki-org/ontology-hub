import { Badge } from '@/components/ui/badge'
import { EditableField } from '../form/EditableField'
import { InlineEditField } from '../form/InlineEditField'
import { VisualChangeMarker } from '../form/VisualChangeMarker'

type ChangeStatus = 'added' | 'modified' | 'deleted' | 'unchanged'

interface EntityHeaderProps {
  entityKey: string
  label: string
  description?: string | null
  entityType: string
  changeStatus?: ChangeStatus
  isEditing: boolean
  originalLabel?: string
  originalDescription?: string
  onLabelChange?: (value: string) => void
  onDescriptionChange?: (value: string) => void
  onRevertDescription?: () => void
}

/**
 * Shared header component for all entity detail pages.
 * Shows name, label, description with edit capability and change status badge.
 */
export function EntityHeader({
  entityKey,
  label,
  description,
  entityType,
  changeStatus,
  isEditing,
  originalLabel,
  originalDescription,
  onLabelChange,
  onDescriptionChange,
  onRevertDescription,
}: EntityHeaderProps) {
  const statusBadge = changeStatus && changeStatus !== 'unchanged' && (
    <Badge
      variant={
        changeStatus === 'added'
          ? 'default'
          : changeStatus === 'modified'
          ? 'secondary'
          : 'destructive'
      }
      className={
        changeStatus === 'added'
          ? 'bg-green-500 hover:bg-green-600'
          : changeStatus === 'modified'
          ? 'bg-yellow-500 hover:bg-yellow-600'
          : ''
      }
    >
      {changeStatus === 'added'
        ? '+ Added'
        : changeStatus === 'modified'
        ? '~ Modified'
        : '- Deleted'}
    </Badge>
  )

  // Determine if label has been modified from original
  const isLabelModified = originalLabel !== undefined && label !== originalLabel
  const labelChangeStatus = isLabelModified ? 'modified' : 'unchanged'

  return (
    <div className="pb-4 mb-2 border-b">
      {/* Meta line */}
      <div className="flex items-center gap-2 mb-1">
        <Badge variant="outline" className="capitalize text-[11px] py-0">
          {entityType}
        </Badge>
        <code className="text-[11px] text-muted-foreground/60">{entityKey}</code>
        {statusBadge}
      </div>

      {/* Entity name — largest text in the panel, no "Label:" prefix */}
      <VisualChangeMarker
        status={labelChangeStatus}
        originalValue={originalLabel}
        className="text-xl font-bold leading-tight"
      >
        <InlineEditField
          value={label}
          onSave={onLabelChange || (() => {})}
          isEditable={isEditing && !!onLabelChange}
          placeholder="Enter label..."
        />
      </VisualChangeMarker>

      {/* Description — plain text, no "Description:" prefix */}
      {(description || isEditing) && (
        <div className="mt-1">
          <EditableField
            value={description || ''}
            originalValue={originalDescription}
            onChange={onDescriptionChange || (() => {})}
            onRevert={onRevertDescription}
            isEditing={isEditing && !!onDescriptionChange}
            multiline
            placeholder="Enter description..."
          />
        </div>
      )}
    </div>
  )
}
