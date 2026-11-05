import { describe, expect, it } from 'vitest'
import { analyzeLatency, type LatencyAnalyzerNode, type LatencyAnalyzerEdge } from './latencyAnalyzer'
import type { SimulationResult, Tick } from './api'

const node = (id: string, type: string, config: Record<string, unknown> = {}): LatencyAnalyzerNode => ({
  id, type, label: id, config,
})
const edge = (id: string, source: string, target: string): LatencyAnalyzerEdge => ({ id, source, target })

function makeTick(t: number, nodeStats: Record<string, { avgLatencyMs: number; loadPct: number; errorRatePct: number; down?: boolean }>): Tick {
  const nodes: Record<string, any> = {}
  for (const [id, s] of Object.entries(nodeStats)) {
    nodes[id] = { avgLatencyMs: s.avgLatencyMs, loadPct: s.loadPct, errorRatePct: s.errorRatePct, down: s.down ?? false }
  }
  return {
    t,
    nodes,
    edges: {},
    global: { rps: 100, errorRatePct: 1, p50: 50, p95: 100, p99: 200 },
  }
}

function makeSim(ticks: Tick[]): SimulationResult {
  return {
    ticks,
    summary: { avgRps: 100, avgErrorRatePct: 1, p50: 50, p95: 100, p99: 200, bottleneckNodeId: null, bottleneckLoadPct: 0, singlePointsOfFailure: [] },
  }
}

describe('analyzeLatency', () => {
  it('returns empty result when simulation is null', () => {
    const result = analyzeLatency([node('a', 'service')], [], null)
    expect(result.hasSimulation).toBe(false)
    expect(result.findings).toHaveLength(0)
    expect(result.criticalPath).toHaveLength(0)
  })

  it('returns empty result when simulation has no ticks', () => {
    const result = analyzeLatency([node('a', 'service')], [], makeSim([]))
    expect(result.hasSimulation).toBe(false)
  })

  it('identifies critical path through a chain', () => {
    const nodes = [node('c', 'client'), node('api', 'service'), node('db', 'database')]
    const edges = [edge('e1', 'c', 'api'), edge('e2', 'api', 'db')]
    const ticks = [
      makeTick(0, { c: { avgLatencyMs: 5, loadPct: 10, errorRatePct: 0 }, api: { avgLatencyMs: 50, loadPct: 60, errorRatePct: 0 }, db: { avgLatencyMs: 30, loadPct: 40, errorRatePct: 0 } }),
      makeTick(1, { c: { avgLatencyMs: 5, loadPct: 10, errorRatePct: 0 }, api: { avgLatencyMs: 55, loadPct: 65, errorRatePct: 0 }, db: { avgLatencyMs: 35, loadPct: 45, errorRatePct: 0 } }),
    ]
    const result = analyzeLatency(nodes, edges, makeSim(ticks))
    expect(result.hasSimulation).toBe(true)
    expect(result.criticalPath.length).toBeGreaterThanOrEqual(2)
    expect(result.criticalPathLatencyMs).toBeGreaterThan(0)
  })

  it('flags the main bottleneck', () => {
    const nodes = [node('c', 'client'), node('api', 'service'), node('db', 'database')]
    const edges = [edge('e1', 'c', 'api'), edge('e2', 'api', 'db')]
    const ticks = [
      makeTick(0, { c: { avgLatencyMs: 5, loadPct: 10, errorRatePct: 0 }, api: { avgLatencyMs: 200, loadPct: 90, errorRatePct: 0 }, db: { avgLatencyMs: 30, loadPct: 40, errorRatePct: 0 } }),
    ]
    const result = analyzeLatency(nodes, edges, makeSim(ticks))
    expect(result.mainBottleneck).not.toBeNull()
    expect(result.mainBottleneck!.nodeId).toBe('api')
  })

  it('assigns Critical severity when a node goes down', () => {
    const nodes = [node('c', 'client'), node('api', 'service')]
    const edges = [edge('e1', 'c', 'api')]
    const ticks = [
      makeTick(0, { c: { avgLatencyMs: 5, loadPct: 10, errorRatePct: 0 }, api: { avgLatencyMs: 100, loadPct: 50, errorRatePct: 0, down: true } }),
    ]
    const result = analyzeLatency(nodes, edges, makeSim(ticks))
    const apiFinding = result.findings.find(f => f.nodeId === 'api')
    expect(apiFinding).toBeDefined()
    expect(apiFinding!.severity).toBe('Critical')
  })

  it('assigns High severity at 85%+ load', () => {
    const nodes = [node('c', 'client'), node('api', 'service')]
    const edges = [edge('e1', 'c', 'api')]
    const ticks = [
      makeTick(0, { c: { avgLatencyMs: 5, loadPct: 10, errorRatePct: 0 }, api: { avgLatencyMs: 50, loadPct: 90, errorRatePct: 0 } }),
    ]
    const result = analyzeLatency(nodes, edges, makeSim(ticks))
    const apiFinding = result.findings.find(f => f.nodeId === 'api')
    expect(apiFinding).toBeDefined()
    expect(['Critical', 'High']).toContain(apiFinding!.severity)
  })

  it('handles a single node with no edges', () => {
    const nodes = [node('api', 'service')]
    const ticks = [
      makeTick(0, { api: { avgLatencyMs: 50, loadPct: 80, errorRatePct: 2 } }),
    ]
    const result = analyzeLatency(nodes, [], makeSim(ticks))
    expect(result.hasSimulation).toBe(true)
    expect(result.criticalPath.length).toBeLessThanOrEqual(1)
  })

  it('computes overall latency percentiles', () => {
    const nodes = [node('c', 'client'), node('api', 'service')]
    const edges = [edge('e1', 'c', 'api')]
    const ticks = Array.from({ length: 5 }, (_, i) =>
      makeTick(i, { c: { avgLatencyMs: 5, loadPct: 10, errorRatePct: 0 }, api: { avgLatencyMs: 50 + i * 10, loadPct: 60, errorRatePct: 0 } }),
    )
    const result = analyzeLatency(nodes, edges, makeSim(ticks))
    expect(result.overallP50Ms).not.toBeNull()
    expect(result.overallP95Ms).not.toBeNull()
    expect(result.overallP99Ms).not.toBeNull()
  })
})
