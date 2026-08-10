import type { Finding } from '../lib/api'

interface Props {
  findings: Finding[]
  aiEnabled: boolean
  onFocusNode: (nodeId: string) => void
  onClose: () => void
}

const SEVERITY_STYLE: Record<Finding['severity'], { dot: string; ring: string; label: string }> = {
  critical: { dot: 'bg-red-500', ring: 'ring-red-100 bg-red-50', label: 'text-red-600' },
  warning: { dot: 'bg-amber-500', ring: 'ring-amber-100 bg-amber-50', label: 'text-amber-600' },
  info: { dot: 'bg-violet-500', ring: 'ring-violet-100 bg-violet-50', label: 'text-violet-600' },
}

export default function FindingsPanel({ findings, aiEnabled, onFocusNode, onClose }: Props) {
  return (
    <aside className="panel-slide-in flex w-80 shrink-0 flex-col overflow-y-auto border-l border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 p-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-800">Design Findings</h2>
          <p className="text-[11px] text-zinc-400">
            {aiEnabled ? 'Rule-checked + AI-reviewed' : 'Rule-based checks (no AI key configured)'}
          </p>
        </div>
        <button onClick={onClose} className="text-zinc-400 transition hover:text-zinc-600">
          ✕
        </button>
      </div>

      {findings.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <span className="text-2xl">✓</span>
          <p className="text-sm font-medium text-zinc-600">No issues found</p>
          <p className="text-xs text-zinc-400">This design passed every automated check.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-3">
          {findings.map((f, i) => {
            const style = SEVERITY_STYLE[f.severity]
            return (
              <div key={i} className={`rounded-xl p-3 ring-1 ${style.ring}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${style.label}`}>
                    {f.severity}
                  </span>
                </div>
                <h3 className="mt-1.5 text-[13px] font-semibold text-zinc-800">{f.title}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">{f.explanation}</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-700">
                  <span className="font-medium">Fix: </span>
                  {f.recommendation}
                </p>
                {f.affectedNodeIds.length > 0 && (
                  <button
                    onClick={() => onFocusNode(f.affectedNodeIds[0])}
                    className="mt-2 text-[11px] font-medium text-violet-600 hover:text-violet-800"
                  >
                    View on canvas →
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </aside>
  )
}
