export type SPOFSeverity = 'Critical' | 'High' | 'Medium' | 'Low'

export interface SPOFAnalyzerNode {
  id: string
  type: string
  label: string
  config: Record<string, unknown>
}

export interface SPOFAnalyzerEdge {
  id: string
  source: string
  target: string
}

export interface SPOFFinding {
  nodeId: string
  label: string
  type: string
  severity: SPOFSeverity
  reason: string
  impact: string[]
  dependencyChain: string[]
  redundant: boolean
  redundancyExplanation: string
  recommendation: string
}

export interface SPOFAnalysisResult {
  findings: SPOFFinding[]
  checkedNodeCount: number
}

const CLIENT_TYPES = new Set(['client', 'mobile', 'webBrowser', 'iotDevice'])
const REPLICATED_DATA_TYPES = new Set(['database', 'searchIndex'])
const BASIC_SPOF_TYPES = new Set(['service', 'cache', 'queue', 'messageBroker', 'dataWarehouse'])

function replicaCount(node: SPOFAnalyzerNode) {
  return Number(node.config?.replicaCount ?? 0)
}

function isCandidate(node: SPOFAnalyzerNode, incoming: Map<string, SPOFAnalyzerEdge[]>) {
  if (CLIENT_TYPES.has(node.type) || (incoming.get(node.id)?.length ?? 0) === 0) return false
  if (REPLICATED_DATA_TYPES.has(node.type)) return replicaCount(node) <= 0
  return BASIC_SPOF_TYPES.has(node.type)
}

function reachableFromClients(nodes: SPOFAnalyzerNode[], outgoing: Map<string, SPOFAnalyzerEdge[]>) {
  const reachable = new Set<string>()
  const queue = nodes.filter((node) => CLIENT_TYPES.has(node.type)).map((node) => node.id)
  queue.forEach((id) => reachable.add(id))
  for (let i = 0; i < queue.length; i += 1) {
    const id = queue[i]
    for (const edge of outgoing.get(id) ?? []) {
      if (!reachable.has(edge.target)) {
        reachable.add(edge.target)
        queue.push(edge.target)
      }
    }
  }
  return reachable
}

function collectDescendants(nodeId: string, outgoing: Map<string, SPOFAnalyzerEdge[]>, labels: Map<string, string>) {
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

function findRedundancy(node: SPOFAnalyzerNode, nodesById: Map<string, SPOFAnalyzerNode>, incoming: Map<string, SPOFAnalyzerEdge[]>, outgoing: Map<string, SPOFAnalyzerEdge[]>) {
  const replicas = replicaCount(node)
  if (REPLICATED_DATA_TYPES.has(node.type)) {
    if (replicas > 0) return { redundant: true, explanation: `${replicas} configured replica${replicas === 1 ? '' : 's'} provide an explicit redundancy signal.` }
    return { redundant: false, explanation: 'No configured replica is present.' }
  }

  const sameType = [...nodesById.values()].filter((candidate) => candidate.id !== node.id && candidate.type === node.type)
  const incomingSources = new Set((incoming.get(node.id) ?? []).map((edge) => edge.source))
  const parallel = sameType.find((candidate) => {
    const candidateSources = new Set((incoming.get(candidate.id) ?? []).map((edge) => edge.source))
    return [...incomingSources].some((source) => candidateSources.has(source))
  })
  if (parallel) {
    return { redundant: true, explanation: `${parallel.type} component ${parallel.id} shares an upstream dependency, providing an alternate component path.` }
  }

  const outgoingTargets = new Set((outgoing.get(node.id) ?? []).map((edge) => edge.target))
  const alternateParent = sameType.find((candidate) =>
    [...(outgoing.get(candidate.id) ?? [])].some((edge) => outgoingTargets.has(edge.target)),
  )
  if (alternateParent) {
    return { redundant: true, explanation: `Another ${alternateParent.type} component reaches the same downstream dependency.` }
  }

  return { redundant: false, explanation: 'No explicit replica or parallel same-type component path was found.' }
}

function severity(node: SPOFAnalyzerNode, clientReachable: boolean, impactCount: number, redundant: boolean): SPOFSeverity {
  if (redundant) return 'Medium'
  if (REPLICATED_DATA_TYPES.has(node.type) && clientReachable && impactCount > 0) return 'Critical'
  if (clientReachable && impactCount > 0) return 'High'
  if (impactCount > 0) return 'Medium'
  return 'Low'
}

export function analyzeSPOFs(
  nodes: SPOFAnalyzerNode[],
  edges: SPOFAnalyzerEdge[],
  existingSpofIds: string[] = [],
): SPOFAnalysisResult {
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const labels = new Map(nodes.map((node) => [node.id, node.label || node.type]))
  const incoming = new Map<string, SPOFAnalyzerEdge[]>()
  const outgoing = new Map<string, SPOFAnalyzerEdge[]>()

  for (const edge of edges) {
    if (!nodesById.has(edge.source) || !nodesById.has(edge.target)) continue
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge])
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge])
  }

  const structurallyDetected = nodes.filter((node) => isCandidate(node, incoming)).map((node) => node.id)
  const candidateIds = [...new Set([...structurallyDetected, ...existingSpofIds])]
  const clientReachable = reachableFromClients(nodes, outgoing)

  const findings = candidateIds
    .map((nodeId) => nodesById.get(nodeId))
    .filter((node): node is SPOFAnalyzerNode => Boolean(node))
    .map((node) => {
      const redundancy = findRedundancy(node, nodesById, incoming, outgoing)
      const impact = collectDescendants(node.id, outgoing, labels)
      const upstream = (incoming.get(node.id) ?? []).map((edge) => labels.get(edge.source) ?? edge.source)
      const nodeSeverity = severity(node, clientReachable.has(node.id), impact.length, redundancy.redundant)
      const reason = REPLICATED_DATA_TYPES.has(node.type)
        ? `${node.type} has no configured replicas.`
        : `${node.type} is a single component on a request path and the analyzer found no explicit replica configuration.`
      const dependencyChain = [labels.get(node.id) ?? node.id, ...impact]
      const impactText = impact.length > 0
        ? `A failure can affect ${impact.slice(0, 4).join(', ')}${impact.length > 4 ? ` and ${impact.length - 4} more component${impact.length - 5 === 0 ? '' : 's'}` : ''}.`
        : 'No downstream component is connected to this node.'
      const upstreamText = upstream.length > 0 ? ` It is depended on by ${upstream.slice(0, 3).join(', ')}${upstream.length > 3 ? ' and other upstream components.' : '.'}` : ''
      const recommendation = redundancy.redundant
        ? 'Keep the alternate path/component and verify that failure injection routes traffic through it.'
        : REPLICATED_DATA_TYPES.has(node.type)
          ? `Add a replica for this ${node.type} and connect the replica path before relying on it as a shared dependency.`
          : `Add another ${node.type} instance on a parallel path and connect it to the same relevant upstream/downstream flow.`

      return {
        nodeId: node.id,
        label: node.label || node.type,
        type: node.type,
        severity: nodeSeverity,
        reason: `${reason}${upstreamText}`,
        impact: impact.length > 0 ? impact : ['No downstream dependents'],
        dependencyChain,
        redundant: redundancy.redundant,
        redundancyExplanation: redundancy.explanation,
        recommendation: impactText + ' ' + recommendation,
      }
    })
    .sort((a, b) => ({ Critical: 0, High: 1, Medium: 2, Low: 3 }[a.severity] - { Critical: 0, High: 1, Medium: 2, Low: 3 }[b.severity]))

  return { findings, checkedNodeCount: nodes.length }
}
