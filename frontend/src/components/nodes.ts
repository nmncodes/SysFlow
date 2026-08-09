export type ComponentType =
  | 'client'
  | 'loadBalancer'
  | 'apiGateway'
  | 'service'
  | 'cache'
  | 'database'
  | 'queue'

export interface ComponentDef {
  type: ComponentType
  label: string
  icon: string
  defaultConfig: Record<string, unknown>
}

export const COMPONENT_LIBRARY: ComponentDef[] = [
  { type: 'client', label: 'Client', icon: '🧑', defaultConfig: { targetRps: 100 } },
  {
    type: 'loadBalancer',
    label: 'Load Balancer',
    icon: '🔀',
    defaultConfig: { algorithm: 'round-robin', maxThroughput: 1000 },
  },
  { type: 'apiGateway', label: 'API Gateway', icon: '🛡️', defaultConfig: { rateLimit: 500 } },
  {
    type: 'service',
    label: 'Service',
    icon: '⬡',
    defaultConfig: { minLatencyMs: 20, maxLatencyMs: 80, maxConcurrency: 500, failureRateAtSaturation: 5 },
  },
  {
    type: 'cache',
    label: 'Cache',
    icon: '⚡',
    defaultConfig: { hitRatePct: 80, hitLatencyMs: 2, missLatencyMs: 40 },
  },
  {
    type: 'database',
    label: 'Database',
    icon: '🛢️',
    defaultConfig: { readLatencyMs: 15, writeLatencyMs: 30, maxConnections: 200, replicaCount: 0 },
  },
  { type: 'queue', label: 'Message Queue', icon: '📬', defaultConfig: { maxThroughput: 1000, consumers: 1 } },
]

export type HealthState = 'idle' | 'healthy' | 'underLoad' | 'critical' | 'down'

export const HEALTH_COLORS: Record<HealthState, string> = {
  idle: '#6b7280',
  healthy: '#22c55e',
  underLoad: '#f59e0b',
  critical: '#f97316',
  down: '#ef4444',
}

export function deriveHealth(loadPct: number, errorRatePct: number, down: boolean): HealthState {
  if (down) return 'down'
  if (loadPct > 85 || errorRatePct >= 5) return 'critical'
  if (loadPct >= 60 || errorRatePct >= 1) return 'underLoad'
  return 'healthy'
}
