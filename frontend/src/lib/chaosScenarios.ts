import type { InjectedFailure, SimulationResult } from './api'

export type ChaosScenarioId =
  | 'trafficSpike'
  | 'databaseFailure'
  | 'networkDegradation'
  | 'dependencyFailure'
  | 'cascadingFailure'
  | 'recoveryTest'

export interface ChaosScenarioDefinition {
  id: ChaosScenarioId
  label: string
  description: string
  targetKind: 'none' | 'node' | 'edge'
  allowedTypes?: string[]
}

export interface ChaosScenarioConfig {
  id: ChaosScenarioId
  targetNodeId?: string
  targetEdgeId?: string
  trafficMultiplier?: number
  latencyMs?: number
  dropPct?: number
  throttlePct?: number
}

export interface ChaosScenarioPlan {
  definition: ChaosScenarioDefinition
  failures: InjectedFailure[]
  trafficMultiplier: number
  steps: string[]
}

export interface ChaosChangedNode {
  nodeId: string
  label: string
  latencyDeltaMs: number
  loadDeltaPct: number
  errorDeltaPct: number
  becameDown: boolean
  downstreamOfTarget: boolean
}

export interface ChaosExperimentAnalysis {
  before: { p95Ms: number; errorRatePct: number; rps: number } | null
  after: { p95Ms: number; errorRatePct: number; rps: number }
  blastRadiusCount: number
  blastRadiusPct: number
  changedNodes: ChaosChangedNode[]
  cascadingFailureCount: number
  cascadingFailureNodes: string[]
  recovery: {
    tested: boolean
    recovered: boolean
    recoveryTick: number | null
    explanation: string
  }
  recommendations: string[]
}

export interface ChaosHistoryEntry {
  id: string
  scenarioId: ChaosScenarioId
  scenarioLabel: string
  targetLabel: string
  recordedAt: string
  trafficMultiplier: number
  blastRadiusCount: number
  blastRadiusPct: number
  cascadingFailureCount: number
  recovered: boolean | null
  beforeP95Ms: number | null
  afterP95Ms: number
  beforeErrorRatePct: number | null
  afterErrorRatePct: number
}

export const CHAOS_SCENARIOS: ChaosScenarioDefinition[] = [
  {
    id: 'trafficSpike',
    label: 'Traffic Spike',
    description: 'Increase incoming traffic to expose saturation and capacity limits.',
    targetKind: 'none',
  },
  {
    id: 'databaseFailure',
    label: 'Database Failure',
    description: 'Kill a database and observe direct and downstream impact.',
    targetKind: 'node',
    allowedTypes: ['database', 'dataWarehouse', 'dataLake', 'objectStorage'],
  },
  {
    id: 'networkDegradation',
    label: 'Network Degradation',
    description: 'Drop traffic on a dependency edge to simulate packet loss.',
    targetKind: 'edge',
  },
  {
    id: 'dependencyFailure',
    label: 'Dependency Failure',
    description: 'Kill a shared dependency and measure the blast radius.',
    targetKind: 'node',
  },
  {
    id: 'cascadingFailure',
    label: 'Cascading Failure',
    description: 'Apply staged degradation to a component so downstream effects can propagate.',
    targetKind: 'node',
  },
  {
    id: 'recoveryTest',
    label: 'Service Recovery',
    description: 'Fail a component temporarily, then restore it and measure recovery.',
    targetKind: 'node',
  },
]

function getDefinition(id: ChaosScenarioId): ChaosScenarioDefinition {
  return CHAOS_SCENARIOS.find((scenario) => scenario.id === id) ?? CHAOS_SCENARIOS[0]
}

export function getScenarioTargets(
  scenarioId: ChaosScenarioId,
  nodes: { id: string; type: string }[],
  edges: { id: string; source: string; target: string }[],
) {
  const definition = getDefinition(scenarioId)
  if (definition.targetKind === 'none') return []
  if (definition.targetKind === 'edge') return edges
  return definition.allowedTypes
    ? nodes.filter((node) => definition.allowedTypes!.includes(node.type))
    : nodes.filter((node) => !['client', 'mobile', 'webBrowser', 'iotDevice'].includes(node.type))
}

export function buildChaosScenario(
  config: ChaosScenarioConfig,
): ChaosScenarioPlan {
  const definition = getDefinition(config.id)
  const trafficMultiplier = Math.max(1, config.trafficMultiplier ?? 5)
  const latencyMs = Math.max(1, config.latencyMs ?? 250)
  const dropPct = Math.max(1, Math.min(100, config.dropPct ?? 30))
  const throttlePct = Math.max(1, Math.min(100, config.throttlePct ?? 60))

  switch (config.id) {
    case 'trafficSpike':
      return {
        definition,
        failures: [],
        trafficMultiplier,
        steps: [`Traffic increases to ${trafficMultiplier}× baseline.`, 'Observe saturation, queueing, latency, and error-rate changes.'],
      }

    case 'databaseFailure':
      return {
        definition,
        failures: config.targetNodeId
          ? [{ type: 'kill', nodeId: config.targetNodeId, fromTick: 10 }]
          : [],
        trafficMultiplier: 1,
        steps: ['Ticks 0–9: baseline traffic.', 'Tick 10+: target data component is unavailable.', 'Observe downstream error and latency propagation.'],
      }

    case 'networkDegradation':
      return {
        definition,
        failures: config.targetEdgeId
          ? [{ type: 'dropPct', edgeId: config.targetEdgeId, fromTick: 10, dropPct }]
          : [],
        trafficMultiplier: 1,
        steps: ['Ticks 0–9: baseline traffic.', `Tick 10+: ${dropPct}% of traffic on the selected edge is dropped.`, 'Observe downstream throughput and errors.'],
      }

    case 'dependencyFailure':
      return {
        definition,
        failures: config.targetNodeId
          ? [{ type: 'kill', nodeId: config.targetNodeId, fromTick: 10 }]
          : [],
        trafficMultiplier: 1,
        steps: ['Ticks 0–9: baseline traffic.', 'Tick 10+: shared dependency is unavailable.', 'Measure the dependency blast radius.'],
      }

    case 'cascadingFailure':
      return {
        definition,
        failures: config.targetNodeId
          ? [
              { type: 'throttle', nodeId: config.targetNodeId, fromTick: 10, throttlePct },
              { type: 'latency', nodeId: config.targetNodeId, fromTick: 35, extraMs: latencyMs },
            ]
          : [],
        trafficMultiplier: 1,
        steps: [
          `Tick 10+: reduce target capacity by ${throttlePct}%.`,
          `Tick 35+: add ${latencyMs} ms latency to the same target.`,
          'Observe whether degradation propagates into downstream components.',
        ],
      }

    case 'recoveryTest':
      return {
        definition,
        failures: config.targetNodeId
          ? [{ type: 'kill', nodeId: config.targetNodeId, fromTick: 10, toTick: 40 }]
          : [],
        trafficMultiplier: 1,
        steps: ['Ticks 0–9: baseline traffic.', 'Ticks 10–40: target component is failed.', 'Tick 41+: failure is removed and recovery can be observed.'],
      }
  }
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

function round(value: number): number {
  return Math.round(value * 10) / 10
}

function downstreamIds(
  targetId: string | undefined,
  edges: { source: string; target: string }[],
): Set<string> {
  if (!targetId) return new Set()
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target])
  const seen = new Set<string>()
  const queue = [...(outgoing.get(targetId) ?? [])]
  for (let i = 0; i < queue.length; i += 1) {
    const id = queue[i]
    if (seen.has(id)) continue
    seen.add(id)
    queue.push(...(outgoing.get(id) ?? []))
  }
  return seen
}

function nodeAverages(simulation: SimulationResult) {
  const byNode = new Map<string, { p95: number[]; load: number[]; error: number[]; down: number }>()
  for (const tick of simulation.ticks) {
    for (const [nodeId, stats] of Object.entries(tick.nodes)) {
      const entry = byNode.get(nodeId) ?? { p95: [], load: [], error: [], down: 0 }
      entry.p95.push(stats.avgLatencyMs)
      entry.load.push(stats.loadPct)
      entry.error.push(stats.errorRatePct)
      if (stats.down) entry.down += 1
      byNode.set(nodeId, entry)
    }
  }
  return byNode
}

export function analyzeChaosExperiment(
  baseline: SimulationResult | null,
  after: SimulationResult,
  nodes: { id: string; label: string }[],
  edges: { source: string; target: string }[],
  targetNodeId?: string,
  recoveryFailure?: InjectedFailure,
): ChaosExperimentAnalysis {
  const before = baseline
    ? {
        p95Ms: baseline.summary.p95,
        errorRatePct: baseline.summary.avgErrorRatePct,
        rps: baseline.summary.avgRps,
      }
    : null

  const baselineNodes = baseline ? nodeAverages(baseline) : new Map()
  const afterNodes = nodeAverages(after)
  const labels = new Map(nodes.map((node) => [node.id, node.label]))
  const downstream = downstreamIds(targetNodeId, edges)

  const changedNodes: ChaosChangedNode[] = []
  for (const [nodeId, current] of afterNodes) {
    const previous = baselineNodes.get(nodeId)
    if (!previous) continue
    const latencyDeltaMs = average(current.p95) - average(previous.p95)
    const loadDeltaPct = average(current.load) - average(previous.load)
    const errorDeltaPct = average(current.error) - average(previous.error)
    const becameDown = current.down > 0 && previous.down === 0
    const materiallyChanged =
      Math.abs(latencyDeltaMs) >= 10 ||
      Math.abs(loadDeltaPct) >= 10 ||
      Math.abs(errorDeltaPct) >= 1 ||
      becameDown

    if (materiallyChanged) {
      changedNodes.push({
        nodeId,
        label: labels.get(nodeId) ?? nodeId,
        latencyDeltaMs: round(latencyDeltaMs),
        loadDeltaPct: round(loadDeltaPct),
        errorDeltaPct: round(errorDeltaPct),
        becameDown,
        downstreamOfTarget: downstream.has(nodeId),
      })
    }
  }

  const blastRadiusCount = changedNodes.length
  const blastRadiusPct = nodes.length ? round((blastRadiusCount / nodes.length) * 100) : 0
  const cascadingNodes = changedNodes
    .filter((node) => node.nodeId !== targetNodeId && node.downstreamOfTarget)
    .map((node) => node.label)

  let recovery = {
    tested: Boolean(recoveryFailure?.toTick != null),
    recovered: false,
    recoveryTick: recoveryFailure?.toTick != null ? recoveryFailure.toTick + 1 : null,
    explanation: 'Recovery was not explicitly scheduled in this experiment.',
  }

  if (recovery.tested) {
    const recoveryTick = recoveryFailure!.toTick! + 1
    const preRecoveryTicks = after.ticks.filter((tick) => tick.t >= Math.max(1, recoveryTick - 10) && tick.t < recoveryTick)
    const postRecoveryTicks = after.ticks.filter((tick) => tick.t >= recoveryTick + 5 && tick.t <= recoveryTick + 15)
    const preError = average(preRecoveryTicks.map((tick) => tick.global.errorRatePct))
    const postError = average(postRecoveryTicks.map((tick) => tick.global.errorRatePct))
    const preP95 = average(preRecoveryTicks.map((tick) => tick.global.p95))
    const postP95 = average(postRecoveryTicks.map((tick) => tick.global.p95))
    recovery.recovered = postRecoveryTicks.length > 0 && postError <= preError && postP95 <= preP95
    recovery.explanation = recovery.recovered
      ? `After tick ${recoveryTick}, error rate and p95 latency moved back toward the pre-recovery window.`
      : `After tick ${recoveryTick}, the post-recovery window did not return to or below the pre-recovery error/latency window.`
  }

  const recommendations: string[] = []
  if (!baseline) recommendations.push('Capture a baseline simulation before repeating the experiment to enable direct before/after comparison.')
  if (blastRadiusCount > 0) recommendations.push(`${blastRadiusCount} component${blastRadiusCount === 1 ? '' : 's'} changed materially; inspect those dependencies before treating the architecture as resilient.`)
  if (cascadingNodes.length > 0) recommendations.push(`Review cascading impact on ${cascadingNodes.slice(0, 4).join(', ')}${cascadingNodes.length > 4 ? ' and other downstream components' : ''}.`)
  if (after.summary.avgErrorRatePct >= 5) recommendations.push('Error rate reached at least 5%; verify fallback, retry, timeout, and redundancy behavior for the affected path.')
  if (after.summary.p95 > 0 && baseline && after.summary.p95 > baseline.summary.p95) recommendations.push('Scenario p95 latency increased versus baseline; inspect queueing and the highest-latency dependency path.')
  if (recovery.tested && !recovery.recovered) recommendations.push('Recovery did not return metrics to the pre-recovery window; inspect restart, failover, warm-up, and dependency recovery behavior.')
  if (recommendations.length === 0) recommendations.push('No material degradation was detected by the configured comparison thresholds; increase scenario intensity if you need a stronger resilience test.')

  return {
    before,
    after: {
      p95Ms: after.summary.p95,
      errorRatePct: after.summary.avgErrorRatePct,
      rps: after.summary.avgRps,
    },
    blastRadiusCount,
    blastRadiusPct,
    changedNodes: changedNodes.sort((a, b) => Math.abs(b.latencyDeltaMs) - Math.abs(a.latencyDeltaMs)),
    cascadingFailureCount: cascadingNodes.length,
    cascadingFailureNodes: cascadingNodes,
    recovery,
    recommendations,
  }
}
