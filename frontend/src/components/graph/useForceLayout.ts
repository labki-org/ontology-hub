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
  chargeStrength?: number // default -800
  linkDistance?: number // default 120
  collisionRadius?: number // default 80
  alphaDecay?: number // default 0.02
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
 * This hook runs a force-directed layout simulation and updates node positions
 * on each tick. The simulation automatically stops when stabilized (alpha < 0.01).
 *
 * Based on research findings:
 * - Clone nodes before simulation to avoid React state mutation warnings
 * - Auto-stop when alpha < 0.01 for performance
 * - Use forceCollide to prevent node overlap
 *
 * @param initialNodes - React Flow nodes to position
 * @param edges - React Flow edges for link force
 * @param options - Force simulation configuration
 * @returns { nodes, isRunning, restartSimulation, stopSimulation }
 */
export function useForceLayout(
  initialNodes: Node[],
  edges: Edge[],
  options?: ForceLayoutOptions
) {
  const [nodes, setNodes] = useState<Node[]>(initialNodes)
  const [isRunning, setIsRunning] = useState(false)
  const simulationRef = useRef<any>(null)
  // Keep track of d3 nodes for tick handler closure
  const d3NodesRef = useRef<D3Node[]>([])

  const {
    chargeStrength = -800,
    linkDistance = 120,
    collisionRadius = 80,
    alphaDecay = 0.02,
  } = options ?? {}

  useEffect(() => {
    if (!initialNodes.length) {
      setNodes([])
      d3NodesRef.current = []
      return
    }

    // Sync state when initialNodes change
    setNodes(initialNodes)

    // Clone nodes for d3-force simulation to avoid mutation warnings
    const d3Nodes: D3Node[] = initialNodes.map((node) => ({
      id: node.id,
      x: node.position?.x ?? Math.random() * 500,
      y: node.position?.y ?? Math.random() * 500,
    }))
    // Store in ref for tick handler access
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
      .alphaDecay(alphaDecay)

    setIsRunning(true)

    // Update node positions on each tick using initialNodes as base
    // (d3 mutates d3Nodes in place, so we read positions from there)
    simulation.on('tick', () => {
      const currentD3Nodes = d3NodesRef.current
      setNodes(
        initialNodes.map((node) => {
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

    // Auto-stop when stabilized
    simulation.on('end', () => {
      setIsRunning(false)
    })

    // Manual stop check (alpha threshold)
    const checkStabilized = setInterval(() => {
      if (simulation.alpha() < 0.01) {
        simulation.stop()
        setIsRunning(false)
        clearInterval(checkStabilized)
      }
    }, 100)

    simulationRef.current = simulation

    return () => {
      simulation.stop()
      clearInterval(checkStabilized)
      setIsRunning(false)
    }
  }, [initialNodes, edges, chargeStrength, linkDistance, collisionRadius, alphaDecay])

  const restartSimulation = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.alpha(0.5).restart()
      setIsRunning(true)
    }
  }, [])

  const stopSimulation = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.stop()
      setIsRunning(false)
    }
  }, [])

  return { nodes, isRunning, restartSimulation, stopSimulation }
}
