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

export interface Finding {
  severity: 'critical' | 'warning' | 'info'
  title: string
  affectedNodeIds: string[]
  explanation: string
  recommendation: string
}

export interface AnalyzeResult {
  findings: Finding[]
  aiEnabled: boolean
}

export interface SrsImportResult {
  graphJson: {
    nodes: { id: string; type: string; label: string; config: Record<string, unknown>; position: { x: number; y: number } }[]
    edges: { id: string; source: string; target: string }[]
  }
  findings: Finding[]
  aiEnabled: boolean
  unrecognizedTerms: string[]
}

export async function importSrs(file: File): Promise<SrsImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/srs/import`, { method: 'POST', body: formData })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `SRS import failed: ${res.status}`)
  }
  return res.json()
}

export interface PricingNodeCost {
  id: string
  type: string
  monthlyCostUsd: number
  source: 'real' | 'illustrative'
  note: string
}

export interface PricingEstimate {
  totalMonthlyCostUsd: number
  provider: string
  region: string
  nodes: PricingNodeCost[]
}

export async function estimateRealCost(
  nodes: { id: string; type: string; config: Record<string, unknown> }[],
): Promise<PricingEstimate> {
  const res = await fetch(`${API_BASE}/pricing/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ graphJson: { nodes } }),
  })
  if (!res.ok) throw new Error(`Pricing estimate failed: ${res.status}`)
  return res.json()
}

export async function analyzeGraph(
  nodes: { id: string; type: string; config: Record<string, unknown> }[],
  edges: { id: string; source: string; target: string }[],
  lastSimulationSummary?: SimulationSummary | null,
): Promise<AnalyzeResult> {
  const res = await fetch(`${API_BASE}/ai/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      graphJson: { nodes, edges },
      lastSimulationSummary: lastSimulationSummary ?? null,
    }),
  })
  if (!res.ok) {
    throw new Error(`Analyze request failed: ${res.status}`)
  }
  return res.json()
}

export interface InterviewPrompt {
  id: string
  title: string
  difficulty: string
  brief: string
  keyConsiderations: string[]
}

export interface InterviewGrade {
  overallScore: number
  categories: { name: string; score: number; maxScore: number; feedback: string }[]
  summary: string
  improvements: string[]
  aiEnabled: boolean
}

export async function listInterviewPrompts(): Promise<InterviewPrompt[]> {
  const res = await fetch(`${API_BASE}/interview/prompts`)
  if (!res.ok) throw new Error(`Failed to load prompts: ${res.status}`)
  return res.json()
}

export async function gradeInterview(
  promptId: string,
  nodes: { id: string; type: string; config: Record<string, unknown> }[],
  edges: { id: string; source: string; target: string }[],
): Promise<InterviewGrade> {
  const res = await fetch(`${API_BASE}/interview/grade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promptId, graphJson: { nodes, edges } }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? `Grading failed: ${res.status}`)
  }
  return res.json()
}
