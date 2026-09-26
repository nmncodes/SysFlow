import type { SimulationResult } from './api'

export type LatencySeverity = 'Critical' | 'High' | 'Medium' | 'Low'

export interface LatencyAnalyzerNode {
  id: string
  type: string
  label: string
  config: Record<string, unknown>
}

export interface LatencyAnalyzerEdge {
  id: string
  source: string
  target: string
}

export interface LatencyFinding {
  nodeId: string
  label: string
  type: string
  severity: LatencySeverity
  avgLatencyMs: number
  p95LatencyMs: number
  maxLatencyMs: number
  avgLoadPct: number
  maxLoadPct: number
  avgErrorRatePct: number
  latencyContributionPct: number | null
  baselineLatencyMs: number | null
  downstreamComponents: string[]
  criticalPath: string[]
  reason: string
  recommendation: string
}

export interface LatencyAnalysisResult {
  hasSimulation: boolean
  sampleCount: number
  overallP50Ms: number | null
  overallP95Ms: number | null
  overallP99Ms: number | null
  mainBottleneck: LatencyFinding | null
  criticalPath: string[]
  criticalPathLatencyMs: number | null
  findings: LatencyFinding[]
}

interface NodeAggregate {
  latencies: number[]
  loads: number[]
  errors: number[]
  downTicks: number
}

const ENTRY_TYPES = new Set(['client', 'mobile', 'webBrowser', 'iotDevice', 'cronJob', 'webhook'])

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = (sorted.length - 1) * p
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function configuredLatency(node: LatencyAnalyzerNode): number | null {
  const config = node.config ?? {}
  const values: unknown[] = []

  if (
    node.type === 'service' ||
    node.type === 'worker' ||
    node.type === 'serverless' ||
    node.type === 'autoScalingGroup' ||
    node.type === 'containerOrchestrator' ||
    node.type === 'cronJob' ||
    node.type === 'thirdPartyApi' ||
    node.type === 'paymentGateway'
  ) {
    values.push(config.maxLatencyMs, config.minLatencyMs)
  } else if (node.type === 'cdn' || node.type === 'cache') {
    values.push(config.missLatencyMs, config.hitLatencyMs)
  } else if (node.type === 'dns') {
    values.push(config.resolutionLatencyMs)
  } else if (
    node.type === 'database' ||
    node.type === 'dataWarehouse' ||
    node.type === 'objectStorage' ||
    node.type === 'searchIndex' ||
    node.type === 'dataLake'
  ) {
    values.push(config.readLatencyMs)
  } else if (node.type === 'waf') {
    values.push(config.extraLatencyMs)
  }

  const numeric = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)

  return numeric.length > 0 ? Math.max(...numeric) : null
}

function buildGraph(nodes: LatencyAnalyzerNode[], edges: LatencyAnalyzerEdge[]) {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const outgoing = new Map<string, LatencyAnalyzerEdge[]>()

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge])
  }

  return { outgoing }
}

function collectDescendants(
  nodeId: string,
  outgoing: Map<string, LatencyAnalyzerEdge[]>,
  labels: Map<string, string>,
): string[] {
  const seen = new Set<string>()
  const queue = (outgoing.get(nodeId) ?? []).map((edge) => edge.target)

  for (let i = 0; i < queue.length; i += 1) {
    const id = queue[i]
    if (seen.has(id)) continue
    seen.add(id)
    queue.push(...(outgoing.get(id) ?? []).map((edge) => edge.target))
  }

  return [...seen].map((id) => labels.get(id) ?? id)
}

function findCriticalPath(
  nodes: LatencyAnalyzerNode[],
  outgoing: Map<string, LatencyAnalyzerEdge[]>,
  averageLatency: Map<string, number>,
): { ids: string[]; latencyMs: number } {
  const hasIncoming = new Set<string>()

  for (const edges of outgoing.values()) {
    for (const edge of edges) hasIncoming.add(edge.target)
  }

  const starts = nodes
    .filter((node) => ENTRY_TYPES.has(node.type) || !hasIncoming.has(node.id))
    .map((node) => node.id)

  const memo = new Map<string, { ids: string[]; latencyMs: number }>()
  const visiting = new Set<string>()

  const visit = (nodeId: string): { ids: string[]; latencyMs: number } => {
    const cached = memo.get(nodeId)
    if (cached) return cached
    if (visiting.has(nodeId)) return { ids: [], latencyMs: 0 }

    visiting.add(nodeId)

    let bestChild = { ids: [] as string[], latencyMs: 0 }
    for (const edge of outgoing.get(nodeId) ?? []) {
      const child = visit(edge.target)
      if (child.latencyMs > bestChild.latencyMs) bestChild = child
    }

    visiting.delete(nodeId)

    const result = {
      ids: [nodeId, ...bestChild.ids],
      latencyMs: (averageLatency.get(nodeId) ?? 0) + bestChild.latencyMs,
    }

    memo.set(nodeId, result)
    return result
  }

  let best = { ids: [] as string[], latencyMs: 0 }

  for (const start of starts) {
    const candidate = visit(start)
    if (candidate.latencyMs > best.latencyMs) best = candidate
  }

  if (best.ids.length === 0 && nodes.length > 0) {
    return nodes.reduce(
      (current, node) =>
        (averageLatency.get(node.id) ?? 0) > current.latencyMs
          ? { ids: [node.id], latencyMs: averageLatency.get(node.id) ?? 0 }
          : current,
      { ids: [] as string[], latencyMs: 0 },
    )
  }

  return best
}

function severity(
  aggregate: {
    p95: number
    maxLoad: number
    avgError: number
    downTicks: number
  },
  baseline: number | null,
): LatencySeverity {
  const aboveBaseline = baseline !== null && aggregate.p95 > baseline
  const farAboveBaseline = baseline !== null && aggregate.p95 >= baseline * 2

  if (aggregate.downTicks > 0 || aggregate.maxLoad >= 100 || farAboveBaseline || aggregate.avgError >= 10) {
    return 'Critical'
  }

  if (
    aggregate.maxLoad >= 85 ||
    (baseline !== null && aggregate.p95 >= baseline * 1.5) ||
    aggregate.avgError >= 5
  ) {
    return 'High'
  }

  if (aggregate.maxLoad >= 70 || aboveBaseline) return 'Medium'
  return 'Low'
}

function recommendation(type: string, maxLoad: number, p95: number, baseline: number | null): string {
  if (maxLoad >= 100) {
    return `Reduce load or increase effective ${type} capacity; the simulation observed saturation or overload.`
  }

  if (maxLoad >= 85) {
    return `Increase capacity, concurrency, or replicas for this ${type}, then re-run the simulation to verify the latency reduction.`
  }

  if (baseline !== null && p95 > baseline) {
    return `Investigate queueing or service-time pressure on this ${type}; tune its latency configuration or capacity and re-run the simulation.`
  }

  if (type === 'database' || type === 'dataWarehouse' || type === 'searchIndex') {
    return `Review query/read latency and connection capacity for this ${type}; reduce expensive operations before adding more traffic.`
  }

  if (type === 'cache' || type === 'cdn') {
    return `Review cache hit rate and miss latency; improving hit behavior can remove work from downstream components.`
  }

  return `Inspect this ${type}'s latency contribution and downstream dependencies, then re-run the simulation after the targeted change.`
}

export function analyzeLatency(
  nodes: LatencyAnalyzerNode[],
  edges: LatencyAnalyzerEdge[],
  simulation: SimulationResult | null | undefined,
): LatencyAnalysisResult {
  if (!simulation || simulation.ticks.length === 0) {
    return {
      hasSimulation: false,
      sampleCount: 0,
      overallP50Ms: null,
      overallP95Ms: null,
      overallP99Ms: null,
      mainBottleneck: null,
      criticalPath: [],
      criticalPathLatencyMs: null,
      findings: [],
    }
  }

  const { outgoing } = buildGraph(nodes, edges)
  const labels = new Map(nodes.map((node) => [node.id, node.label || node.id]))
  const aggregates = new Map<string, NodeAggregate>()

  for (const node of nodes) {
    aggregates.set(node.id, { latencies: [], loads: [], errors: [], downTicks: 0 })
  }

  const globalP50Samples: number[] = []
  const globalP95Samples: number[] = []
  const globalP99Samples: number[] = []

  for (const tick of simulation.ticks) {
    globalP50Samples.push(tick.global.p50)
    globalP95Samples.push(tick.global.p95)
    globalP99Samples.push(tick.global.p99)

    for (const node of nodes) {
      const stats = tick.nodes[node.id]
      if (!stats) continue

      const aggregate = aggregates.get(node.id)!
      aggregate.latencies.push(stats.avgLatencyMs)
      aggregate.loads.push(stats.loadPct)
      aggregate.errors.push(stats.errorRatePct)
      if (stats.down) aggregate.downTicks += 1
    }
  }

  const averageLatency = new Map<string, number>()
  for (const node of nodes) {
    averageLatency.set(node.id, average(aggregates.get(node.id)?.latencies ?? []))
  }

  const path = findCriticalPath(nodes, outgoing, averageLatency)
  const pathSet = new Set(path.ids)
  const pathLatency = path.latencyMs > 0 ? path.latencyMs : null

  const findings = nodes
    .map((node) => {
      const aggregate = aggregates.get(node.id)
      if (!aggregate || aggregate.latencies.length === 0) return null

      const avgLatencyMs = average(aggregate.latencies)
      const p95LatencyMs = percentile(aggregate.latencies, 0.95)
      const maxLatencyMs = Math.max(...aggregate.latencies)
      const avgLoadPct = average(aggregate.loads)
      const maxLoadPct = Math.max(...aggregate.loads)
      const avgErrorRatePct = average(aggregate.errors)
      const baselineLatencyMs = configuredLatency(node)

      const nodeSeverity = severity(
        {
          p95: p95LatencyMs,
          maxLoad: maxLoadPct,
          avgError: avgErrorRatePct,
          downTicks: aggregate.downTicks,
        },
        baselineLatencyMs,
      )

      const downstream = collectDescendants(node.id, outgoing, labels)

      const latencyContributionPct =
        pathSet.has(node.id) && pathLatency
          ? round((avgLatencyMs / pathLatency) * 100)
          : null

      const reasons: string[] = []

      if (pathSet.has(node.id)) {
        reasons.push('It lies on the highest-latency dependency path derived from the simulated graph.')
      }

      if (maxLoadPct >= 85) {
        reasons.push(`Peak utilization reached ${round(maxLoadPct)}%.`)
      }

      if (baselineLatencyMs !== null && p95LatencyMs > baselineLatencyMs) {
        reasons.push(
          `Observed node p95 latency (${round(p95LatencyMs)} ms) exceeded its configured latency baseline (${round(baselineLatencyMs)} ms).`,
        )
      }

      if (avgErrorRatePct >= 5) {
        reasons.push(`Average node error rate reached ${round(avgErrorRatePct)}%.`)
      }

      if (reasons.length === 0) {
        reasons.push(`Observed p95 node latency was ${round(p95LatencyMs)} ms.`)
      }

      return {
        nodeId: node.id,
        label: node.label || node.id,
        type: node.type,
        severity: nodeSeverity,
        avgLatencyMs: round(avgLatencyMs),
        p95LatencyMs: round(p95LatencyMs),
        maxLatencyMs: round(maxLatencyMs),
        avgLoadPct: round(avgLoadPct),
        maxLoadPct: round(maxLoadPct),
        avgErrorRatePct: round(avgErrorRatePct),
        latencyContributionPct,
        baselineLatencyMs: baselineLatencyMs === null ? null : round(baselineLatencyMs),
        downstreamComponents: downstream.slice(0, 8),
        criticalPath: path.ids.map((id) => labels.get(id) ?? id),
        reason: reasons.join(' '),
        recommendation: recommendation(node.type, maxLoadPct, p95LatencyMs, baselineLatencyMs),
      } satisfies LatencyFinding
    })
    .filter((finding): finding is LatencyFinding => Boolean(finding))
    .filter((finding) =>
      finding.avgLatencyMs > 0 ||
      finding.maxLoadPct >= 70 ||
      finding.avgErrorRatePct >= 5 ||
      (finding.latencyContributionPct !== null && finding.latencyContributionPct > 0),
    )
    .filter((finding) => finding.severity !== 'Low' || finding.latencyContributionPct !== null)
    .sort((a, b) => {
      const severityRank: Record<LatencySeverity, number> = {
        Critical: 4,
        High: 3,
        Medium: 2,
        Low: 1,
      }
      return severityRank[b.severity] - severityRank[a.severity] || b.p95LatencyMs - a.p95LatencyMs
    })

  const pathFindings = path.ids
    .map((id) => findings.find((finding) => finding.nodeId === id))
    .filter((finding): finding is LatencyFinding => Boolean(finding))
    .sort((a, b) =>
      (b.latencyContributionPct ?? 0) - (a.latencyContributionPct ?? 0) ||
      b.p95LatencyMs - a.p95LatencyMs,
    )

  const mainBottleneck =
    pathFindings[0] ??
    findings.find((finding) => finding.severity === 'Critical') ??
    findings[0] ??
    null

  return {
    hasSimulation: true,
    sampleCount: simulation.ticks.length,
    overallP50Ms: round(percentile(globalP50Samples, 0.5)),
    overallP95Ms: round(simulation.summary.p95 || percentile(globalP95Samples, 0.95)),
    overallP99Ms: round(percentile(globalP99Samples, 0.99)),
    mainBottleneck,
    criticalPath: path.ids.map((id) => labels.get(id) ?? id),
    criticalPathLatencyMs: pathLatency === null ? null : round(pathLatency),
    findings,
  }
}
