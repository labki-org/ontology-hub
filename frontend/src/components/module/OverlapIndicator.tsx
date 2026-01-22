import { Link } from 'react-router-dom'
import { Info } from 'lucide-react'

interface OverlapIndicatorProps {
  otherModuleIds: string[]
}

/**
 * Shows which other modules contain this entity.
 * Uses neutral info style (blue/gray) - not a warning, just information.
 */
export function OverlapIndicator({ otherModuleIds }: OverlapIndicatorProps) {
  if (otherModuleIds.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 text-blue-500/70" />
      <span>also in:</span>
      {otherModuleIds.map((moduleId, index) => (
        <span key={moduleId}>
          {index > 0 && <span>, </span>}
          <Link
            to={`/module/${moduleId}`}
            className="text-blue-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {moduleId}
          </Link>
        </span>
      ))}
    </div>
  )
}
