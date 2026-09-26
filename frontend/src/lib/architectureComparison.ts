import type { SimulationSummary } from './api'
import { estimateTotalMonthlyCost, replicasOf } from './cost'
import type { ComponentType } from '../components/nodes'
import { analyzeSPOFs } from './spofAnalyzer'

export interface ComparisonNode {
  id: string
  type: string
  label: string
  config: Record<string, unknown>
  replicas?: number
}

export interface ComparisonEdge {
  id: string
  source: string
  target: string
}

export interface ArchitectureSnapshot {
  name: string
  capturedAt: number
  nodes: ComparisonNode[]
  edges: ComparisonEdge[]
  summary: SimulationSummary | null
  estimatedMonthlyCost: number
}

export interface ArchitectureMetrics {
  nodeCount: number
  edgeCount: number
  maxDependencyDepth: number
  averageOutDegree: number
  replicatedNodeCount: number
  estimatedMonthlyCost: number
  spofCount: number
  p95Ms: number | null
  errorRatePct: number | null
  throughputRps: number | null
  bottleneckLoadPct: number | null
}

export interface ArchitectureChange {
  nodeId: string
  label: string
  fromType: string | null
  toType: string | null
  change: 'Added' | 'Removed' | 'Type changed'
}

export interface ArchitectureComparisonResult {
  baseline: ArchitectureSnapshot
  current: ArchitectureSnapshot
  baselineMetrics: ArchitectureMetrics
  currentMetrics: ArchitectureMetrics
  deltas: {
    nodeCount: number
    edgeCount: number
    maxDependencyDepth: number
    replicatedNodeCount: number
    estimatedMonthlyCost: number
    spofCount: number
    p95Ms: number | null
    errorRatePct: number | null
    throughputRps: number | null
    bottleneckLoadPct: number | null
  }
  changes: ArchitectureChange[]
  tradeoffs: string[]
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function maxDependencyDepth(nodes: ComparisonNode[], edges: ComparisonEdge[]): number {
  if (nodes.length === 0) return 0

  const nodeIds = new Set(nodes.map((node) => node.id))
  const outgoing = new Map<string, string[]>()
  const incoming = new Set<string>()

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target])
    incoming.add(edge.target)
  }

  const starts = nodes
    .filter((node) => !incoming.has(node.id))
    .map((node) => node.id)

  const memo = new Map<string, number>()
  const visiting = new Set<string>()

  const visit = (id: string): number => {
    const cached = memo.get(id)
    if (cached !== undefined) return cached
    if (visiting.has(id)) return 1

    visiting.add(id)
    let childDepth = 0
    for (const child of outgoing.get(id) ?? []) {
      childDepth = Math.max(childDepth, visit(child))
    }
    visiting.delete(id)

    const depth = 1 + childDepth
    memo.set(id, depth)
    return depth
  }

  const candidateStarts = starts.length ? starts : nodes.map((node) => node.id)
  return Math.max(...candidateStarts.map(visit))
}

function toSpofNodes(nodes: ComparisonNode[]) {
  return nodes.map((node) => ({
    id: node.id,
    type: node.type,
    label: node.label,
    config: node.config,
    replicas: node.replicas,
  }))
}

export function calculateArchitectureMetrics(snapshot: ArchitectureSnapshot): ArchitectureMetrics {
  const { nodes, edges } = snapshot
  const replicatedNodeCount = nodes.filter((node) => {
    const replicas = node.replicas ?? replicasOf(node.type, node.config, node.replicas)
    return replicas > 1
  }).length

  const outDegree = new Map<string, number>()
  for (const edge of edges) outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1)

  const spof = analyzeSPOFs(
    toSpofNodes(nodes),
    edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
    snapshot.summary?.singlePointsOfFailure ?? [],
  )

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    maxDependencyDepth: maxDependencyDepth(nodes, edges),
    averageOutDegree: Number(average(nodes.map((node) => outDegree.get(node.id) ?? 0)).toFixed(2)),
    replicatedNodeCount,
    estimatedMonthlyCost: snapshot.estimatedMonthlyCost,
    spofCount: spof.findings.length,
    p95Ms: snapshot.summary?.p95 ?? null,
    errorRatePct: snapshot.summary?.avgErrorRatePct ?? null,
    throughputRps: snapshot.summary?.avgRps ?? null,
    bottleneckLoadPct: snapshot.summary?.bottleneckLoadPct ?? null,
  }
}

export function createArchitectureSnapshot(
  name: string,
  nodes: ComparisonNode[],
  edges: ComparisonEdge[],
  summary: SimulationSummary | null,
): ArchitectureSnapshot {
  const normalizedNodes = nodes.map((node) => ({
    ...node,
    config: { ...(node.config ?? {}) },
  }))

  const estimatedMonthlyCost = estimateTotalMonthlyCost(
    normalizedNodes.map((node) => ({
      type: node.type as ComponentType,
      replicas: replicasOf(node.type, node.config, node.replicas),
      config: node.config,
    })),
  )

  return {
    name,
    capturedAt: Date.now(),
    nodes: normalizedNodes,
    edges: edges.map((edge) => ({ ...edge })),
    summary,
    estimatedMonthlyCost,
  }
}

export function compareArchitectures(
  baseline: ArchitectureSnapshot,
  current: ArchitectureSnapshot,
): ArchitectureComparisonResult {
  const baselineMetrics = calculateArchitectureMetrics(baseline)
  const currentMetrics = calculateArchitectureMetrics(current)

  const baselineById = new Map(baseline.nodes.map((node) => [node.id, node]))
  const currentById = new Map(current.nodes.map((node) => [node.id, node]))
  const changes: ArchitectureChange[] = []

  for (const node of current.nodes) {
    const previous = baselineById.get(node.id)
    if (!previous) {
      changes.push({ nodeId: node.id, label: node.label, fromType: null, toType: node.type, change: 'Added' })
    } else if (previous.type !== node.type) {
      changes.push({ nodeId: node.id, label: node.label, fromType: previous.type, toType: node.type, change: 'Type changed' })
    }
  }

  for (const node of baseline.nodes) {
    if (!currentById.has(node.id)) {
      changes.push({ nodeId: node.id, label: node.label, fromType: node.type, toType: null, change: 'Removed' })
    }
  }

  const delta = <K extends keyof ArchitectureComparisonResult['deltas']>(key: K) => {
    const currentValue = currentMetrics[key]
    const baselineValue = baselineMetrics[key]
    if (currentValue === null || baselineValue === null) return null
    return Number((currentValue - baselineValue).toFixed(2))
  }

  const deltas = {
    nodeCount: currentMetrics.nodeCount - baselineMetrics.nodeCount,
    edgeCount: currentMetrics.edgeCount - baselineMetrics.edgeCount,
    maxDependencyDepth: currentMetrics.maxDependencyDepth - baselineMetrics.maxDependencyDepth,
    replicatedNodeCount: currentMetrics.replicatedNodeCount - baselineMetrics.replicatedNodeCount,
    estimatedMonthlyCost: Number((currentMetrics.estimatedMonthlyCost - baselineMetrics.estimatedMonthlyCost).toFixed(2)),
    spofCount: currentMetrics.spofCount - baselineMetrics.spofCount,
    p95Ms: delta('p95Ms'),
    errorRatePct: delta('errorRatePct'),
    throughputRps: delta('throughputRps'),
    bottleneckLoadPct: delta('bottleneckLoadPct'),
  }

  const tradeoffs: string[] = []

  if (deltas.estimatedMonthlyCost !== 0) {
    tradeoffs.push(`Estimated monthly cost changed by ${deltas.estimatedMonthlyCost >= 0 ? '+' : ''}$${deltas.estimatedMonthlyCost.toLocaleString()}.`)
  }
  if (deltas.p95Ms !== null && deltas.p95Ms !== 0) {
    tradeoffs.push(`Simulated average p95 latency changed by ${deltas.p95Ms >= 0 ? '+' : ''}${deltas.p95Ms} ms.`)
  }
  if (deltas.errorRatePct !== null && deltas.errorRatePct !== 0) {
    tradeoffs.push(`Simulated average error rate changed by ${deltas.errorRatePct >= 0 ? '+' : ''}${deltas.errorRatePct} percentage points.`)
  }
  if (deltas.throughputRps !== null && deltas.throughputRps !== 0) {
    tradeoffs.push(`Simulated average throughput changed by ${deltas.throughputRps >= 0 ? '+' : ''}${deltas.throughputRps} RPS.`)
  }
  if (deltas.bottleneckLoadPct !== null && deltas.bottleneckLoadPct !== 0) {
    tradeoffs.push(`Bottleneck load changed by ${deltas.bottleneckLoadPct >= 0 ? '+' : ''}${deltas.bottleneckLoadPct} percentage points.`)
  }
  if (deltas.spofCount !== 0) {
    tradeoffs.push(`Detected SPOF count changed by ${deltas.spofCount >= 0 ? '+' : ''}${deltas.spofCount}.`)
  }
  if (deltas.replicatedNodeCount !== 0) {
    tradeoffs.push(`Components with more than one configured/effective replica changed by ${deltas.replicatedNodeCount >= 0 ? '+' : ''}${deltas.replicatedNodeCount}.`)
  }
  if (deltas.nodeCount !== 0 || deltas.edgeCount !== 0 || deltas.maxDependencyDepth !== 0) {
    tradeoffs.push(`Architecture structure changed by ${deltas.nodeCount >= 0 ? '+' : ''}${deltas.nodeCount} nodes, ${deltas.edgeCount >= 0 ? '+' : ''}${deltas.edgeCount} edges, and ${deltas.maxDependencyDepth >= 0 ? '+' : ''}${deltas.maxDependencyDepth} maximum dependency-depth levels.`)
  }
  if (tradeoffs.length === 0) tradeoffs.push('No measured structural or simulation metric changed between the captured baseline and the current architecture.')

  return { baseline, current, baselineMetrics, currentMetrics, deltas, changes, tradeoffs }
}

