import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InheritanceGraph } from '@/components/graph/InheritanceGraph'

export function GraphExplorerPage() {
  const { entityId } = useParams<{ entityId: string }>()

  if (!entityId) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">No entity selected</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link to={`/category/${entityId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to {entityId}
            </Button>
          </Link>
        </div>
        <h1 className="text-xl font-semibold">Inheritance Graph: {entityId}</h1>
      </div>
      <div className="flex-1 border rounded-lg overflow-hidden min-h-[500px]">
        <InheritanceGraph entityId={entityId} />
      </div>
    </div>
  )
}
