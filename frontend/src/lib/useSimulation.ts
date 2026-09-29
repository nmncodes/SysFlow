import { useCallback, useEffect, useRef, useState } from 'react'
import type { Edge, Node } from 'reactflow'
import type { ArchNodeData } from '../components/ArchNode'
import { runSimulation, type InjectedFailure, type SimulationResult, type Tick } from './api'
import { deriveHealth } from '../components/nodes'

const PLAYBACK_MS = 150
const DEFAULT_DURATION_SECONDS = 30

export interface BustedInfo {
  nodeId: string
  nodeLabel: string
  tick: number
  rps: number
  capacity: number
  reason: string
}

type SimulationGraph = {
  nodes: Node<ArchNodeData>[]
  edges: Edge[]
  baseRps: number
}

function toRequestGraph(graph: SimulationGraph) {
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: node.data.componentType,
      config: node.data.config ?? {},
    })),
    edges: graph.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
  }
}

function findBustedNode(result: SimulationResult, nodes: Node<ArchNodeData>[]): BustedInfo | null {
  for (const tick of result.ticks) {
    const downNode = Object.entries(tick.nodes).find(([, stats]) => stats.down)
    if (!downNode) continue
    const [nodeId, stats] = downNode
    const node = nodes.find((item) => item.id === nodeId)
    return {
      nodeId,
      nodeLabel: node?.data.label ?? nodeId,
      tick: tick.t,
      rps: Math.round(stats.loadPct),
      capacity: 0,
      reason: 'The backend marked this component down after its capacity was exceeded.',
    }
  }
  return null
}

export function useSimulation() {
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [currentTick, setCurrentTick] = useState<Tick | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isBusted, setIsBusted] = useState(false)
  const [bustedInfo, setBustedInfo] = useState<BustedInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [speed, setSpeed] = useState(1)
  const [trafficMultiplier, setTrafficMultiplierState] = useState(1)
  const [playbackIndex, setPlaybackIndex] = useState(0)

  const timerRef = useRef<number | null>(null)
  const graphRef = useRef<SimulationGraph | null>(null)
  const failuresRef = useRef<InjectedFailure[]>([])
  const trafficRef = useRef(1)
  const runTokenRef = useRef(0)

  const stopPlayback = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsPlaying(false)
  }, [])

  const loadFromBackend = useCallback(async (graph: SimulationGraph, failures: InjectedFailure[], multiplier: number) => {
    const token = ++runTokenRef.current
    stopPlayback()
    setIsRunning(true)
    setError(null)
    setIsBusted(false)
    setBustedInfo(null)
    try {
      const nextResult = await runSimulation({
        ...toRequestGraph(graph),
        targetRps: graph.baseRps * multiplier,
        durationSeconds: DEFAULT_DURATION_SECONDS,
        injectedFailures: failures,
      })
      if (token !== runTokenRef.current) return
      graphRef.current = graph
      setResult(nextResult)
      setPlaybackIndex(0)
      setCurrentTick(nextResult.ticks[0] ?? null)
      const busted = findBustedNode(nextResult, graph.nodes)
      setBustedInfo(busted)
      setIsBusted(Boolean(busted))
      setIsPlaying(nextResult.ticks.length > 0)
    } catch (cause) {
      if (token === runTokenRef.current) setError(cause instanceof Error ? cause.message : 'Simulation request failed')
    } finally {
      if (token === runTokenRef.current) setIsRunning(false)
    }
  }, [stopPlayback])

  const setTrafficMultiplier = useCallback((multiplier: number) => {
    setTrafficMultiplierState(multiplier)
    trafficRef.current = multiplier
    if (graphRef.current && result) void loadFromBackend(graphRef.current, failuresRef.current, multiplier)
  }, [loadFromBackend, result])

  const updateFailures = useCallback((failures: InjectedFailure[]) => {
    failuresRef.current = [...failures]
    if (graphRef.current && result) void loadFromBackend(graphRef.current, failuresRef.current, trafficRef.current)
  }, [loadFromBackend, result])

  const run = useCallback((
    nodes: Node<ArchNodeData>[],
    edges: Edge[],
    targetRps: number,
    _durationSeconds?: number,
    injectedFailures: InjectedFailure[] = [],
  ) => {
    const graph = { nodes, edges, baseRps: targetRps }
    graphRef.current = graph
    failuresRef.current = [...injectedFailures]
    void loadFromBackend(graph, failuresRef.current, trafficRef.current)
  }, [loadFromBackend])

  const reset = useCallback(() => {
    runTokenRef.current += 1
    stopPlayback()
    graphRef.current = null
    setResult(null)
    setCurrentTick(null)
    setPlaybackIndex(0)
    setIsBusted(false)
    setBustedInfo(null)
    setError(null)
  }, [stopPlayback])

  useEffect(() => {
    if (!isPlaying || !result || playbackIndex >= result.ticks.length - 1) {
      if (result && playbackIndex >= result.ticks.length - 1) setIsPlaying(false)
      return
    }
    timerRef.current = window.setInterval(() => {
      setPlaybackIndex((index) => {
        const nextIndex = Math.min(index + 1, result.ticks.length - 1)
        setCurrentTick(result.ticks[nextIndex])
        return nextIndex
      })
    }, PLAYBACK_MS / speed)
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
    }
  }, [isPlaying, playbackIndex, result, speed])

  const nodeHealth = useCallback((nodeId: string) => {
    const stats = currentTick?.nodes[nodeId]
    return stats ? deriveHealth(stats.loadPct, stats.errorRatePct, stats.down) : 'idle' as const
  }, [currentTick])

  const edgeStats = useCallback((edgeId: string) => currentTick?.edges[edgeId] ?? null, [currentTick])

  return {
    result,
    currentTick,
    isPlaying,
    isRunning,
    isBusted,
    bustedInfo,
    error,
    speed,
    setSpeed,
    trafficMultiplier,
    setTrafficMultiplier,
    run,
    pause: stopPlayback,
    resume: () => setIsPlaying(true),
    reset,
    updateFailures,
    nodeHealth,
    edgeStats,
  }
}