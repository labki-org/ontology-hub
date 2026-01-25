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
  onRevertLabel?: () => void
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
  onRevertLabel: _onRevertLabel,
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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="capitalize">
          {entityType}
        </Badge>
        <code className="text-sm text-muted-foreground">{entityKey}</code>
        {statusBadge}
      </div>

      {/* Label field - uses InlineEditField for hover-reveal editing */}
      <VisualChangeMarker
        status={labelChangeStatus}
        originalValue={originalLabel}
        className="text-2xl font-bold"
      >
        <InlineEditField
          value={label}
          onSave={onLabelChange || (() => {})}
          isEditable={isEditing && !!onLabelChange}
          label="Label"
          placeholder="Enter label..."
        />
      </VisualChangeMarker>

      {/* Description field - keeps EditableField for multiline support */}
      <EditableField
        value={description || ''}
        originalValue={originalDescription}
        onChange={onDescriptionChange || (() => {})}
        onRevert={onRevertDescription}
        isEditing={isEditing && !!onDescriptionChange}
        multiline
        label="Description"
        placeholder="Enter description..."
      />
    </div>
  )
}
