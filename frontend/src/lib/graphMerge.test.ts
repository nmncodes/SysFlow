import { describe, expect, it } from 'vitest'
import { mergeGraphs, stableStringify, type GraphPayload } from './graphMerge'

const node = (id: string, label = 'API', config: Record<string, unknown> = {}) => ({
  id,
  type: 'service',
  label,
  config,
  position: { x: 0, y: 0 },
})

const edge = (id: string, source: string, target: string) => ({ id, source, target })
const graph = (nodes: GraphPayload['nodes'] = [], edges: GraphPayload['edges'] = []): GraphPayload => ({ nodes, edges })

describe('mergeGraphs', () => {
  it('merges edits to different nodes and different fields of the same node', () => {
    const base = graph([node('api', 'API', { replicas: 1, region: 'east' }), node('worker')])
    const local = graph([node('api', 'Public API', { replicas: 1, region: 'east' }), node('worker')])
    const remote = graph([node('api', 'API', { replicas: 2, region: 'east' }), node('worker', 'Jobs')])

    const result = mergeGraphs(base, local, remote)

    expect(result.conflicts).toEqual([])
    expect(result.graph.nodes).toEqual([
      node('api', 'Public API', { replicas: 2, region: 'east' }),
      node('worker', 'Jobs'),
    ])
  })

  it('reports same-field edits and preserves the local draft for resolution', () => {
    const base = graph([node('api', 'API', { replicas: 1 })])
    const local = graph([node('api', 'API', { replicas: 2 })])
    const remote = graph([node('api', 'API', { replicas: 3 })])

    const result = mergeGraphs(base, local, remote)

    expect(result.conflicts).toEqual(['node:api.config.replicas'])
    expect(result.graph.nodes[0].config.replicas).toBe(2)
  })

  it('reports delete-versus-edit conflicts instead of silently restoring or discarding a node', () => {
    const base = graph([node('api')])
    const local = graph()
    const remote = graph([node('api', 'Renamed API')])

    const result = mergeGraphs(base, local, remote)

    expect(result.conflicts).toEqual(['node:api'])
    expect(result.graph.nodes).toEqual([])
  })

  it('removes an entity deleted by one side when the other side left it unchanged', () => {
    const base = graph([node('api')], [edge('e1', 'api', 'worker')])

    expect(mergeGraphs(base, graph(), base)).toEqual({ graph: graph(), conflicts: [] })
  })

  it('merges independent edge additions and flags incompatible changes to the same edge', () => {
    const base = graph([], [edge('e1', 'api', 'worker')])
    const local = graph([], [edge('e1', 'api', 'cache'), edge('e2', 'api', 'worker')])
    const remote = graph([], [edge('e1', 'api', 'queue'), edge('e3', 'worker', 'cache')])

    const result = mergeGraphs(base, local, remote)

    expect(result.conflicts).toEqual(['edge:e1.target'])
    expect(result.graph.edges).toEqual([
      edge('e1', 'api', 'cache'),
      edge('e2', 'api', 'worker'),
      edge('e3', 'worker', 'cache'),
    ])
  })
})

describe('stableStringify', () => {
  it('ignores object insertion order while preserving array order', () => {
    expect(stableStringify({ first: 1, nested: { a: 2, b: 3 } })).toBe(
      stableStringify({ nested: { b: 3, a: 2 }, first: 1 }),
    )
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]))
  })
})
