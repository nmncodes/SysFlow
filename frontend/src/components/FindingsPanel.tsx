import type { AnalyzeResult, SimulationSummary } from '../lib/api'

interface Props {
  findings: AnalyzeResult['findings']
  aiEnabled: boolean
  summary?: SimulationSummary | null
  onFocusNode: (nodeId: string) => void
  onClose: () => void
}

const SEVERITY_STYLE = {
  critical: { dot: 'bg-red-500', ring: 'border-red-100 bg-red-50', label: 'text-red-600' },
  warning: { dot: 'bg-amber-500', ring: 'border-amber-100 bg-amber-50', label: 'text-amber-600' },
  info: { dot: 'bg-emerald-500', ring: 'border-emerald-100 bg-emerald-50', label: 'text-emerald-600' },
} as const

export default function FindingsPanel({ findings, aiEnabled, summary, onFocusNode, onClose }: Props) {
  const bottlenecks = findings.filter((f) => f.severity === 'critical' || f.severity === 'warning').length
  const spofs = summary?.singlePointsOfFailure.length ?? findings.filter((f) => f.title.toLowerCase().includes('single')).length
  const overallHealth = summary ? Math.max(0, Math.min(100, Math.round(100 - summary.avgErrorRatePct * 4 - Math.max(0, summary.bottleneckLoadPct - 70) * 0.5))) : findings.length === 0 ? 100 : Math.max(55, 100 - findings.length * 8)

  return (
    <aside className="analysis-sidebar panel-slide-in flex w-[330px] shrink-0 flex-col border-l border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">System analysis</p>
            <h2 className="mt-1 text-base font-semibold text-zinc-900">Architecture review</h2>
            <p className="mt-1 text-[10px] text-zinc-400">{aiEnabled ? 'Rule-checked + AI-reviewed' : 'Rule-based analysis'}</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700">✕</button>
        </div>
      </div>

      <div className="overflow-y-auto p-4">
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Overall health</p>
              <p className="mt-1 text-3xl font-bold text-zinc-900">{overallHealth}%</p>
            </div>
            <div className="h-14 w-14 rounded-full border-[6px] border-emerald-100 border-t-emerald-500" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white p-3"><b className="block text-lg text-amber-600">{bottlenecks}</b><span className="text-[9px] uppercase tracking-wide text-zinc-400">Bottlenecks</span></div>
            <div className="rounded-xl bg-white p-3"><b className="block text-lg text-red-500">{spofs}</b><span className="text-[9px] uppercase tracking-wide text-zinc-400">Single points</span></div>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Checks</p>
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700"><span>✓</span> Load distribution reviewed</div>
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700"><span>✓</span> Capacity constraints reviewed</div>
            {bottlenecks > 0 && <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700"><span>⚠</span> {bottlenecks} potential bottleneck{bottlenecks === 1 ? '' : 's'} found</div>}
            {spofs > 0 && <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600"><span>⚠</span> {spofs} single point{spofs === 1 ? '' : 's'} of failure</div>}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Recommendations</p>
          <div className="mt-2 space-y-2">
            {findings.length === 0 ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-700">No issues found. This design passed the automated checks.</div>
            ) : findings.map((finding, index) => {
              const style = SEVERITY_STYLE[finding.severity]
              return (
                <div key={index} className={`rounded-xl border p-3 ${style.ring}`}>
                  <div className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} /><span className={`text-[9px] font-bold uppercase ${style.label}`}>{finding.severity}</span></div>
                  <h3 className="mt-1 text-xs font-semibold text-zinc-800">{index + 1}. {finding.title}</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{finding.recommendation}</p>
                  {finding.affectedNodeIds.length > 0 && <button onClick={() => onFocusNode(finding.affectedNodeIds[0])} className="mt-2 text-[10px] font-semibold text-violet-600 hover:text-violet-800">View on canvas →</button>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </aside>
  )
}