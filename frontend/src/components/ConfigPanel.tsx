import type { Node } from 'reactflow'
import { COMPONENT_LIBRARY } from './nodes'
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
  const config = (node.data as unknown as { config?: Record<string, unknown> }).config ?? def?.defaultConfig ?? {}

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-3 border-l border-[#2e303a] bg-[#14151b] p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-200">
          {def?.icon} {def?.label}
        </h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
          ✕
        </button>
      </div>
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Name
        <input
          className="rounded border border-[#2e303a] bg-[#191b22] px-2 py-1 text-sm text-gray-200"
          value={node.data.label}
          onChange={(e) => onChange(node.id, { ...config, __label: e.target.value })}
        />
      </label>
      {Object.entries(config)
        .filter(([k]) => k !== '__label')
        .map(([key, value]) => (
          <label key={key} className="flex flex-col gap-1 text-xs text-gray-400">
            {key}
            <input
              className="rounded border border-[#2e303a] bg-[#191b22] px-2 py-1 text-sm text-gray-200"
              value={String(value)}
              onChange={(e) =>
                onChange(node.id, { ...config, [key]: isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value) })
              }
            />
          </label>
        ))}
      <button
        onClick={() => onDelete(node.id)}
        className="mt-auto rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-400 hover:bg-red-950/70"
      >
        Delete Node
      </button>
    </aside>
  )
}
