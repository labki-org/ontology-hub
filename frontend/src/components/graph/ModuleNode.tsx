import { Handle, Position } from '@xyflow/react'
import { useNavigate } from 'react-router-dom'
import { Package } from 'lucide-react'

type ModuleNodeData = {
  label: string
  moduleId: string
  entityCount: number
  isCurrent?: boolean
  [key: string]: unknown
}

function ModuleNodeComponent({ data }: { data: ModuleNodeData }) {
  const navigate = useNavigate()

  return (
    <div
      className={`px-4 py-2 rounded-lg border-2 cursor-pointer min-w-[120px] text-center
        ${data.isCurrent ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}
        hover:border-blue-400 transition-colors`}
      onClick={() => navigate(`/module/${data.moduleId}`)}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <div className="flex items-center justify-center gap-1.5">
        <Package className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium text-sm">{data.label}</span>
      </div>
      <div className="text-xs text-gray-500 mt-0.5">
        {data.entityCount} {data.entityCount === 1 ? 'entity' : 'entities'}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  )
}

// Register outside component to prevent re-renders
// eslint-disable-next-line react-refresh/only-export-components -- nodeTypes must be stable
export const moduleNodeTypes = {
  module: ModuleNodeComponent,
}

export { ModuleNodeComponent }
