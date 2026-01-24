import { Handle, Position } from '@xyflow/react'
import { useGraphStore } from '@/stores/graphStore'

type GraphNodeData = {
  label: string
  entity_key: string
  entity_type: string
  modules?: string[]
  change_status?: 'added' | 'modified' | 'deleted' | 'unchanged'
  [key: string]: unknown
}

/**
 * Custom React Flow node component for graph visualization.
 *
 * Features:
 * - Visual indicators for change_status (draft mode)
 * - Click handler to select entity in graphStore
 * - Styled based on entity_type and change_status
 */
function GraphNodeComponent({ data }: { data: GraphNodeData }) {
  const setSelectedEntity = useGraphStore((s) => s.setSelectedEntity)

  const handleClick = () => {
    setSelectedEntity(data.entity_key)
  }

  // Determine border color and style based on change_status
  const getBorderStyle = () => {
    switch (data.change_status) {
      case 'added':
        return 'border-green-500 shadow-green-200 shadow-md'
      case 'modified':
        return 'border-yellow-500 shadow-yellow-200 shadow-md'
      case 'deleted':
        return 'border-red-500 shadow-red-200 shadow-md'
      default:
        return 'border-gray-300'
    }
  }

  // Determine text style for deleted entities
  const getTextStyle = () => {
    if (data.change_status === 'deleted') {
      return 'line-through text-gray-400'
    }
    return ''
  }

  return (
    <div
      className={`px-4 py-2 rounded-lg border-2 cursor-pointer min-w-[120px] text-center bg-white
        ${getBorderStyle()}
        hover:border-blue-400 transition-colors`}
      onClick={handleClick}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <div className={`font-medium text-sm ${getTextStyle()}`}>{data.label}</div>
      <div className="text-xs text-gray-500">{data.entity_key}</div>
      {data.change_status && data.change_status !== 'unchanged' && (
        <div className="text-xs font-semibold mt-1">
          {data.change_status === 'added' && (
            <span className="text-green-600">Added</span>
          )}
          {data.change_status === 'modified' && (
            <span className="text-yellow-600">Modified</span>
          )}
          {data.change_status === 'deleted' && (
            <span className="text-red-600">Deleted</span>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  )
}

// Register outside component to prevent re-renders
export const graphNodeTypes = {
  entity: GraphNodeComponent,
}

export { GraphNodeComponent }
