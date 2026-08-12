import type { ComponentType } from '../components/nodes'

/** Rough, illustrative monthly USD cost per instance — not a real cloud pricing model, just enough to make tradeoffs visible. */
export const MONTHLY_COST_USD: Record<ComponentType, number> = {
  client: 0,
  mobile: 0,
  webBrowser: 0,
  dns: 1,
  cdn: 20,
  loadBalancer: 18,
  apiGateway: 15,
  waf: 12,
  ingress: 10,
  service: 25,
  worker: 20,
  serverless: 5,
  cache: 15,
  database: 60,
  dataWarehouse: 220,
  queue: 10,
  autoScalingGroup: 25, // × replicas, computed dynamically
}

export function estimateNodeMonthlyCost(type: ComponentType, replicas = 1): number {
  const base = MONTHLY_COST_USD[type] ?? 10
  return base * Math.max(1, replicas)
}

export function estimateTotalMonthlyCost(nodes: { type: ComponentType; replicas?: number }[]): number {
  return nodes.reduce((sum, n) => sum + estimateNodeMonthlyCost(n.type, n.replicas ?? 1), 0)
}
