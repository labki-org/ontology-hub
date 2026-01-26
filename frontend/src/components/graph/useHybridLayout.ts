import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  forceRadial,
} from 'd3-force'
import dagre from '@dagrejs/dagre'
import type { Node, Edge } from '@xyflow/react'
import type { LayoutAlgorithm, LayoutDirection } from '@/stores/graphStore'

const NODE_WIDTH = 172
const NODE_HEIGHT = 36

interface HybridLayoutOptions {
  algorithm: LayoutAlgorithm
  direction: LayoutDirection
}

interface D3Node {
  id: string
  x?: number
  y?: number
  vx?: number
  vy?: number
  targetX?: number // Dagre-assigned X position for force constraint
  targetY?: number // Dagre-assigned Y position for force constraint
}

/**
 * Hybrid layout hook that combines dagre hierarchical layout with d3-force.
 *
 * Algorithms:
 * - 'dagre': Pure hierarchical layout using dagre
 * - 'force': Pure force-directed layout using d3-force
 * - 'hybrid': Dagre for initial positions + force with constraints
 *
 * The hybrid mode:
 * 1. Separates nodes into connected vs orphans (nodes with no edges)
 * 2. Runs dagre on parent edges to establish hierarchical structure
 * 3. Applies d3-force with Y constraints to maintain hierarchy
 * 4. Positions orphan nodes in a grid below the main graph
 */
export function useHybridLayout(
  initialNodes: Node[],
  edges: Edge[],
  options: HybridLayoutOptions
) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const simulationRef = useRef<ReturnType<typeof forceSimulation<D3Node>> | null>(null)
  const d3NodesRef = useRef<D3Node[]>([])

  const { algorithm, direction } = options

  // Memoize the layout computation to avoid unnecessary recalculations
  const layoutKey = useMemo(
    () => `${initialNodes.map(n => n.id).join(',')}-${edges.map(e => `${e.source}-${e.target}`).join(',')}-${algorithm}-${direction}`,
    [initialNodes, edges, algorithm, direction]
  )

  useEffect(() => {
    if (!initialNodes.length) {
      setNodes([])
      d3NodesRef.current = []
      return
    }

    let positionedNodes: Node[]

    if (algorithm === 'dagre') {
      positionedNodes = applyDagreLayout(initialNodes, edges, direction)
    } else if (algorithm === 'force') {
      positionedNodes = applyForceLayout(initialNodes, edges)
    } else if (algorithm === 'radial') {
      positionedNodes = applyRadialLayout(initialNodes, edges, simulationRef, d3NodesRef)
    } else {
      // Hybrid: dagre + force constraints
      positionedNodes = applyHybridLayout(initialNodes, edges, direction, simulationRef, d3NodesRef)
    }

    setNodes(positionedNodes)

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop()
      }
    }
  }, [layoutKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Restart simulation (for user-triggered re-layout)
  const restartSimulation = useCallback(() => {
    if (algorithm === 'dagre') {
      // Dagre doesn't have animation, just recompute
      const positionedNodes = applyDagreLayout(initialNodes, edges, direction)
      setNodes(positionedNodes)
      return
    }

    if (!simulationRef.current || !d3NodesRef.current.length) {
      // Force, radial, or hybrid: rerun layout
      let positionedNodes: Node[]
      if (algorithm === 'force') {
        positionedNodes = applyForceLayout(initialNodes, edges)
      } else if (algorithm === 'radial') {
        positionedNodes = applyRadialLayout(initialNodes, edges, simulationRef, d3NodesRef)
      } else {
        positionedNodes = applyHybridLayout(initialNodes, edges, direction, simulationRef, d3NodesRef)
      }
      setNodes(positionedNodes)
      return
    }

    setIsRunning(true)

    const simulation = simulationRef.current
    simulation.alpha(0.5).restart()

    // Update nodes on each tick during animated restart
    simulation.on('tick', () => {
      const currentD3Nodes = d3NodesRef.current
      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          const d3Node = currentD3Nodes.find((n) => n.id === node.id)
          return {
            ...node,
            position: {
              x: d3Node?.x ?? node.position.x,
              y: d3Node?.y ?? node.position.y,
            },
          }
        })
      )
    })

    simulation.on('end', () => {
      setIsRunning(false)
    })
  }, [algorithm, direction, initialNodes, edges])

  const stopSimulation = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.stop()
      setIsRunning(false)
    }
  }, [])

  return { nodes, isRunning, restartSimulation, stopSimulation }
}

/**
 * Pure dagre hierarchical layout
 */
function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection
): Node[] {
  if (!nodes.length) return []

  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 50,
    ranksep: 80,
    marginx: 20,
    marginy: 20,
  })

  // Add all nodes
  for (const node of nodes) {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  // Add edges - reverse parent edges so parents appear above children
  for (const edge of edges) {
    if (edge.data?.edge_type === 'parent') {
      // Parent edges go child→parent, reverse for dagre (parent above child)
      dagreGraph.setEdge(edge.target, edge.source)
    } else {
      dagreGraph.setEdge(edge.source, edge.target)
    }
  }

  dagre.layout(dagreGraph)

  // Find orphan nodes (not in dagre graph due to no edges)
  const nodeIds = new Set(nodes.map(n => n.id))
  const connectedIds = new Set<string>()
  for (const edge of edges) {
    connectedIds.add(edge.source)
    connectedIds.add(edge.target)
  }

  // Get positioned nodes from dagre
  const positionedNodes = nodes.map((node) => {
    const dagreNode = dagreGraph.node(node.id)
    if (dagreNode) {
      return {
        ...node,
        position: {
          x: dagreNode.x - NODE_WIDTH / 2,
          y: dagreNode.y - NODE_HEIGHT / 2,
        },
      }
    }
    // This shouldn't happen if all nodes were added, but fallback
    return { ...node, position: { x: 0, y: 0 } }
  })

  // Position orphan nodes (nodes with no edges) in a grid below the main graph
  const orphanIds = new Set<string>()
  for (const id of nodeIds) {
    if (!connectedIds.has(id)) {
      orphanIds.add(id)
    }
  }

  if (orphanIds.size > 0) {
    // Find the bounding box of connected nodes
    let maxY = -Infinity
    for (const node of positionedNodes) {
      if (connectedIds.has(node.id)) {
        maxY = Math.max(maxY, node.position.y + NODE_HEIGHT)
      }
    }

    // If no connected nodes, start from 0
    if (maxY === -Infinity) maxY = 0

    // Position orphans in a grid below
    const orphanNodes = positionedNodes.filter(n => orphanIds.has(n.id))
    const cols = Math.ceil(Math.sqrt(orphanNodes.length))
    const orphanGap = 50
    const startY = maxY + 100

    let i = 0
    for (const node of positionedNodes) {
      if (orphanIds.has(node.id)) {
        const col = i % cols
        const row = Math.floor(i / cols)
        node.position = {
          x: col * (NODE_WIDTH + orphanGap) - ((cols - 1) * (NODE_WIDTH + orphanGap)) / 2,
          y: startY + row * (NODE_HEIGHT + orphanGap),
        }
        i++
      }
    }
  }

  return positionedNodes
}

/**
 * Pure force-directed layout
 */
function applyForceLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (!nodes.length) return []

  const chargeStrength = -500
  const linkDistance = 100
  const collisionRadius = 55

  // Create d3 nodes with deterministic initial positions
  const d3Nodes: D3Node[] = nodes.map((node, index) => {
    let hash = 0
    for (const char of node.id) {
      hash = ((hash << 5) - hash) + char.charCodeAt(0)
      hash |= 0
    }
    const angle = (Math.abs(hash) % 360) * (Math.PI / 180)
    const radius = 50 + (index * 20)
    return {
      id: node.id,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    }
  })

  // Convert edges to d3-force link format
  const d3Links = edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }))

  // Create force simulation
  const simulation = forceSimulation(d3Nodes)
    .force('charge', forceManyBody().strength(chargeStrength))
    .force('link', forceLink(d3Links).id((d: any) => d.id).distance(linkDistance))
    .force('collide', forceCollide(collisionRadius))
    .force('x', forceX(0).strength(0.05))
    .force('y', forceY(0).strength(0.05))
    .alphaDecay(0.05)
    .stop()

  // Run simulation to completion
  const maxIterations = 300
  for (let i = 0; i < maxIterations; i++) {
    simulation.tick()
    if (simulation.alpha() < 0.01) break
  }

  // Set final positioned nodes
  return nodes.map((node) => {
    const d3Node = d3Nodes.find((n) => n.id === node.id)
    return {
      ...node,
      position: {
        x: d3Node?.x ?? 0,
        y: d3Node?.y ?? 0,
      },
    }
  })
}

/**
 * Hybrid layout: dagre for hierarchy + force for refinement
 */
function applyHybridLayout(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection,
  simulationRef: React.MutableRefObject<ReturnType<typeof forceSimulation<D3Node>> | null>,
  d3NodesRef: React.MutableRefObject<D3Node[]>
): Node[] {
  if (!nodes.length) return []

  // Step 1: Identify connected vs orphan nodes
  const connectedIds = new Set<string>()
  for (const edge of edges) {
    connectedIds.add(edge.source)
    connectedIds.add(edge.target)
  }

  const connectedNodes = nodes.filter(n => connectedIds.has(n.id))
  const orphanNodes = nodes.filter(n => !connectedIds.has(n.id))

  // Step 2: Extract parent edges for hierarchical structure
  const parentEdges = edges.filter(e => e.data?.edge_type === 'parent')

  // Step 3: Run dagre on parent edges to get rank assignments
  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 100,  // Horizontal spacing between nodes in same rank
    ranksep: 150,  // Vertical spacing between ranks
    marginx: 50,
    marginy: 50,
  })

  // Add connected nodes to dagre
  for (const node of connectedNodes) {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  // Add parent edges to dagre (these define the hierarchy)
  // Parent edges go child→parent, but dagre expects source above target
  // So we reverse the edge direction for dagre
  for (const edge of parentEdges) {
    if (connectedIds.has(edge.source) && connectedIds.has(edge.target)) {
      // Reverse: parent (target) above child (source)
      dagreGraph.setEdge(edge.target, edge.source)
    }
  }

  dagre.layout(dagreGraph)

  // Get dagre positions as targets for force simulation
  const nodeTargets = new Map<string, { x: number; y: number }>()
  for (const node of connectedNodes) {
    const dagreNode = dagreGraph.node(node.id)
    if (dagreNode) {
      nodeTargets.set(node.id, {
        x: dagreNode.x - NODE_WIDTH / 2,
        y: dagreNode.y - NODE_HEIGHT / 2,
      })
    }
  }

  // Step 4: Create d3 nodes with dagre positions as starting points
  const d3Nodes: D3Node[] = connectedNodes.map((node) => {
    const target = nodeTargets.get(node.id) ?? { x: 0, y: 0 }
    return {
      id: node.id,
      x: target.x,
      y: target.y,
      targetX: target.x,
      targetY: target.y,
    }
  })
  d3NodesRef.current = d3Nodes

  // Step 5: Create d3 links with different distances by edge type
  const d3Links = edges
    .filter(e => connectedIds.has(e.source) && connectedIds.has(e.target))
    .map((edge) => ({
      source: edge.source,
      target: edge.target,
      distance: edge.data?.edge_type === 'parent' ? 180 : 120,
    }))

  // Step 6: Run force simulation with constraints
  // In TB mode, Y is the hierarchical axis (stronger constraint)
  // In LR mode, X is the hierarchical axis (stronger constraint)
  const hierarchyStrength = 0.6
  const crossStrength = 0.3
  const xStrength = direction === 'LR' ? hierarchyStrength : crossStrength
  const yStrength = direction === 'TB' ? hierarchyStrength : crossStrength

  const simulation = forceSimulation(d3Nodes)
    .force('charge', forceManyBody().strength(-400))
    .force(
      'link',
      forceLink(d3Links)
        .id((d: any) => d.id)
        .distance((d: any) => d.distance)
        .strength(0.3)
    )
    .force('collide', forceCollide(70))
    // Constrain nodes toward their dagre-assigned positions
    .force('targetX', forceX((d: any) => d.targetX).strength(xStrength))
    .force('targetY', forceY((d: any) => d.targetY).strength(yStrength))
    .alphaDecay(0.03)
    .stop()

  simulationRef.current = simulation

  // Run simulation to completion
  const maxIterations = 300
  for (let i = 0; i < maxIterations; i++) {
    simulation.tick()
    if (simulation.alpha() < 0.01) break
  }

  // Build positioned connected nodes
  const positionedConnected = connectedNodes.map((node) => {
    const d3Node = d3Nodes.find((n) => n.id === node.id)
    return {
      ...node,
      position: {
        x: d3Node?.x ?? 0,
        y: d3Node?.y ?? 0,
      },
    }
  })

  // Step 7: Position orphan nodes in a grid below the main graph
  let maxY = -Infinity
  for (const node of positionedConnected) {
    maxY = Math.max(maxY, node.position.y + NODE_HEIGHT)
  }
  if (maxY === -Infinity) maxY = 0

  const positionedOrphans: Node[] = []
  if (orphanNodes.length > 0) {
    const cols = Math.ceil(Math.sqrt(orphanNodes.length))
    const orphanGap = 50
    const startY = maxY + 100

    orphanNodes.forEach((node, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      positionedOrphans.push({
        ...node,
        position: {
          x: col * (NODE_WIDTH + orphanGap) - ((cols - 1) * (NODE_WIDTH + orphanGap)) / 2,
          y: startY + row * (NODE_HEIGHT + orphanGap),
        },
      })
    })
  }

  return [...positionedConnected, ...positionedOrphans]
}

/**
 * Radial layout: positions nodes in concentric rings based on depth from root nodes.
 * Uses a dendrogram-style approach where children fan out from their parents,
 * spreading different node types across the graph based on hierarchy.
 */
function applyRadialLayout(
  nodes: Node[],
  edges: Edge[],
  simulationRef: React.MutableRefObject<ReturnType<typeof forceSimulation<D3Node>> | null>,
  d3NodesRef: React.MutableRefObject<D3Node[]>
): Node[] {
  if (!nodes.length) return []

  // Step 1: Build hierarchy from parent edges
  const parentEdges = edges.filter(e => e.data?.edge_type === 'parent')

  // Build parent -> children map (parent edges go child -> parent, so we reverse)
  const parentToChildren = new Map<string, string[]>()
  const childToParent = new Map<string, string>()

  for (const edge of parentEdges) {
    const child = edge.source
    const parent = edge.target
    // Only track first parent for tree structure (handle multi-parent later)
    if (!childToParent.has(child)) {
      childToParent.set(child, parent)
      if (!parentToChildren.has(parent)) {
        parentToChildren.set(parent, [])
      }
      parentToChildren.get(parent)!.push(child)
    }
  }

  // Find root nodes (nodes with no parents in our tree)
  const nodeIds = new Set(nodes.map(n => n.id))
  const rootNodes: string[] = []
  for (const id of nodeIds) {
    if (!childToParent.has(id)) {
      rootNodes.push(id)
    }
  }

  // Step 2: Calculate subtree sizes (leaf count) for angular allocation
  const subtreeSize = new Map<string, number>()

  function calculateSubtreeSize(nodeId: string): number {
    const children = parentToChildren.get(nodeId) ?? []
    if (children.length === 0) {
      subtreeSize.set(nodeId, 1)
      return 1
    }
    let size = 0
    for (const child of children) {
      size += calculateSubtreeSize(child)
    }
    subtreeSize.set(nodeId, size)
    return size
  }

  // Calculate sizes for all trees starting from roots
  for (const root of rootNodes) {
    calculateSubtreeSize(root)
  }

  // Assign size 1 to any disconnected nodes
  for (const node of nodes) {
    if (!subtreeSize.has(node.id)) {
      subtreeSize.set(node.id, 1)
    }
  }

  // Step 3: Calculate total leaf count for angular range allocation
  let totalLeaves = 0
  for (const root of rootNodes) {
    totalLeaves += subtreeSize.get(root) ?? 1
  }
  // Add orphan nodes (not in any tree)
  const treeNodes = new Set<string>()
  function collectTreeNodes(nodeId: string) {
    treeNodes.add(nodeId)
    const children = parentToChildren.get(nodeId) ?? []
    for (const child of children) {
      collectTreeNodes(child)
    }
  }
  for (const root of rootNodes) {
    collectTreeNodes(root)
  }
  const orphanNodes = nodes.filter(n => !treeNodes.has(n.id))
  totalLeaves += orphanNodes.length

  // Step 4: Assign angular ranges and positions using tree traversal
  const ringSpacing = 220 // Distance between rings (increased for more spacing)
  const nodePositions = new Map<string, { x: number; y: number; radius: number; angle: number }>()
  const nodeDepth = new Map<string, number>()

  function positionSubtree(
    nodeId: string,
    depth: number,
    startAngle: number,
    endAngle: number
  ) {
    nodeDepth.set(nodeId, depth)
    const radius = depth * ringSpacing
    const angle = (startAngle + endAngle) / 2 // Center of angular range

    const x = radius * Math.cos(angle)
    const y = radius * Math.sin(angle)
    nodePositions.set(nodeId, { x, y, radius, angle })

    // Position children within this node's angular range
    const children = parentToChildren.get(nodeId) ?? []
    if (children.length > 0) {
      const totalChildSize = children.reduce((sum, c) => sum + (subtreeSize.get(c) ?? 1), 0)
      let currentAngle = startAngle

      for (const child of children) {
        const childSize = subtreeSize.get(child) ?? 1
        const childAngleRange = (endAngle - startAngle) * (childSize / totalChildSize)
        const childEndAngle = currentAngle + childAngleRange

        positionSubtree(child, depth + 1, currentAngle, childEndAngle)
        currentAngle = childEndAngle
      }
    }
  }

  // Position all root trees, distributing angular space by subtree size
  let currentAngle = -Math.PI / 2 // Start from top
  const fullCircle = 2 * Math.PI

  for (const root of rootNodes) {
    const rootSize = subtreeSize.get(root) ?? 1
    const angleRange = fullCircle * (rootSize / totalLeaves)
    positionSubtree(root, 0, currentAngle, currentAngle + angleRange)
    currentAngle += angleRange
  }

  // Position orphan nodes (spread them evenly in remaining space or as outer ring)
  if (orphanNodes.length > 0) {
    const maxDepth = Math.max(...Array.from(nodeDepth.values()), 0)
    const orphanRadius = (maxDepth + 1.5) * ringSpacing
    const orphanAngleRange = fullCircle * (orphanNodes.length / totalLeaves)
    const orphanAngleStep = orphanAngleRange / orphanNodes.length

    orphanNodes.forEach((node, i) => {
      const angle = currentAngle + i * orphanAngleStep + orphanAngleStep / 2
      const x = orphanRadius * Math.cos(angle)
      const y = orphanRadius * Math.sin(angle)
      nodePositions.set(node.id, { x, y, radius: orphanRadius, angle })
      nodeDepth.set(node.id, maxDepth + 2)
    })
  }

  // Step 5: Create d3 nodes with tree-based positions
  const d3Nodes: D3Node[] = nodes.map((node) => {
    const pos = nodePositions.get(node.id) ?? { x: 0, y: 0, radius: 0 }
    return {
      id: node.id,
      x: pos.x,
      y: pos.y,
      targetX: pos.x,
      targetY: pos.y,
    }
  })
  d3NodesRef.current = d3Nodes

  // Step 6: Create d3 links with edge-type-aware distances
  // Parent edges follow the tree structure, other edges should pull nodes closer
  const d3Links = edges.map((edge) => {
    const isParentEdge = edge.data?.edge_type === 'parent'
    return {
      source: edge.source,
      target: edge.target,
      // Parent edges: use ring spacing. Other edges: shorter to pull connected nodes together
      distance: isParentEdge ? ringSpacing * 0.9 : ringSpacing * 0.5,
      // Non-parent edges get stronger pull to bring connected nodes closer
      strength: isParentEdge ? 0.3 : 0.6,
    }
  })

  // Step 7: Run force simulation with radial constraint
  // Balance between maintaining radial structure and pulling connected nodes together
  const simulation = forceSimulation(d3Nodes)
    .force('charge', forceManyBody().strength(-250))
    .force(
      'link',
      forceLink(d3Links)
        .id((d: any) => d.id)
        .distance((d: any) => d.distance)
        .strength((d: any) => d.strength)
    )
    .force('collide', forceCollide(70)) // Increased collision radius for more spacing
    // Use forceRadial to keep nodes at their assigned ring distances
    // Reduced strength to allow more flexibility for connected nodes
    .force('radial', forceRadial(
      (d: any) => nodePositions.get(d.id)?.radius ?? 0,
      0, 0
    ).strength(0.4))
    .alphaDecay(0.025) // Slower decay for better convergence
    .stop()

  simulationRef.current = simulation

  // Run simulation to completion (more iterations for better convergence)
  const maxIterations = 400
  for (let i = 0; i < maxIterations; i++) {
    simulation.tick()
    if (simulation.alpha() < 0.005) break
  }

  // Build positioned nodes
  return nodes.map((node) => {
    const d3Node = d3Nodes.find((n) => n.id === node.id)
    return {
      ...node,
      position: {
        x: d3Node?.x ?? 0,
        y: d3Node?.y ?? 0,
      },
    }
  })
}
