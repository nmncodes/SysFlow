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
        boxShadow: `0 0 0 2px ${ringColor}, 0 0 12px ${ringColor}55`,
      }}
      className={`flex min-w-[140px] flex-col items-center gap-1 rounded-xl border px-4 py-3 transition-shadow ${
        selected ? 'border-purple-400 bg-[#1c1e27]' : 'border-[#2e303a] bg-[#191b22]'
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-purple-400" />
      <span className="text-2xl leading-none">{def?.icon ?? '❓'}</span>
      <span className="text-sm font-medium text-gray-200">{data.label}</span>
      <span className="text-[10px] uppercase tracking-wide text-gray-500">{def?.label}</span>
      <Handle type="source" position={Position.Right} className="!bg-purple-400" />
    </div>
  )
}
