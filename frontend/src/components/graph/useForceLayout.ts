import { useEffect, useRef, useCallback, useState } from 'react'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force'
import type { Node, Edge } from '@xyflow/react'

interface ForceLayoutOptions {
  chargeStrength?: number
  linkDistance?: number
  collisionRadius?: number
}

interface D3Node {
  id: string
  x?: number
  y?: number
  vx?: number
  vy?: number
}

/**
 * Integrate d3-force simulation with React Flow nodes.
 *
 * This hook runs a force-directed layout simulation synchronously to completion
 * before returning positioned nodes. This prevents visible "settling" animation.
 *
 * Features:
 * - Runs simulation to completion before showing nodes (no flickering)
 * - Manual restart available for user-triggered re-layout
 * - Uses forceCollide to prevent node overlap
 */
export function useForceLayout(
  initialNodes: Node[],
  edges: Edge[],
  options?: ForceLayoutOptions
) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const simulationRef = useRef<ReturnType<typeof forceSimulation<D3Node>> | null>(null)
  const d3NodesRef = useRef<D3Node[]>([])

  const {
    chargeStrength = -400,
    linkDistance = 80,
    collisionRadius = 50,
  } = options ?? {}

  useEffect(() => {
    if (!initialNodes.length) {
      setNodes([])
      d3NodesRef.current = []
      return
    }

    // Create d3 nodes with deterministic initial positions
    const d3Nodes: D3Node[] = initialNodes.map((node, index) => {
      // Use deterministic position based on ID hash
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
    d3NodesRef.current = d3Nodes

    // Convert edges to d3-force link format
    const d3Links = edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
    }))

    // Create force simulation
    const simulation = forceSimulation(d3Nodes)
      .force('charge', forceManyBody().strength(chargeStrength))
      .force('center', forceCenter(0, 0))
      .force(
        'link',
        forceLink(d3Links)
          .id((d: any) => d.id)
          .distance(linkDistance)
      )
      .force('collide', forceCollide(collisionRadius))
      .alphaDecay(0.05)
      .stop() // Don't auto-run

    // Run simulation to completion synchronously (no animation)
    // This typically takes ~300 iterations to stabilize
    const maxIterations = 300
    for (let i = 0; i < maxIterations; i++) {
      simulation.tick()
      if (simulation.alpha() < 0.01) break
    }

    // Set final positioned nodes
    const positionedNodes = initialNodes.map((node) => {
      const d3Node = d3Nodes.find((n) => n.id === node.id)
      return {
        ...node,
        position: {
          x: d3Node?.x ?? 0,
          y: d3Node?.y ?? 0,
        },
      }
    })

    setNodes(positionedNodes)
    simulationRef.current = simulation

    return () => {
      simulation.stop()
    }
  }, [initialNodes, edges, chargeStrength, linkDistance, collisionRadius])

  // Restart simulation with animation (for user-triggered re-layout)
  const restartSimulation = useCallback(() => {
    if (!simulationRef.current || !d3NodesRef.current.length) return

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
  }, [])

  const stopSimulation = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.stop()
      setIsRunning(false)
    }
  }, [])

  return { nodes, isRunning, restartSimulation, stopSimulation }
}
