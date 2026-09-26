import { useMemo, useState } from 'react'
import type { AnalyzeResult, SimulationResult, SimulationSummary } from '../lib/api'
import { analyzeSPOFs, type SPOFAnalyzerEdge, type SPOFAnalyzerNode, type SPOFFinding } from '../lib/spofAnalyzer'
import { analyzeLatency, type LatencyAnalyzerEdge, type LatencyAnalyzerNode, type LatencyFinding } from '../lib/latencyAnalyzer'

interface Props {
  findings: AnalyzeResult['findings']
  aiEnabled: boolean
  summary?: SimulationSummary | null
  simulation?: SimulationResult | null
  nodes: SPOFAnalyzerNode[]
  edges: SPOFAnalyzerEdge[]
  onFocusNode: (nodeId: string) => void
  onSimulateFailure: (nodeId: string) => void
  onClose: () => void
}

const SEVERITY_STYLE = {
  critical: { dot: 'bg-red-500', ring: 'border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950/30', label: 'text-red-600 dark:text-red-400' },
  warning: { dot: 'bg-amber-500', ring: 'border-amber-100 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30', label: 'text-amber-600 dark:text-amber-400' },
  info: { dot: 'bg-emerald-500', ring: 'border-emerald-100 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30', label: 'text-emerald-600 dark:text-emerald-400' },
} as const

const SPOF_SEVERITY_STYLE = {
  Critical: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400',
  High: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-400',
  Medium: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400',
  Low: 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
} as const

export default function FindingsPanel({ findings, aiEnabled, summary, simulation, nodes, edges, onFocusNode, onSimulateFailure, onClose }: Props) {
  const [expandedSpof, setExpandedSpof] = useState<string | null>(null)
  const [expandedLatency, setExpandedLatency] = useState<string | null>(null)
  const bottlenecks = findings.filter((f) => f.severity === 'critical' || f.severity === 'warning').length
  const spofAnalysis = useMemo(
    () => analyzeSPOFs(nodes, edges, summary?.singlePointsOfFailure ?? []),
    [nodes, edges, summary?.singlePointsOfFailure],
  )
  const spofs = spofAnalysis.findings.length
  const latencyAnalysis = useMemo(
    () => analyzeLatency(nodes as LatencyAnalyzerNode[], edges as LatencyAnalyzerEdge[], simulation),
    [nodes, edges, simulation],
  )
  const latencyFindings = latencyAnalysis.findings
  const overallHealth = summary ? Math.max(0, Math.min(100, Math.round(100 - summary.avgErrorRatePct * 4 - Math.max(0, summary.bottleneckLoadPct - 70) * 0.5))) : findings.length === 0 ? 100 : Math.max(55, 100 - findings.length * 8)

  return (
    <>
      <div className="fixed inset-0 z-30 bg-zinc-900/20 dark:bg-black/50 md:hidden" onClick={onClose} />
      <aside className="analysis-sidebar panel-slide-in fixed inset-x-0 bottom-0 z-40 flex h-[82vh] flex-col rounded-t-2xl border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl md:static md:z-auto md:h-full md:w-[380px] md:shrink-0 md:rounded-none md:border-t-0 md:border-l md:shadow-none">
        <div className="border-b border-zinc-100 dark:border-zinc-800 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">System analysis</p>
              <h2 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">Architecture review</h2>
              <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">{aiEnabled ? 'Rule-checked + AI-reviewed' : 'Rule-based analysis'}</p>
            </div>
            <button onClick={onClose} className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200">✕</button>
          </div>
        </div>

        <div className="overflow-y-auto p-4">
          <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Overall health</p>
                <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-50">{overallHealth}%</p>
              </div>
              <div className="h-14 w-14 rounded-full border-[6px] border-emerald-100 dark:border-emerald-900 border-t-emerald-500" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white dark:bg-zinc-900 p-3"><b className="block text-lg text-amber-600 dark:text-amber-400">{bottlenecks}</b><span className="text-[9px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Bottlenecks</span></div>
              <div className="rounded-xl bg-white dark:bg-zinc-900 p-3"><b className="block text-lg text-red-500 dark:text-red-400">{spofs}</b><span className="text-[9px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Single points</span></div>
            </div>
          </div>

          <section className="mt-5">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">SPOF analyzer</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Detection, impact, redundancy and failure-test action.</p>
              </div>
              <span className="text-[9px] text-zinc-400 dark:text-zinc-500">{spofAnalysis.checkedNodeCount} nodes checked</span>
            </div>

            {spofs === 0 ? (
              <div className="mt-2 rounded-xl border border-emerald-100 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-700 dark:text-emerald-400">No single point of failure was detected by the current structural rules.</div>
            ) : (
              <div className="mt-2 space-y-2">
                {spofAnalysis.findings.map((spof) => <SPOFCard key={spof.nodeId} spof={spof} expanded={expandedSpof === spof.nodeId} onToggle={() => setExpandedSpof(expandedSpof === spof.nodeId ? null : spof.nodeId)} onFocusNode={onFocusNode} onSimulateFailure={onSimulateFailure} />)}
              </div>
            )}
          </section>

          <section className="mt-5">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Latency analysis</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Simulation-based latency, utilization, critical-path and propagation analysis.</p>
              </div>
              {latencyAnalysis.hasSimulation && <span className="text-[9px] text-zinc-400 dark:text-zinc-500">{latencyAnalysis.sampleCount} ticks</span>}
            </div>

            {!latencyAnalysis.hasSimulation ? (
              <div className="mt-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-3 text-xs text-zinc-500 dark:text-zinc-400">
                Run the simulation to populate latency and bottleneck analysis. No latency values are inferred before simulation data exists.
              </div>
            ) : (
              <>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <Metric label="P50" value={formatMs(latencyAnalysis.overallP50Ms)} />
                  <Metric label="P95" value={formatMs(latencyAnalysis.overallP95Ms)} />
                  <Metric label="P99" value={formatMs(latencyAnalysis.overallP99Ms)} />
                </div>

                <div className="mt-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Critical latency path</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {latencyAnalysis.criticalPath.length > 0 ? latencyAnalysis.criticalPath.join(' → ') : 'No path could be derived from the current graph.'}
                  </p>
                  {latencyAnalysis.criticalPathLatencyMs !== null && (
                    <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">Derived component-latency sum: {formatMs(latencyAnalysis.criticalPathLatencyMs)}</p>
                  )}
                </div>

                {latencyAnalysis.mainBottleneck && <LatencySummary finding={latencyAnalysis.mainBottleneck} onFocusNode={onFocusNode} />}

                {latencyFindings.length === 0 ? (
                  <div className="mt-2 rounded-xl border border-emerald-100 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-700 dark:text-emerald-400">
                    No latency or utilization bottleneck crossed the analyzer's explicit thresholds.
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {latencyFindings.map((finding) => (
                      <LatencyCard
                        key={finding.nodeId}
                        finding={finding}
                        expanded={expandedLatency === finding.nodeId}
                        onToggle={() => setExpandedLatency(expandedLatency === finding.nodeId ? null : finding.nodeId)}
                        onFocusNode={onFocusNode}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          <section className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Checks</p>
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400"><span>✓</span> Load distribution reviewed</div>
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400"><span>✓</span> Capacity constraints reviewed</div>
              {bottlenecks > 0 && <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"><span>⚠</span> {bottlenecks} potential bottleneck{bottlenecks === 1 ? '' : 's'} found</div>}
              {spofs > 0 && <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs text-red-600 dark:text-red-400"><span>⚠</span> {spofs} single point{spofs === 1 ? '' : 's'} of failure analyzed</div>}
            </div>
          </section>

          <section className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Recommendations</p>
            <div className="mt-2 space-y-2">
              {findings.length === 0 ? (
                <div className="rounded-xl border border-emerald-100 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-700 dark:text-emerald-400">No issues found. This design passed the automated checks.</div>
              ) : findings.map((finding, index) => {
                const style = SEVERITY_STYLE[finding.severity]
                return (
                  <div key={index} className={`rounded-xl border p-3 ${style.ring}`}>
                    <div className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} /><span className={`text-[9px] font-bold uppercase ${style.label}`}>{finding.severity}</span></div>
                    <h3 className="mt-1 text-xs font-semibold text-zinc-800 dark:text-zinc-100">{index + 1}. {finding.title}</h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{finding.recommendation}</p>
                    {finding.affectedNodeIds.length > 0 && <button onClick={() => onFocusNode(finding.affectedNodeIds[0])} className="mt-2 text-[10px] font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300">View on canvas →</button>}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </aside>
    </>
  )
}

function formatMs(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(value < 100 ? 1 : 0)} ms`
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-2.5 text-center">
      <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100">{value}</p>
    </div>
  )
}

const LATENCY_SEVERITY_STYLE = {
  Critical: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400',
  High: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-400',
  Medium: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400',
  Low: 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
} as const

function LatencySummary({ finding, onFocusNode }: { finding: LatencyFinding; onFocusNode: (nodeId: string) => void }) {
  return (
    <div className="mt-2 rounded-xl border border-violet-100 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Main bottleneck</p>
          <p className="mt-1 text-xs font-semibold text-zinc-900 dark:text-zinc-50">{finding.label}</p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${LATENCY_SEVERITY_STYLE[finding.severity]}`}>{finding.severity}</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <Metric label="Node p95" value={formatMs(finding.p95LatencyMs)} />
        <Metric label="Peak load" value={`${finding.maxLoadPct.toFixed(1)}%`} />
        <Metric label="Contribution" value={finding.latencyContributionPct === null ? '—' : `${finding.latencyContributionPct.toFixed(1)}%`} />
      </div>
      <button type="button" onClick={() => onFocusNode(finding.nodeId)} className="mt-2 text-[10px] font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300">View on canvas →</button>
    </div>
  )
}

function LatencyCard({
  finding,
  expanded,
  onToggle,
  onFocusNode,
}: {
  finding: LatencyFinding
  expanded: boolean
  onToggle: () => void
  onFocusNode: (nodeId: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <button type="button" onClick={onToggle} className="w-full px-3 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-50">{finding.label}</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{finding.type}</p>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold ${LATENCY_SEVERITY_STYLE[finding.severity]}`}>{finding.severity}</span>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-3 pb-3 pt-2.5">
          <div className="grid grid-cols-2 gap-1.5">
            <Metric label="Avg latency" value={formatMs(finding.avgLatencyMs)} />
            <Metric label="P95 latency" value={formatMs(finding.p95LatencyMs)} />
            <Metric label="Avg load" value={`${finding.avgLoadPct.toFixed(1)}%`} />
            <Metric label="Peak load" value={`${finding.maxLoadPct.toFixed(1)}%`} />
            <Metric label="Error rate" value={`${finding.avgErrorRatePct.toFixed(1)}%`} />
            <Metric label="Baseline" value={formatMs(finding.baselineLatencyMs)} />
          </div>
          <InfoRow label="Why" value={finding.reason} />
          {finding.latencyContributionPct !== null && <InfoRow label="Latency contribution" value={`${finding.latencyContributionPct.toFixed(1)}% of the derived critical-path component latency.`} />}
          {finding.downstreamComponents.length > 0 && <InfoRow label="Downstream impact" value={finding.downstreamComponents.join(' → ')} />}
          <InfoRow label="Recommendation" value={finding.recommendation} />
          <button type="button" onClick={() => onFocusNode(finding.nodeId)} className="mt-3 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-violet-700">View on canvas</button>
        </div>
      )}
    </div>
  )
}

function SPOFCard({ spof, expanded, onToggle, onFocusNode, onSimulateFailure }: { spof: SPOFFinding; expanded: boolean; onToggle: () => void; onFocusNode: (nodeId: string) => void; onSimulateFailure: (nodeId: string) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <button type="button" onClick={onToggle} className="w-full px-3 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0"><p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-50">{spof.label}</p><p className="mt-0.5 text-[9px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{spof.type}</p></div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold ${SPOF_SEVERITY_STYLE[spof.severity]}`}>{spof.severity}</span>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-3 pb-3 pt-2.5">
          <InfoRow label="Why" value={spof.reason} />
          <InfoRow label="Impact" value={spof.impact.join(' → ')} />
          <InfoRow label="Redundancy" value={spof.redundancyExplanation} />
          <InfoRow label="Action" value={spof.recommendation} />
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => onFocusNode(spof.nodeId)} className="rounded-lg bg-violet-600 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-violet-700">View on canvas</button>
            <button type="button" onClick={() => onSimulateFailure(spof.nodeId)} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-semibold text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50">Simulate node failure</button>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="mt-2"><p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{label}</p><p className="mt-0.5 text-[10px] leading-relaxed text-zinc-600 dark:text-zinc-300">{value}</p></div>
}
