const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'

export interface NodeTickStats {
  loadPct: number
  errorRatePct: number
  avgLatencyMs: number
  down: boolean
  replicas?: number
}

export interface EdgeTickStats {
  inFlight: number
  avgLatencyMs: number
}

export interface GlobalTickStats {
  rps: number
  errorRatePct: number
  p50: number
  p95: number
  p99: number
}

export interface Tick {
  t: number
  nodes: Record<string, NodeTickStats>
  edges: Record<string, EdgeTickStats>
  global: GlobalTickStats
}

export interface SimulationSummary {
  avgRps: number
  avgErrorRatePct: number
  avgP95: number
  bottleneckNodeId: string | null
  bottleneckLoadPct: number
  singlePointsOfFailure: string[]
}

export interface SimulationResult {
  ticks: Tick[]
  summary: SimulationSummary
}

export interface InjectedFailure {
  type: 'kill' | 'latency' | 'throttle' | 'dropPct'
  nodeId?: string | null
  edgeId?: string | null
  fromTick: number
  toTick?: number | null
  extraMs?: number
  throttlePct?: number
  dropPct?: number
}

export interface RunSimulationInput {
  nodes: { id: string; type: string; config: Record<string, unknown> }[]
  edges: { id: string; source: string; target: string }[]
  targetRps: number
  durationSeconds: number
  injectedFailures?: InjectedFailure[]
}

export async function runSimulation(input: RunSimulationInput): Promise<SimulationResult> {
  const res = await fetch(`${API_BASE}/simulations/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      graphJson: { nodes: input.nodes, edges: input.edges },
      config: {
        targetRps: input.targetRps,
        durationSeconds: input.durationSeconds,
        injectedFailures: input.injectedFailures ?? [],
      },
    }),
  })
  if (!res.ok) {
    throw new Error(`Simulation request failed: ${res.status}`)
  }
  return res.json()
}
