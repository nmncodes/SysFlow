import type { ComponentType } from '../components/nodes'
import { CONNECTION_RULES, DOWNSTREAM_REQUIREMENTS, ENTRY_TYPES, KNOWN_TYPES } from './architectureRules'

/**
 * Structural + architecture-aware validation of a SysFlow graph.
 * Pure functions, no React / React Flow dependency: pass in plain nodes and
 * edges, get back a list of ValidationResults.
 */

export type ValidationSeverity = 'error' | 'warning' | 'info'

export type ValidationCategory =
  | 'orphan-node'
  | 'unreachable-node'
  | 'no-entry-point'
  | 'invalid-connection'
  | 'missing-connection'
  | 'cycle'
  | 'self-loop'
  | 'duplicate-edge'
  | 'invalid-reference'
  | 'unknown-component'
  | 'internal-error'

export interface ValidationResult {
  /** Deterministic for a given problem, so a UI can key/diff on it. */
  id: string
  severity: ValidationSeverity
  category: ValidationCategory
  message: string
  affectedNodeIds: string[]
  affectedEdgeIds: string[]
}

/** Minimal node shape. GraphJson nodes satisfy this; React Flow nodes need a small mapping. */
export interface ArchitectureNode {
  id: string
  type: string
  label?: string
}

export interface ArchitectureEdge {
  id: string
  source: string
  target: string
}

export interface ValidationSummary {
  errors: number
  warnings: number
  infos: number
  total: number
}

// ---------------------------------------------------------------------------
// Internal graph model
// ---------------------------------------------------------------------------

interface GNode {
  id: string
  /** Null when the type isn't in the component library. */
  type: ComponentType | null
  /** Label, disambiguated with the id when two nodes share a label. */
  name: string
}

interface GEdge {
  id: string
  source: string
  target: string
}

/** Cleaned graph: valid endpoints, no self-loops, no duplicate edges. */
interface Graph {
  nodes: GNode[]
  byId: Map<string, GNode>
  order: Map<string, number>
  edges: GEdge[]
  outgoing: Map<string, GEdge[]>
  incoming: Map<string, GEdge[]>
}

const SEVERITY_RANK: Record<ValidationSeverity, number> = { error: 0, warning: 1, info: 2 }

function result(
  category: ValidationCategory,
  key: string,
  severity: ValidationSeverity,
  message: string,
  affectedNodeIds: string[] = [],
  affectedEdgeIds: string[] = [],
): ValidationResult {
  return { id: `${category}:${key}`, severity, category, message, affectedNodeIds, affectedEdgeIds }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function listNames(names: string[], max = 4): string {
  if (names.length <= max) return names.join(', ')
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`
}

// ---------------------------------------------------------------------------
// Graph construction (also reports malformed data)
// ---------------------------------------------------------------------------

function buildGraph(rawNodes: unknown, rawEdges: unknown): { graph: Graph; issues: ValidationResult[] } {
  const issues: ValidationResult[] = []
  const nodeList: unknown[] = Array.isArray(rawNodes) ? rawNodes : []
  const edgeList: unknown[] = Array.isArray(rawEdges) ? rawEdges : []

  // Nodes: drop entries without a usable id, keep the first of any duplicate id.
  const drafts: { id: string; type: string; label: string }[] = []
  const seen = new Set<string>()
  nodeList.forEach((raw, index) => {
    const id = isRecord(raw) ? nonEmptyString(raw.id) : null
    if (!isRecord(raw) || id === null) {
      issues.push(result('invalid-reference', `node#${index}`, 'error', `Component #${index + 1} has no valid id and was ignored.`))
      return
    }
    if (seen.has(id)) {
      issues.push(result('invalid-reference', `duplicate-node:${id}`, 'error', `More than one component uses the id "${id}"; only the first is validated.`, [id]))
      return
    }
    seen.add(id)
    drafts.push({
      id,
      type: typeof raw.type === 'string' ? raw.type : '',
      label: nonEmptyString(raw.label) ?? id,
    })
  })

  const labelCounts = new Map<string, number>()
  for (const d of drafts) labelCounts.set(d.label, (labelCounts.get(d.label) ?? 0) + 1)

  const nodes: GNode[] = drafts.map((d) => ({
    id: d.id,
    type: KNOWN_TYPES.has(d.type as ComponentType) ? (d.type as ComponentType) : null,
    name: (labelCounts.get(d.label) ?? 0) > 1 && d.label !== d.id ? `${d.label} (${d.id})` : d.label,
  }))
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const order = new Map(nodes.map((n, i) => [n.id, i]))

  drafts.forEach((d, i) => {
    if (nodes[i].type !== null) return
    const what = d.type === '' ? 'has no component type' : `has an unrecognised component type "${d.type}"`
    issues.push(result('unknown-component', d.id, 'warning', `${nodes[i].name} ${what}, so connection rules can't be checked for it.`, [d.id]))
  })

  // Edges: report and drop anything that can't take part in graph analysis.
  const edges: GEdge[] = []
  const pairs = new Map<string, GEdge[]>()
  edgeList.forEach((raw, index) => {
    const rec = isRecord(raw) ? raw : {}
    const id = nonEmptyString(rec.id) ?? `edge#${index}`
    const source = nonEmptyString(rec.source)
    const target = nonEmptyString(rec.target)
    if (source === null || target === null || !byId.has(source) || !byId.has(target)) {
      const present = [source, target].filter((end): end is string => end !== null && byId.has(end))
      issues.push(result('invalid-reference', `edge:${id}`, 'error', `Connection ${id} references a component that doesn't exist and was ignored.`, present, [id]))
      return
    }
    if (source === target) {
      issues.push(result('self-loop', id, 'warning', `${byId.get(source)?.name ?? source} is connected to itself.`, [source], [id]))
      return
    }
    const edge = { id, source, target }
    const key = `${source}\u0000${target}`
    const group = pairs.get(key)
    if (group) {
      group.push(edge)
      return
    }
    pairs.set(key, [edge])
    edges.push(edge)
  })

  for (const group of pairs.values()) {
    if (group.length < 2) continue
    const { source, target } = group[0]
    issues.push(
      result(
        'duplicate-edge',
        `${source}->${target}`,
        'warning',
        `${byId.get(source)?.name} → ${byId.get(target)?.name} is connected ${group.length} times; the extra connections are redundant.`,
        [source, target],
        group.map((e) => e.id),
      ),
    )
  }

  const outgoing = new Map<string, GEdge[]>(nodes.map((n) => [n.id, []]))
  const incoming = new Map<string, GEdge[]>(nodes.map((n) => [n.id, []]))
  for (const e of edges) {
    outgoing.get(e.source)?.push(e)
    incoming.get(e.target)?.push(e)
  }

  return { graph: { nodes, byId, order, edges, outgoing, incoming }, issues }
}

const outDegree = (g: Graph, id: string) => g.outgoing.get(id)?.length ?? 0
const inDegree = (g: Graph, id: string) => g.incoming.get(id)?.length ?? 0
const isOrphan = (g: Graph, id: string) => outDegree(g, id) === 0 && inDegree(g, id) === 0

// ---------------------------------------------------------------------------
// Rule 1 — orphan nodes
// ---------------------------------------------------------------------------

function checkOrphanNodes(g: Graph): ValidationResult[] {
  return g.nodes
    .filter((n) => isOrphan(g, n.id))
    .map((n) => result('orphan-node', n.id, 'warning', `${n.name} is not connected to any other component.`, [n.id]))
}

// ---------------------------------------------------------------------------
// Rule 2 — unreachable nodes
// ---------------------------------------------------------------------------

function reachableFromEntries(g: Graph, entryIds: string[]): Set<string> {
  const visited = new Set(entryIds)
  const queue = [...entryIds]
  for (let head = 0; head < queue.length; head++) {
    for (const e of g.outgoing.get(queue[head]) ?? []) {
      if (visited.has(e.target)) continue
      visited.add(e.target)
      queue.push(e.target)
    }
  }
  return visited
}

/** Groups ids into islands that are weakly connected *within* the given set. */
function islands(g: Graph, ids: Set<string>): string[][] {
  const seen = new Set<string>()
  const groups: string[][] = []
  for (const start of ids) {
    if (seen.has(start)) continue
    const group: string[] = []
    const stack = [start]
    seen.add(start)
    while (stack.length > 0) {
      const id = stack.pop() as string
      group.push(id)
      const neighbours = [...(g.outgoing.get(id) ?? []).map((e) => e.target), ...(g.incoming.get(id) ?? []).map((e) => e.source)]
      for (const next of neighbours) {
        if (!ids.has(next) || seen.has(next)) continue
        seen.add(next)
        stack.push(next)
      }
    }
    groups.push(group.sort((a, b) => (g.order.get(a) ?? 0) - (g.order.get(b) ?? 0)))
  }
  return groups.sort((a, b) => (g.order.get(a[0]) ?? 0) - (g.order.get(b[0]) ?? 0))
}

function checkUnreachableNodes(g: Graph): ValidationResult[] {
  const connected = g.nodes.filter((n) => !isOrphan(g, n.id))
  if (connected.length === 0) return []

  const entryIds = g.nodes.filter((n) => n.type !== null && ENTRY_TYPES.has(n.type)).map((n) => n.id)
  if (entryIds.length === 0) {
    // Without any entry, "unreachable" would flag every node; report the root cause once instead.
    return [
      result(
        'no-entry-point',
        'graph',
        'warning',
        'This architecture has no entry point. Add a Client, Mobile, Web Browser or IoT Device (or a Cron Job / Webhook trigger) so traffic has somewhere to start.',
      ),
    ]
  }

  const reachable = reachableFromEntries(g, entryIds)
  const unreachable = new Set(connected.filter((n) => !reachable.has(n.id)).map((n) => n.id))

  return islands(g, unreachable).map((ids) => {
    const names = ids.map((id) => g.byId.get(id)?.name ?? id)
    const message =
      ids.length === 1
        ? `${names[0]} can't be reached from any entry point (client, cron job or webhook).`
        : `${ids.length} components can't be reached from any entry point: ${listNames(names)}.`
    return result('unreachable-node', ids.join('|'), 'warning', message, ids)
  })
}

// ---------------------------------------------------------------------------
// Rule 3 — invalid component connections
// ---------------------------------------------------------------------------

function checkInvalidConnections(g: Graph): ValidationResult[] {
  const out: ValidationResult[] = []
  for (const e of g.edges) {
    const source = g.byId.get(e.source)
    const target = g.byId.get(e.target)
    if (!source?.type || !target?.type) continue
    const s = source.type
    const t = target.type
    const rule = CONNECTION_RULES.find((r) => r.matches(s, t))
    if (rule) out.push(result('invalid-connection', e.id, rule.severity, rule.message(source.name, target.name), [e.source, e.target], [e.id]))
  }
  return out
}

// ---------------------------------------------------------------------------
// Rule 4 — missing connections
// ---------------------------------------------------------------------------

function checkMissingConnections(g: Graph): ValidationResult[] {
  const out: ValidationResult[] = []
  for (const n of g.nodes) {
    // Fully disconnected nodes are already reported once by the orphan rule.
    if (n.type === null || isOrphan(g, n.id) || outDegree(g, n.id) > 0) continue
    const type = n.type
    const rule = DOWNSTREAM_REQUIREMENTS.find((r) => r.types.has(type))
    if (rule) out.push(result('missing-connection', n.id, 'warning', rule.message(n.name), [n.id]))
  }
  return out
}

// ---------------------------------------------------------------------------
// Rule 5 — cycles
// ---------------------------------------------------------------------------

/** Iterative Tarjan SCC, so very deep graphs can't overflow the call stack. */
function stronglyConnectedComponents(g: Graph): string[][] {
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const components: string[][] = []
  let counter = 0

  const visit = (id: string, work: { id: string; next: number }[]) => {
    index.set(id, counter)
    low.set(id, counter)
    counter++
    stack.push(id)
    onStack.add(id)
    work.push({ id, next: 0 })
  }

  for (const root of g.nodes) {
    if (index.has(root.id)) continue
    const work: { id: string; next: number }[] = []
    visit(root.id, work)
    while (work.length > 0) {
      const frame = work[work.length - 1]
      const out = g.outgoing.get(frame.id) ?? []
      if (frame.next < out.length) {
        const next = out[frame.next++].target
        if (!index.has(next)) visit(next, work)
        else if (onStack.has(next)) low.set(frame.id, Math.min(low.get(frame.id) as number, index.get(next) as number))
        continue
      }
      work.pop()
      if (work.length > 0) {
        const parent = work[work.length - 1].id
        low.set(parent, Math.min(low.get(parent) as number, low.get(frame.id) as number))
      }
      if (low.get(frame.id) === index.get(frame.id)) {
        const component: string[] = []
        let member: string
        do {
          member = stack.pop() as string
          onStack.delete(member)
          component.push(member)
        } while (member !== frame.id)
        components.push(component)
      }
    }
  }
  return components
}

function formatCycleNames(names: string[]): string {
  return names.length === 2 ? `${names[0]} and ${names[1]}` : listNames(names)
}

function checkCycles(g: Graph): ValidationResult[] {
  return stronglyConnectedComponents(g)
    .filter((c) => c.length > 1)
    .map((c) => c.sort((a, b) => (g.order.get(a) ?? 0) - (g.order.get(b) ?? 0)))
    .sort((a, b) => (g.order.get(a[0]) ?? 0) - (g.order.get(b[0]) ?? 0))
    .map((ids) => {
      const members = new Set(ids)
      const edgeIds = g.edges.filter((e) => members.has(e.source) && members.has(e.target)).map((e) => e.id)
      const names = ids.map((id) => g.byId.get(id)?.name ?? id)
      return result(
        'cycle',
        ids.join('|'),
        'warning',
        `Cycle detected between ${formatCycleNames(names)}. The simulation assumes traffic flows one way, so this loop may not be simulated accurately.`,
        ids,
        edgeIds,
      )
    })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates an architecture graph. Never throws: malformed input is reported
 * as results (or ignored), and an unexpected failure becomes an 'internal-error' result.
 * Results are ordered errors → warnings → infos.
 */
export function validateArchitecture(nodes: readonly ArchitectureNode[], edges: readonly ArchitectureEdge[]): ValidationResult[] {
  try {
    const { graph, issues } = buildGraph(nodes, edges)
    const results = [
      ...issues,
      ...checkOrphanNodes(graph),
      ...checkUnreachableNodes(graph),
      ...checkInvalidConnections(graph),
      ...checkMissingConnections(graph),
      ...checkCycles(graph),
    ]
    return results.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    return [result('internal-error', 'validation', 'warning', `Validation could not be completed: ${reason}`)]
  }
}

export function summarizeValidation(results: readonly ValidationResult[]): ValidationSummary {
  const count = (severity: ValidationSeverity) => results.filter((r) => r.severity === severity).length
  return { errors: count('error'), warnings: count('warning'), infos: count('info'), total: results.length }
}