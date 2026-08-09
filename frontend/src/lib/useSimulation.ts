import { useCallback, useEffect, useRef, useState } from 'react'
import type { Edge, Node } from 'reactflow'
import { runSimulation, type SimulationResult, type Tick } from './api'
import type { ArchNodeData } from '../components/ArchNode'
import { deriveHealth } from '../components/nodes'

const BASE_TICK_PLAYBACK_MS = 150

export function useSimulation() {
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [tickIndex, setTickIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [speed, setSpeed] = useState(1)
  const timerRef = useRef<number | null>(null)

  const stopPlayback = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsPlaying(false)
  }, [])

  const run = useCallback(
    async (nodes: Node<ArchNodeData>[], edges: Edge[], targetRps: number, durationSeconds: number) => {
      setIsRunning(true)
      setError(null)
      try {
        const res = await runSimulation({
          nodes: nodes.map((n) => ({ id: n.id, type: n.data.componentType, config: n.data.config })),
          edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
          targetRps,
          durationSeconds,
        })
        setResult(res)
        setTickIndex(0)
        setIsPlaying(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Simulation failed')
      } finally {
        setIsRunning(false)
      }
    },
    [],
  )

  const reset = useCallback(() => {
    stopPlayback()
    setResult(null)
    setTickIndex(0)
    setError(null)
  }, [stopPlayback])

  useEffect(() => {
    if (!isPlaying || !result) return
    timerRef.current = window.setInterval(() => {
      setTickIndex((i) => {
        if (i >= result.ticks.length - 1) {
          return 0 // loop playback so the demo keeps breathing
        }
        return i + 1
      })
    }, BASE_TICK_PLAYBACK_MS / speed)
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
    }
  }, [isPlaying, result, speed])

  const currentTick: Tick | null = result?.ticks[tickIndex] ?? null

  const nodeHealth = useCallback(
    (nodeId: string) => {
      const stats = currentTick?.nodes[nodeId]
      if (!stats) return 'idle' as const
      return deriveHealth(stats.loadPct, stats.errorRatePct, stats.down)
    },
    [currentTick],
  )

  const edgeStats = useCallback(
    (edgeId: string) => {
      return currentTick?.edges[edgeId] ?? null
    },
    [currentTick],
  )

  return {
    result,
    currentTick,
    isPlaying,
    isRunning,
    error,
    speed,
    setSpeed,
    run,
    pause: stopPlayback,
    resume: () => result && setIsPlaying(true),
    reset,
    nodeHealth,
    edgeStats,
  }
}
