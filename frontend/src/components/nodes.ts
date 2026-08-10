export type ComponentType =
  | 'client'
  | 'mobile'
  | 'webBrowser'
  | 'dns'
  | 'cdn'
  | 'loadBalancer'
  | 'apiGateway'
  | 'waf'
  | 'ingress'
  | 'service'
  | 'worker'
  | 'serverless'
  | 'cache'
  | 'database'
  | 'queue'
  | 'dataWarehouse'
  | 'autoScalingGroup'

export type ComponentCategory = 'Client' | 'Traffic & Edge' | 'Compute' | 'Data'

export interface ComponentDef {
  type: ComponentType
  label: string
  category: ComponentCategory
  defaultConfig: Record<string, unknown>
}

export const COMPONENT_LIBRARY: ComponentDef[] = [
  // Client
  { type: 'client', label: 'Client', category: 'Client', defaultConfig: { targetRps: 100 } },
  { type: 'mobile', label: 'Mobile', category: 'Client', defaultConfig: { targetRps: 100 } },
  { type: 'webBrowser', label: 'Web Browser', category: 'Client', defaultConfig: { targetRps: 100 } },

  // Traffic & Edge
  { type: 'dns', label: 'DNS', category: 'Traffic & Edge', defaultConfig: { resolutionLatencyMs: 5 } },
  { type: 'cdn', label: 'CDN', category: 'Traffic & Edge', defaultConfig: { hitRatePct: 90, hitLatencyMs: 3, missLatencyMs: 35 } },
  {
    type: 'loadBalancer',
    label: 'Load Balancer',
    category: 'Traffic & Edge',
    defaultConfig: { algorithm: 'round-robin', maxThroughput: 1000 },
  },
  { type: 'apiGateway', label: 'API Gateway', category: 'Traffic & Edge', defaultConfig: { rateLimit: 500 } },
  { type: 'waf', label: 'WAF', category: 'Traffic & Edge', defaultConfig: { maxThroughput: 2000, extraLatencyMs: 2 } },
  { type: 'ingress', label: 'Ingress', category: 'Traffic & Edge', defaultConfig: { maxThroughput: 1500 } },

  // Compute
  {
    type: 'service',
    label: 'Service',
    category: 'Compute',
    defaultConfig: { minLatencyMs: 20, maxLatencyMs: 80, maxConcurrency: 500, failureRateAtSaturation: 5 },
  },
  {
    type: 'worker',
    label: 'Worker',
    category: 'Compute',
    defaultConfig: { minLatencyMs: 30, maxLatencyMs: 150, maxConcurrency: 300, failureRateAtSaturation: 5 },
  },
  {
    type: 'serverless',
    label: 'Serverless',
    category: 'Compute',
    defaultConfig: { minLatencyMs: 40, maxLatencyMs: 300, maxConcurrency: 1000, failureRateAtSaturation: 3 },
  },
  { type: 'queue', label: 'Message Queue', category: 'Compute', defaultConfig: { maxThroughput: 1000, consumers: 1 } },
  {
    type: 'autoScalingGroup',
    label: 'Auto-Scaling Group',
    category: 'Compute',
    defaultConfig: { minReplicas: 1, maxReplicas: 10, targetLoadPct: 70, baseCapacityPerReplica: 500, minLatencyMs: 20, maxLatencyMs: 80 },
  },

  // Data
  {
    type: 'cache',
    label: 'Cache',
    category: 'Data',
    defaultConfig: { hitRatePct: 80, hitLatencyMs: 2, missLatencyMs: 40 },
  },
  {
    type: 'database',
    label: 'Database',
    category: 'Data',
    defaultConfig: { readLatencyMs: 15, writeLatencyMs: 30, maxConnections: 200, replicaCount: 0 },
  },
  {
    type: 'dataWarehouse',
    label: 'Data Warehouse',
    category: 'Data',
    defaultConfig: { readLatencyMs: 60, writeLatencyMs: 100, maxConnections: 100, replicaCount: 0 },
  },
]

export const COMPONENT_CATEGORIES: ComponentCategory[] = ['Client', 'Traffic & Edge', 'Compute', 'Data']

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
