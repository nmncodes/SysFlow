export interface GraphPayload {
  nodes: { id: string; type: string; label: string; config: Record<string, unknown>; position: { x: number; y: number } }[]
  edges: { id: string; source: string; target: string }[]
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

function mergeValue(base: unknown, local: unknown, remote: unknown, path: string): { value: unknown; conflicts: string[] } {
  if (stableStringify(base) === stableStringify(local)) return { value: remote, conflicts: [] }
  if (stableStringify(base) === stableStringify(remote) || stableStringify(local) === stableStringify(remote)) {
    return { value: local, conflicts: [] }
  }

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
  if (isRecord(local) && isRecord(remote) && (base === undefined || isRecord(base))) {
    const merged: Record<string, unknown> = {}
    const conflicts: string[] = []
    const fields = new Set([...Object.keys(base ?? {}), ...Object.keys(local), ...Object.keys(remote)])
    for (const field of fields) {
      const result = mergeValue(isRecord(base) ? base[field] : undefined, local[field], remote[field], `${path}.${field}`)
      if (result.value !== undefined) merged[field] = result.value
      conflicts.push(...result.conflicts)
    }
    return { value: merged, conflicts }
  }
  return { value: local, conflicts: [path] }
}

function mergeEntities<T extends { id: string }>(base: T[], local: T[], remote: T[], kind: string) {
  const byId = (items: T[]) => new Map(items.map((item) => [item.id, item]))
  const baseById = byId(base)
  const localById = byId(local)
  const remoteById = byId(remote)
  const ids = new Set([...localById.keys(), ...remoteById.keys()])
  const merged: T[] = []
  const conflicts: string[] = []

  for (const id of ids) {
    const result = mergeValue(baseById.get(id), localById.get(id), remoteById.get(id), `${kind}:${id}`)
    if (result.value) merged.push(result.value as T)
    conflicts.push(...result.conflicts)
  }
  return { merged, conflicts }
}

export function mergeGraphs(base: GraphPayload, local: GraphPayload, remote: GraphPayload) {
  const nodes = mergeEntities(base.nodes, local.nodes, remote.nodes, 'node')
  const edges = mergeEntities(base.edges, local.edges, remote.edges, 'edge')
  return {
    graph: { nodes: nodes.merged, edges: edges.merged },
    conflicts: [...nodes.conflicts, ...edges.conflicts],
  }
}

export { stableStringify }
