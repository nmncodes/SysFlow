import { Handle, Position, type NodeProps } from 'reactflow'
import { COMPONENT_LIBRARY, HEALTH_COLORS, type HealthState } from './nodes'

export interface ArchNodeData {
  componentType: string
  label: string
  health?: HealthState
}

export default function ArchNode({ data, selected }: NodeProps<ArchNodeData>) {
  const def = COMPONENT_LIBRARY.find((c) => c.type === data.componentType)
  const health: HealthState = data.health ?? 'idle'
  const ringColor = HEALTH_COLORS[health]

  return (
    <div
      style={{
        boxShadow: selected
          ? `0 0 0 2px ${ringColor}33, 0 4px 16px rgba(0,0,0,0.08)`
          : `0 0 0 1.5px ${ringColor}55, 0 1px 3px rgba(0,0,0,0.04)`,
      }}
      className="flex min-w-[136px] flex-col items-center gap-1 rounded-2xl border border-white bg-white px-4 py-3.5 transition-shadow"
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-2 !border-white !bg-violet-400" />
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-50 text-xl leading-none">
        {def?.icon ?? '❓'}
      </span>
      <span className="text-sm font-medium text-zinc-800">{data.label}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{def?.label}</span>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-2 !border-white !bg-violet-400" />
    </div>
  )
}
