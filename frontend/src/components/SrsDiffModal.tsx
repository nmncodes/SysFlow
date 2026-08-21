import type { Edge, Node } from 'reactflow'
import type { ArchNodeData } from './ArchNode'
import { COMPONENT_LIBRARY, type ComponentType } from './nodes'
import type { SrsImportResult } from '../lib/api'

interface Props {
  currentNodes: Node<ArchNodeData>[]
  currentEdges: Edge[]
  imported: SrsImportResult
  fileName: string
  onConfirm: () => void
  onCancel: () => void
}

function labelFor(type: string) {
  return COMPONENT_LIBRARY.find((c) => c.type === type)?.label ?? type
}

function countByType(types: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1)
  return counts
}

export default function SrsDiffModal({ currentNodes, currentEdges, imported, fileName, onConfirm, onCancel }: Props) {
  const currentCounts = countByType(currentNodes.map((n) => n.data.componentType))
  const newCounts = countByType(imported.graphJson.nodes.map((n) => n.type))

  const allTypes = new Set<string>([...currentCounts.keys(), ...newCounts.keys()])
  const added: { type: ComponentType; delta: number }[] = []
  const removed: { type: ComponentType; delta: number }[] = []
  for (const type of allTypes) {
    const before = currentCounts.get(type) ?? 0
    const after = newCounts.get(type) ?? 0
    if (after > before) added.push({ type: type as ComponentType, delta: after - before })
    if (before > after) removed.push({ type: type as ComponentType, delta: before - after })
  }

  const edgeCountDelta = imported.graphJson.edges.length - currentEdges.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/20 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-zinc-900">Review changes before replacing</h3>
        <p className="mt-1 text-xs text-zinc-400">
          Your canvas already has {currentNodes.length} component{currentNodes.length === 1 ? '' : 's'}. Importing <b>{fileName}</b> will replace it with {imported.graphJson.nodes.length}.
        </p>

        <div className="mt-4 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-zinc-100 p-3">
          {added.length === 0 && removed.length === 0 && (
            <p className="text-xs text-zinc-400">Same component mix, just re-laid-out and re-analyzed.</p>
          )}
          {added.map(({ type, delta }) => (
            <div key={`add-${type}`} className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-emerald-600">+{delta}</span>
              <span className="text-zinc-700">{labelFor(type)}</span>
            </div>
          ))}
          {removed.map(({ type, delta }) => (
            <div key={`rm-${type}`} className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-red-500">−{delta}</span>
              <span className="text-zinc-700">{labelFor(type)}</span>
            </div>
          ))}
          {edgeCountDelta !== 0 && (
            <div className="flex items-center gap-2 border-t border-zinc-100 pt-1 text-xs text-zinc-500">
              <span>{edgeCountDelta > 0 ? '+' : ''}{edgeCountDelta} connection{Math.abs(edgeCountDelta) === 1 ? '' : 's'}</span>
            </div>
          )}
        </div>

        <p className="mt-3 text-[11px] text-zinc-400">This can't be undone from here — but if the canvas is a saved project, its version history will still have the old state.</p>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-50">Keep current diagram</button>
          <button onClick={onConfirm} className="btn-dark rounded-xl px-4 py-2 text-sm font-semibold">Replace with imported</button>
        </div>
      </div>
    </div>
  )
}
