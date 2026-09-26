import type { ValidationResult } from '../lib/graphValidation'

interface Props {
  results: ValidationResult[]
  onFocusNode: (nodeId: string) => void
  onClose: () => void
}

const SEVERITY_ICON: Record<ValidationResult['severity'], string> = { error: '✕', warning: '⚠', info: 'ℹ' }
const SEVERITY_STYLE: Record<ValidationResult['severity'], string> = {
  error: 'border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400',
  warning: 'border-amber-100 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
  info: 'border-emerald-100 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400',
}

export default function ValidationPanel({ results, onFocusNode, onClose }: Props) {
  return (
    <>
      <div className="fixed inset-0 z-30 bg-zinc-900/20 dark:bg-black/50 md:hidden" onClick={onClose} />
      <aside className="analysis-sidebar panel-slide-in fixed inset-x-0 bottom-0 z-40 flex h-[75vh] flex-col rounded-t-2xl border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl md:static md:z-auto md:h-full md:w-[330px] md:shrink-0 md:rounded-none md:border-t-0 md:border-l md:shadow-none">
        <div className="border-b border-zinc-100 dark:border-zinc-800 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Structural check</p>
              <h2 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">Architecture validation</h2>
              <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">{results.length === 0 ? 'No issues found' : `${results.length} issue${results.length === 1 ? '' : 's'} found`}</p>
            </div>
            <button onClick={onClose} className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200">✕</button>
          </div>
        </div>

        <div className="overflow-y-auto p-4">
          {results.length === 0 ? (
            <div className="rounded-xl border border-emerald-100 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-700 dark:text-emerald-400">✓ No structural issues found.</div>
          ) : (
            <div className="space-y-2">
              {results.map((r) => (
                <div key={r.id} className={`rounded-xl border p-3 ${SEVERITY_STYLE[r.severity]}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{SEVERITY_ICON[r.severity]}</span>
                    <span className="text-[9px] font-bold uppercase">{r.severity}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">{r.message}</p>
                  {r.affectedNodeIds.length > 0 && (
                    <button onClick={() => onFocusNode(r.affectedNodeIds[0])} className="mt-2 text-[10px] font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300">
                      View on canvas →
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}