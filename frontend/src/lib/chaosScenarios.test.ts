import { describe, expect, it } from 'vitest'
import {
  buildChaosScenario,
  getScenarioTargets,
  analyzeChaosExperiment,
  CHAOS_SCENARIOS,
  type ChaosScenarioConfig,
} from './chaosScenarios'
import type { SimulationResult, Tick } from './api'

function makeTick(t: number, nodeStats: Record<string, { avgLatencyMs: number; loadPct: number; errorRatePct: number; down?: boolean }>): Tick {
  const nodes: Record<string, any> = {}
  for (const [id, s] of Object.entries(nodeStats)) {
    nodes[id] = { avgLatencyMs: s.avgLatencyMs, loadPct: s.loadPct, errorRatePct: s.errorRatePct, down: s.down ?? false }
  }
  return { t, nodes, edges: {}, global: { rps: 100, errorRatePct: 1, p50: 50, p95: 100, p99: 200 } }
}

function makeSim(ticks: Tick[], overrides: Partial<SimulationResult['summary']> = {}): SimulationResult {
  return {
    ticks,
    summary: { avgRps: 100, avgErrorRatePct: 1, p50: 50, p95: 100, p99: 200, bottleneckNodeId: null, bottleneckLoadPct: 0, singlePointsOfFailure: [], ...overrides },
  }
}

describe('buildChaosScenario', () => {
  it('builds trafficSpike with no failures and a multiplier', () => {
    const plan = buildChaosScenario({ id: 'trafficSpike', trafficMultiplier: 3 })
    expect(plan.failures).toHaveLength(0)
    expect(plan.trafficMultiplier).toBe(3)
    expect(plan.steps.length).toBeGreaterThan(0)
  })

  it('builds databaseFailure with a kill failure at tick 10', () => {
    const plan = buildChaosScenario({ id: 'databaseFailure', targetNodeId: 'db1' })
    expect(plan.failures).toHaveLength(1)
    expect(plan.failures[0].type).toBe('kill')
    expect(plan.failures[0].nodeId).toBe('db1')
    expect(plan.failures[0].fromTick).toBe(10)
  })

  it('builds cascadingFailure with throttle + latency staged failures', () => {
    const plan = buildChaosScenario({ id: 'cascadingFailure', targetNodeId: 'svc' })
    expect(plan.failures).toHaveLength(2)
    expect(plan.failures[0].type).toBe('throttle')
    expect(plan.failures[1].type).toBe('latency')
    expect(plan.failures[1].fromTick).toBeGreaterThan(plan.failures[0].fromTick)
  })

  it('builds recoveryTest with a bounded kill (toTick set)', () => {
    const plan = buildChaosScenario({ id: 'recoveryTest', targetNodeId: 'api' })
    expect(plan.failures).toHaveLength(1)
    expect(plan.failures[0].toTick).toBe(40)
  })

  it('returns empty failures when no target is provided for node-targeted scenario', () => {
    const plan = buildChaosScenario({ id: 'dependencyFailure' })
    expect(plan.failures).toHaveLength(0)
  })
})

describe('getScenarioTargets', () => {
  it('returns no targets for trafficSpike', () => {
    const targets = getScenarioTargets('trafficSpike', [{ id: 'a', type: 'service' }], [])
    expect(targets).toHaveLength(0)
  })

  it('filters to allowed types for databaseFailure', () => {
    const nodes = [{ id: 'svc', type: 'service' }, { id: 'db', type: 'database' }]
    const targets = getScenarioTargets('databaseFailure', nodes, [])
    expect(targets).toHaveLength(1)
    expect(targets[0].id).toBe('db')
  })
})

describe('analyzeChaosExperiment', () => {
  it('detects blast radius from baseline vs chaos comparison', () => {
    const baseline = makeSim([
      makeTick(0, { api: { avgLatencyMs: 50, loadPct: 40, errorRatePct: 0 }, db: { avgLatencyMs: 20, loadPct: 30, errorRatePct: 0 } }),
    ])
    const after = makeSim([
      makeTick(0, { api: { avgLatencyMs: 200, loadPct: 90, errorRatePct: 10 }, db: { avgLatencyMs: 20, loadPct: 30, errorRatePct: 0 } }),
    ], { avgErrorRatePct: 5 })
    const nodes = [{ id: 'api', label: 'API' }, { id: 'db', label: 'DB' }]
    const result = analyzeChaosExperiment(baseline, after, nodes, [], 'db')
    expect(result.blastRadiusCount).toBeGreaterThanOrEqual(1)
    expect(result.changedNodes.some(n => n.nodeId === 'api')).toBe(true)
  })

  it('works without a baseline', () => {
    const after = makeSim([
      makeTick(0, { api: { avgLatencyMs: 100, loadPct: 60, errorRatePct: 2 } }),
    ])
    const result = analyzeChaosExperiment(null, after, [{ id: 'api', label: 'API' }], [])
    expect(result.before).toBeNull()
    expect(result.after.p95Ms).toBe(100)
    expect(result.recommendations.length).toBeGreaterThan(0)
  })

  it('detects cascading failures on downstream nodes', () => {
    const baseline = makeSim([
      makeTick(0, { svc: { avgLatencyMs: 30, loadPct: 30, errorRatePct: 0 }, downstream: { avgLatencyMs: 20, loadPct: 20, errorRatePct: 0 } }),
    ])
    const after = makeSim([
      makeTick(0, { svc: { avgLatencyMs: 30, loadPct: 30, errorRatePct: 0 }, downstream: { avgLatencyMs: 150, loadPct: 80, errorRatePct: 5 } }),
    ])
    const nodes = [{ id: 'svc', label: 'Service' }, { id: 'downstream', label: 'Downstream' }]
    const edges = [{ source: 'svc', target: 'downstream' }]
    const result = analyzeChaosExperiment(baseline, after, nodes, edges, 'svc')
    expect(result.cascadingFailureCount).toBeGreaterThanOrEqual(1)
    expect(result.cascadingFailureNodes).toContain('Downstream')
  })
})
