import { describe, expect, it } from 'vitest'
import { analyzeSPOFs, type SPOFAnalyzerNode, type SPOFAnalyzerEdge } from './spofAnalyzer'

const node = (id: string, type: string, config: Record<string, unknown> = {}): SPOFAnalyzerNode => ({
  id, type, label: id, config,
})
const edge = (id: string, source: string, target: string): SPOFAnalyzerEdge => ({ id, source, target })

describe('analyzeSPOFs', () => {
  it('flags a single-instance service on a request path', () => {
    const nodes = [node('c', 'client'), node('api', 'service'), node('db', 'database', { replicaCount: 1 })]
    const edges = [edge('e1', 'c', 'api'), edge('e2', 'api', 'db')]
    const result = analyzeSPOFs(nodes, edges)
    expect(result.findings.some(f => f.nodeId === 'api')).toBe(true)
  })

  it('does not flag client nodes', () => {
    const nodes = [node('c', 'client'), node('api', 'service')]
    const edges = [edge('e1', 'c', 'api')]
    const result = analyzeSPOFs(nodes, edges)
    expect(result.findings.every(f => f.nodeId !== 'c')).toBe(true)
  })

  it('flags database without replicas as critical when it has downstream impact', () => {
    const nodes = [node('c', 'client'), node('api', 'service'), node('db', 'database', { replicaCount: 0 }), node('cache', 'cache')]
    const edges = [edge('e1', 'c', 'api'), edge('e2', 'api', 'db'), edge('e3', 'db', 'cache')]
    const result = analyzeSPOFs(nodes, edges)
    const dbFinding = result.findings.find(f => f.nodeId === 'db')
    expect(dbFinding).toBeDefined()
    expect(dbFinding!.severity).toBe('Critical')
  })

  it('rates database with replicas as redundant', () => {
    const nodes = [node('c', 'client'), node('db', 'database', { replicaCount: 2 })]
    const edges = [edge('e1', 'c', 'db')]
    const result = analyzeSPOFs(nodes, edges)
    const dbFinding = result.findings.find(f => f.nodeId === 'db')
    expect(dbFinding).toBeUndefined()
  })

  it('detects parallel path as redundancy', () => {
    const nodes = [
      node('c', 'client'),
      node('api1', 'service'),
      node('api2', 'service'),
      node('db', 'database', { replicaCount: 1 }),
    ]
    const edges = [edge('e1', 'c', 'api1'), edge('e2', 'c', 'api2'), edge('e3', 'api1', 'db'), edge('e4', 'api2', 'db')]
    const result = analyzeSPOFs(nodes, edges)
    const apiFinding = result.findings.find(f => f.nodeId === 'api1')
    expect(apiFinding?.redundant).toBe(true)
  })

  it('includes externally provided SPOF ids', () => {
    const nodes = [node('c', 'client'), node('cache', 'cache')]
    const edges = [edge('e1', 'c', 'cache')]
    const result = analyzeSPOFs(nodes, edges, ['cache'])
    expect(result.findings.some(f => f.nodeId === 'cache')).toBe(true)
  })

  it('returns empty findings for client-only graph', () => {
    const nodes = [node('c', 'client')]
    const result = analyzeSPOFs(nodes, [])
    expect(result.findings).toHaveLength(0)
  })
})
