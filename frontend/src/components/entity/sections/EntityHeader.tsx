import { Badge } from '@/components/ui/badge'
import { EditableField } from '../form/EditableField'

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
  onRevertLabel,
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="capitalize">
          {entityType}
        </Badge>
        <code className="text-sm text-muted-foreground">{entityKey}</code>
        {statusBadge}
      </div>

      <EditableField
        value={label}
        originalValue={originalLabel}
        onChange={onLabelChange || (() => {})}
        onRevert={onRevertLabel}
        isEditing={isEditing && !!onLabelChange}
        label="Label"
        placeholder="Enter label..."
        className="text-2xl font-bold"
      />

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
