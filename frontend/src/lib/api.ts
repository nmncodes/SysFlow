const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081/api'

/**
 * fetch() has no built-in timeout - without this, a slow backend (e.g. an AI call with no
 * server-side timeout of its own) leaves buttons stuck on "Analyzing…" indefinitely instead
 * of failing into the UI's existing error/fallback handling.
 */
function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer)).then((res) => {
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After')
      throw new Error(`Too many requests — please wait ${retryAfter ? `${retryAfter}s` : 'a moment'} and try again`)
    }
    return res
  })
}

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
  p50: number
  p95: number
  p99: number
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
  const res = await fetchWithTimeout(`${API_BASE}/simulations/run`, {
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
  }, 60_000).catch((e) => {
    throw new Error(e?.name === 'AbortError' ? 'Simulation timed out - try reducing the duration or graph size' : `Simulation failed: ${e?.message ?? 'network error'}`)
  })
  if (!res.ok) {
    throw new Error(`Simulation request failed: ${res.status}`)
  }
  return res.json()
}

export interface SloRequirement {
  maxP95LatencyMs: number | null
  maxErrorRatePercent: number | null
  minThroughputRps: number | null
}

export interface SloCheck {
  name: string
  actualValue: number
  thresholdValue: number
  status: 'PASS' | 'FAIL'
}

export interface SloEvaluationResult {
  overallStatus: 'PASS' | 'FAIL'
  checks: SloCheck[]
}

/**
 * Evaluates SLO thresholds against an already-computed SimulationResult (e.g. the
 * response of `runSimulation`). Does NOT run a simulation itself - the backend
 * SloEvaluator only reads the existing SimulationSummary fields. The backend's
 * response is the sole source of truth for PASS/FAIL; nothing here evaluates it.
 */
export async function evaluateSlo(
  simulationResult: SimulationResult,
  sloRequirement: SloRequirement,
): Promise<SloEvaluationResult> {
  const res = await fetchWithTimeout(`${API_BASE}/simulations/evaluate-slo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ simulationResult, sloRequirement }),
  }, 15_000)
  if (!res.ok) {
    throw new Error(`SLO evaluation failed: ${res.status}`)
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
  const res = await fetchWithTimeout(`${API_BASE}/srs/import`, { method: 'POST', body: formData }, 45_000).catch((e) => {
    throw new Error(e?.name === 'AbortError' ? 'SRS import timed out - the document may be too long or the AI service is slow right now' : `SRS import failed: ${e?.message ?? 'network error'}`)
  })
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

export interface ProviderCostSummary {
  providerId: 'aws' | 'gcp' | 'azure' | string
  providerName: string
  region: string
  totalMonthlyCostUsd: number
  provisionedCostUsd: number
  dynamicCostUsd: number
  egressCostUsd: number
  cacheSavingsUsd: number
  nodes: PricingNodeCost[]
}

export interface DynamicUsageMetrics {
  simulatedRps: number
  monthlyRequestsMillions: number
  monthlyEgressGb: number
  cacheHitRatePct: number
}

export interface PricingCompareResponse {
  providers: Record<string, ProviderCostSummary>
  bestValueProvider: string
  maxMonthlySavingsUsd: number
  dynamicMetrics: DynamicUsageMetrics
  recommendations: string[]
}

export interface TierPrice {
  hourlyUsd: number
  monthlyUsd: number
  skuName: string
  description: string
}

export interface CategoryPricing {
  tiers: Record<string, TierPrice>
}

export interface ProviderScalePricing {
  providerId: string
  providerName: string
  region: string
  categories: Record<string, CategoryPricing>
}

export interface ScalePricingResponse {
  providers: Record<string, ProviderScalePricing>
}

export async function getScaleTiers(): Promise<ScalePricingResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/pricing/scale-tiers`, {}, 15_000)
  if (!res.ok) throw new Error(`Scale tiers fetch failed: ${res.status}`)
  return res.json()
}

export async function estimateRealCost(
  nodes: { id: string; type: string; config: Record<string, unknown> }[],
): Promise<PricingEstimate> {
  const res = await fetchWithTimeout(`${API_BASE}/pricing/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ graphJson: { nodes } }),
  }, 15_000)
  if (!res.ok) throw new Error(`Pricing estimate failed: ${res.status}`)
  return res.json()
}

export async function compareMultiCloudCosts(
  nodes: { id: string; type: string; config: Record<string, unknown> }[],
  edges: { id: string; source: string; target: string }[],
  targetRps?: number,
  simulationSummary?: SimulationSummary | null,
): Promise<PricingCompareResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/pricing/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      graphJson: { nodes, edges },
      targetRps,
      simulationSummary,
    }),
  }, 30_000)
  if (!res.ok) throw new Error(`Multi-cloud pricing comparison failed: ${res.status}`)
  return res.json()
}

export async function generateArchitecture(description: string): Promise<SrsImportResult> {
  const res = await fetchWithTimeout(`${API_BASE}/ai/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  }, 30_000).catch((e) => {
    throw new Error(e?.name === 'AbortError' ? 'Generation timed out - try a simpler description' : `Generation failed: ${e?.message ?? 'network error'}`)
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `Generation failed: ${res.status}`)
  }
  return res.json()
}

export async function analyzeGraph(
  nodes: { id: string; type: string; config: Record<string, unknown> }[],
  edges: { id: string; source: string; target: string }[],
  lastSimulationSummary?: SimulationSummary | null,
): Promise<AnalyzeResult> {
  const res = await fetchWithTimeout(`${API_BASE}/ai/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      graphJson: { nodes, edges },
      lastSimulationSummary: lastSimulationSummary ?? null,
    }),
  }, 25_000).catch((e) => {
    throw new Error(e?.name === 'AbortError' ? 'Analysis timed out - the AI service may be slow right now' : `Analysis failed: ${e?.message ?? 'network error'}`)
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
  hldComponents: string[]
  lldDetails: string[]
}

export interface InterviewGrade {
  overallScore: number
  categories: { name: string; score: number; maxScore: number; feedback: string }[]
  summary: string
  improvements: string[]
  aiEnabled: boolean
}

export async function listInterviewPrompts(): Promise<InterviewPrompt[]> {
  const res = await fetchWithTimeout(`${API_BASE}/interview/prompts`, {}, 15_000)
  if (!res.ok) throw new Error(`Failed to load prompts: ${res.status}`)
  return res.json()
}

export async function gradeInterview(
  promptId: string,
  nodes: { id: string; type: string; config: Record<string, unknown> }[],
  edges: { id: string; source: string; target: string }[],
): Promise<InterviewGrade> {
  const res = await fetchWithTimeout(`${API_BASE}/interview/grade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promptId, graphJson: { nodes, edges } }),
  }, 25_000).catch((e) => {
    throw new Error(e?.name === 'AbortError' ? 'Grading timed out - the AI service may be slow right now' : `Grading failed: ${e?.message ?? 'network error'}`)
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? `Grading failed: ${res.status}`)
  }
  return res.json()
}
