import { useInternalNode, BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react'
import { NODE_SIZES } from './GraphNode'

const PADDING = 16 // must match GraphNode padding

/**
 * Compute the center of a node's SVG shape in absolute coordinates.
 * The React Flow node element has dimensions (size + 2*padding) x (size + 2*padding),
 * and positionAbsolute is the top-left corner.
 */
function getNodeCenter(
  posAbsolute: { x: number; y: number },
  entityType: string,
) {
  const size = NODE_SIZES[entityType] ?? 50
  const svgSize = size + PADDING * 2
  return { x: posAbsolute.x + svgSize / 2, y: posAbsolute.y + svgSize / 2 }
}

/**
 * Given a node center and a target point, return the point on the node's
 * circular bounding region (radius = size/2) in the direction of the target.
 */
function getPerimeterPoint(
  center: { x: number; y: number },
  target: { x: number; y: number },
  entityType: string,
) {
  const radius = (NODE_SIZES[entityType] ?? 50) / 2
  const dx = target.x - center.x
  const dy = target.y - center.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist === 0) return { x: center.x, y: center.y + radius }
  return {
    x: center.x + (dx / dist) * radius,
    y: center.y + (dy / dist) * radius,
  }
}

/**
 * Custom floating edge that connects at the nearest perimeter point of each
 * node rather than fixed top/bottom handles.  This avoids edge paths wrapping
 * awkwardly around nodes in radial/hybrid layouts.
 */
export function FloatingEdge({
  id,
  source,
  target,
  style,
  markerEnd,
}: EdgeProps) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)

  if (!sourceNode || !targetNode) return null

  const sourceType = (sourceNode.data?.entity_type as string) ?? 'category'
  const targetType = (targetNode.data?.entity_type as string) ?? 'category'

  const sourceCenter = getNodeCenter(sourceNode.internals.positionAbsolute, sourceType)
  const targetCenter = getNodeCenter(targetNode.internals.positionAbsolute, targetType)

  const sourcePoint = getPerimeterPoint(sourceCenter, targetCenter, sourceType)
  const targetPoint = getPerimeterPoint(targetCenter, sourceCenter, targetType)

  const [path] = getStraightPath({
    sourceX: sourcePoint.x,
    sourceY: sourcePoint.y,
    targetX: targetPoint.x,
    targetY: targetPoint.y,
  })

  return <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
}
