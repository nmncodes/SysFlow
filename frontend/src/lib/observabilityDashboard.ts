import type { SimulationResult } from './api'

export interface ObservabilityNodeInput {
  id: string
  type: string
  label: string
}

export interface ObservabilityTimePoint {
  tick: number
  rps: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
  errorRatePct: number
}

export type ObservabilityHealth = 'Healthy' | 'Degraded' | 'Down'

export interface ObservabilityNodeMetric {
  nodeId: string
  label: string
  type: string
  health: ObservabilityHealth
  avgLoadPct: number
  peakLoadPct: number
  avgLatencyMs: number
  p95LatencyMs: number
  peakLatencyMs: number
  avgErrorRatePct: number
  peakErrorRatePct: number
  downTicks: number
  latestLoadPct: number
  latestLatencyMs: number
  latestErrorRatePct: number
  latestReplicas: number | null
}

export interface ObservabilityEdgeMetric {
  edgeId: string
  source: string
  target: string
  avgLatencyMs: number
  peakLatencyMs: number
  peakInFlight: number
}

export interface ObservabilityDashboardData {
  hasSimulation: boolean
  sampleCount: number
  durationTicks: number
  overview: {
    avgRps: number
    peakRps: number
    avgP50Ms: number
    avgP95Ms: number
    peakP95Ms: number
    avgP99Ms: number
    avgErrorRatePct: number
    peakErrorRatePct: number
    healthyNodes: number
    degradedNodes: number
    downNodes: number
    totalNodes: number
  }
  timeSeries: ObservabilityTimePoint[]
  nodes: ObservabilityNodeMetric[]
  edges: ObservabilityEdgeMetric[]
  bottlenecks: ObservabilityNodeMetric[]
}

interface NodeSamples {
  load: number[]
  latency: number[]
  errors: number[]
  replicas: number[]
  downTicks: number
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = (sorted.length - 1) * p
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function healthFor(samples: NodeSamples): ObservabilityHealth {
  if (samples.downTicks > 0) return 'Down'
  const peakLoad = Math.max(...samples.load, 0)
  const peakError = Math.max(...samples.errors, 0)
  const p95Latency = percentile(samples.latency, 0.95)
  if (peakLoad >= 85 || peakError >= 5 || p95Latency >= 250) return 'Degraded'
  return 'Healthy'
}

export function buildObservabilityDashboard(
  nodes: ObservabilityNodeInput[],
  edges: { id: string; source: string; target: string }[],
  simulation: SimulationResult | null | undefined,
): ObservabilityDashboardData {
  if (!simulation || simulation.ticks.length === 0) {
    return {
      hasSimulation: false,
      sampleCount: 0,
      durationTicks: 0,
      overview: {
        avgRps: 0,
        peakRps: 0,
        avgP50Ms: 0,
        avgP95Ms: 0,
        peakP95Ms: 0,
        avgP99Ms: 0,
        avgErrorRatePct: 0,
        peakErrorRatePct: 0,
        healthyNodes: 0,
        degradedNodes: 0,
        downNodes: 0,
        totalNodes: nodes.length,
      },
      timeSeries: [],
      nodes: [],
      edges: [],
      bottlenecks: [],
    }
  }

  const samples = new Map<string, NodeSamples>()
  for (const node of nodes) {
    samples.set(node.id, { load: [], latency: [], errors: [], replicas: [], downTicks: 0 })
  }

  const timeSeries = simulation.ticks.map((tick) => ({
    tick: tick.t,
    rps: round(tick.global.rps),
    p50Ms: round(tick.global.p50),
    p95Ms: round(tick.global.p95),
    p99Ms: round(tick.global.p99),
    errorRatePct: round(tick.global.errorRatePct),
  }))

  for (const tick of simulation.ticks) {
    for (const node of nodes) {
      const stat = tick.nodes[node.id]
      if (!stat) continue
      const target = samples.get(node.id)
      if (!target) continue
      target.load.push(stat.loadPct)
      target.latency.push(stat.avgLatencyMs)
      target.errors.push(stat.errorRatePct)
      if (typeof stat.replicas === 'number') target.replicas.push(stat.replicas)
      if (stat.down) target.downTicks += 1
    }
  }

  const nodeMetrics = nodes.map((node): ObservabilityNodeMetric => {
    const sample = samples.get(node.id) ?? { load: [], latency: [], errors: [], replicas: [], downTicks: 0 }
    return {
      nodeId: node.id,
      label: node.label || node.id,
      type: node.type,
      health: healthFor(sample),
      avgLoadPct: round(average(sample.load)),
      peakLoadPct: round(Math.max(...sample.load, 0)),
      avgLatencyMs: round(average(sample.latency)),
      p95LatencyMs: round(percentile(sample.latency, 0.95)),
      peakLatencyMs: round(Math.max(...sample.latency, 0)),
      avgErrorRatePct: round(average(sample.errors)),
      peakErrorRatePct: round(Math.max(...sample.errors, 0)),
      downTicks: sample.downTicks,
      latestLoadPct: round(sample.load.at(-1) ?? 0),
      latestLatencyMs: round(sample.latency.at(-1) ?? 0),
      latestErrorRatePct: round(sample.errors.at(-1) ?? 0),
      latestReplicas: sample.replicas.length ? round(sample.replicas.at(-1) ?? 0) : null,
    }
  })

  const edgeMetrics = edges.map((edge): ObservabilityEdgeMetric => {
    const latency: number[] = []
    const inFlight: number[] = []
    for (const tick of simulation.ticks) {
      const stat = tick.edges[edge.id]
      if (!stat) continue
      latency.push(stat.avgLatencyMs)
      inFlight.push(stat.inFlight)
    }
    return {
      edgeId: edge.id,
      source: edge.source,
      target: edge.target,
      avgLatencyMs: round(average(latency)),
      peakLatencyMs: round(Math.max(...latency, 0)),
      peakInFlight: round(Math.max(...inFlight, 0)),
    }
  }).filter((edge) => edge.avgLatencyMs > 0 || edge.peakInFlight > 0)

  const healthCounts = nodeMetrics.reduce(
    (counts, node) => {
      counts[node.health] += 1
      return counts
    },
    { Healthy: 0, Degraded: 0, Down: 0 } as Record<ObservabilityHealth, number>,
  )

  const overview = {
    avgRps: round(average(timeSeries.map((point) => point.rps))),
    peakRps: round(Math.max(...timeSeries.map((point) => point.rps), 0)),
    avgP50Ms: round(average(timeSeries.map((point) => point.p50Ms))),
    avgP95Ms: round(average(timeSeries.map((point) => point.p95Ms))),
    peakP95Ms: round(Math.max(...timeSeries.map((point) => point.p95Ms), 0)),
    avgP99Ms: round(average(timeSeries.map((point) => point.p99Ms))),
    avgErrorRatePct: round(average(timeSeries.map((point) => point.errorRatePct))),
    peakErrorRatePct: round(Math.max(...timeSeries.map((point) => point.errorRatePct), 0)),
    healthyNodes: healthCounts.Healthy,
    degradedNodes: healthCounts.Degraded,
    downNodes: healthCounts.Down,
    totalNodes: nodes.length,
  }

  const bottlenecks = [...nodeMetrics]
    .filter((node) => node.peakLoadPct >= 70 || node.p95LatencyMs > 0 || node.peakErrorRatePct > 0)
    .sort((a, b) => {
      const loadDelta = b.peakLoadPct - a.peakLoadPct
      if (loadDelta !== 0) return loadDelta
      const latencyDelta = b.p95LatencyMs - a.p95LatencyMs
      if (latencyDelta !== 0) return latencyDelta
      return b.peakErrorRatePct - a.peakErrorRatePct
    })
    .slice(0, 6)

  return {
    hasSimulation: true,
    sampleCount: simulation.ticks.length,
    durationTicks: simulation.ticks.at(-1)?.t ?? 0,
    overview,
    timeSeries,
    nodes: nodeMetrics,
    edges: edgeMetrics,
    bottlenecks,
  }
}
