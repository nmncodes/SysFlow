import { describe, expect, it } from 'vitest'
import { validateArchitecture, summarizeValidation, type ArchitectureNode, type ArchitectureEdge } from './graphValidation'

const node = (id: string, type: string, label?: string): ArchitectureNode => ({ id, type, label })
const edge = (id: string, source: string, target: string): ArchitectureEdge => ({ id, source, target })

describe('validateArchitecture', () => {
  it('returns empty for a valid simple graph', () => {
    const nodes = [node('c', 'client', 'Client'), node('lb', 'loadBalancer', 'LB'), node('svc', 'service', 'API')]
    const edges = [edge('e1', 'c', 'lb'), edge('e2', 'lb', 'svc')]
    const results = validateArchitecture(nodes, edges)
    expect(results.filter(r => r.severity === 'error')).toHaveLength(0)
  })

  it('detects orphan nodes', () => {
    const nodes = [node('c', 'client'), node('orphan', 'service', 'Lonely')]
    const edges: ArchitectureEdge[] = []
    const results = validateArchitecture(nodes, edges)
    expect(results.some(r => r.category === 'orphan-node' && r.affectedNodeIds.includes('orphan'))).toBe(true)
  })

  it('detects self-loops', () => {
    const nodes = [node('a', 'service')]
    const edges = [edge('e1', 'a', 'a')]
    const results = validateArchitecture(nodes, edges)
    expect(results.some(r => r.category === 'self-loop')).toBe(true)
  })

  it('detects duplicate edges', () => {
    const nodes = [node('a', 'client'), node('b', 'service')]
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'a', 'b')]
    const results = validateArchitecture(nodes, edges)
    expect(results.some(r => r.category === 'duplicate-edge')).toBe(true)
  })

  it('detects cycles', () => {
    const nodes = [node('c', 'client'), node('a', 'service', 'A'), node('b', 'service', 'B')]
    const edges = [edge('e1', 'c', 'a'), edge('e2', 'a', 'b'), edge('e3', 'b', 'a')]
    const results = validateArchitecture(nodes, edges)
    expect(results.some(r => r.category === 'cycle')).toBe(true)
  })

  it('warns about unreachable nodes when entry points exist', () => {
    const nodes = [node('c', 'client'), node('svc', 'service'), node('island', 'database', 'Island')]
    const edges = [edge('e1', 'c', 'svc'), edge('e2', 'island', 'svc')]
    const results = validateArchitecture(nodes, edges)
    const unreachable = results.filter(r => r.category === 'unreachable-node')
    expect(unreachable.some(r => r.affectedNodeIds.includes('island'))).toBe(true)
  })

  it('warns when no entry point exists', () => {
    const nodes = [node('a', 'service'), node('b', 'database')]
    const edges = [edge('e1', 'a', 'b')]
    const results = validateArchitecture(nodes, edges)
    expect(results.some(r => r.category === 'no-entry-point')).toBe(true)
  })

  it('reports unknown component types', () => {
    const nodes = [node('c', 'client'), node('x', 'madeUpType', 'Mystery')]
    const edges = [edge('e1', 'c', 'x')]
    const results = validateArchitecture(nodes, edges)
    expect(results.some(r => r.category === 'unknown-component')).toBe(true)
  })

  it('handles empty input gracefully', () => {
    const results = validateArchitecture([], [])
    expect(results).toEqual([])
  })
})

describe('summarizeValidation', () => {
  it('counts by severity', () => {
    const nodes = [node('c', 'client'), node('a', 'service'), node('b', 'service')]
    const edges = [edge('e1', 'c', 'a'), edge('e2', 'a', 'b'), edge('e3', 'b', 'a')]
    const results = validateArchitecture(nodes, edges)
    const summary = summarizeValidation(results)
    expect(summary.total).toBe(results.length)
    expect(summary.errors + summary.warnings + summary.infos).toBe(summary.total)
  })
})
