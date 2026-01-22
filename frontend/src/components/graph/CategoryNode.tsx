import { Handle, Position } from '@xyflow/react'
import { useNavigate } from 'react-router-dom'

type CategoryNodeData = {
  label: string
  entityId: string
  isCurrent: boolean
  [key: string]: unknown
}

function CategoryNodeComponent({ data }: { data: CategoryNodeData }) {
  const navigate = useNavigate()

  return (
    <div
      className={`px-4 py-2 rounded-lg border-2 cursor-pointer min-w-[100px] text-center
        ${data.isCurrent ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}
        hover:border-blue-400 transition-colors`}
      onClick={() => navigate(`/category/${data.entityId}`)}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <div className="font-medium text-sm">{data.label}</div>
      <div className="text-xs text-gray-500">{data.entityId}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  )
}

// Register outside component to prevent re-renders
export const nodeTypes = {
  category: CategoryNodeComponent,
}

export { CategoryNodeComponent }
