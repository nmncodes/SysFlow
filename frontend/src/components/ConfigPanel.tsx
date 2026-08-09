import type { Node } from 'reactflow'
import { COMPONENT_LIBRARY } from './nodes'
import { COMPONENT_ICONS } from './icons'
import type { ArchNodeData } from './ArchNode'

interface Props {
  node: Node<ArchNodeData> | null
  onChange: (nodeId: string, config: Record<string, unknown>) => void
  onDelete: (nodeId: string) => void
  onClose: () => void
}

export default function ConfigPanel({ node, onChange, onDelete, onClose }: Props) {
  if (!node) return null
  const def = COMPONENT_LIBRARY.find((c) => c.type === node.data.componentType)
  const Icon = COMPONENT_ICONS[node.data.componentType as keyof typeof COMPONENT_ICONS]
  const config = (node.data as unknown as { config?: Record<string, unknown> }).config ?? def?.defaultConfig ?? {}

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-50 text-zinc-600">
            {Icon && <Icon />}
          </span>
          <h2 className="text-sm font-semibold text-zinc-800">{def?.label}</h2>
        </div>
        <button onClick={onClose} className="text-zinc-400 transition hover:text-zinc-600">
          ✕
        </button>
      </div>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
        Name
        <input
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
          value={node.data.label}
          onChange={(e) => onChange(node.id, { ...config, __label: e.target.value })}
        />
      </label>
      {Object.entries(config)
        .filter(([k]) => k !== '__label')
        .map(([key, value]) => (
          <label key={key} className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
            {key}
            <input
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
              value={String(value)}
              onChange={(e) =>
                onChange(node.id, { ...config, [key]: isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value) })
              }
            />
          </label>
        ))}
      <button
        onClick={() => onDelete(node.id)}
        className="mt-auto rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
      >
        Delete Node
      </button>
    </aside>
  )
}
