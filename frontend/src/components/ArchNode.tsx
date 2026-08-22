import { Handle, Position, type NodeProps } from 'reactflow'
import { COMPONENT_LIBRARY, HEALTH_COLORS, type HealthState } from './nodes'
import { COMPONENT_ICONS, LightningIcon } from './icons'

export interface ArchNodeMetrics {
  cpu?: number
  latency?: number
  rps?: number
}

export interface ArchNodeData {
  componentType: string
  label: string
  config: Record<string, unknown>
  health?: HealthState
  replicas?: number
  hasFailure?: boolean
  metrics?: ArchNodeMetrics
  connectionTarget?: boolean
  connectionSource?: boolean
  commentCount?: number
  onConfigure?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  onComment?: () => void
}

const HEALTH_LABEL: Record<HealthState, string> = {
  idle: 'Ready',
  healthy: 'Healthy',
  underLoad: 'Warning',
  critical: 'Critical',
  down: 'Down',
}

export default function ArchNode({ data, selected }: NodeProps<ArchNodeData>) {
  const def = COMPONENT_LIBRARY.find((c) => c.type === data.componentType)
  const Icon = COMPONENT_ICONS[data.componentType as keyof typeof COMPONENT_ICONS]
  const health: HealthState = data.health ?? 'idle'
  const ringColor = HEALTH_COLORS[health]
  const pulsing = health === 'underLoad' || health === 'critical'
  const metrics = data.metrics
  const borderColor = selected ? '#8b5cf6' : health === 'down' ? '#ef4444' : health === 'critical' ? '#fca5a5' : health === 'underLoad' ? '#fcd34d' : '#dbe7eb'
  const capacity = Number(data.config?.maxThroughput ?? data.config?.maxConcurrency ?? 0)
  const currentRps = Number(metrics?.rps ?? 0)
  const capacityPct = capacity > 0 ? Math.min(100, Math.round((currentRps / capacity) * 100)) : 0
  const capacityColor = capacityPct >= 90 ? '#ef4444' : capacityPct >= 70 ? '#f59e0b' : '#12b7d2'

  return (
    <div
      className={`sysflow-node node-pop-in group relative flex min-w-[150px] flex-col rounded-2xl border bg-white px-3 py-2.5 shadow-sm transition-all duration-200 ${
        selected ? 'z-20 shadow-[0_0_0_3px_rgba(124,58,237,0.13),0_12px_28px_rgba(24,24,27,0.12)]' : 'hover:-translate-y-0.5 hover:shadow-lg'
      } ${data.connectionTarget ? 'connection-target' : ''} ${data.connectionSource ? 'connection-source' : ''} ${pulsing ? 'node-health-pulse' : ''}`}
      style={{ borderColor }}
    >
      <Handle type="target" position={Position.Left} className="sysflow-handle !h-3 !w-3 !border-2 !border-white !bg-cyan-500" />
      <Handle type="source" position={Position.Right} className="sysflow-handle !h-3 !w-3 !border-2 !border-white !bg-cyan-500" />

      <div className="node-topline" />
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="node-icon-wrap flex h-7 w-7 items-center justify-center rounded-lg text-zinc-700" style={{ color: ringColor }}>
          {Icon && <Icon width={15} height={15} />}
        </span>
        <span className="node-health-badge rounded-full px-1.5 py-0.5 text-[8px] font-semibold" style={{ color: ringColor, backgroundColor: `${ringColor}15` }}>
          {HEALTH_LABEL[health]}
        </span>
      </div>

      <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ringColor }} /><span className="text-sm font-bold tracking-[-0.01em] text-zinc-900">{data.label}</span></div>
      <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">{def?.label}</span>

      {capacity > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[8px] font-bold uppercase tracking-wider text-zinc-400"><span>Capacity</span><span style={{ color: capacityColor }}>{capacityPct}%</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(3, capacityPct)}%`, backgroundColor: capacityColor }} /></div>
        </div>
      )}

      {metrics && (metrics.cpu !== undefined || metrics.latency !== undefined || metrics.rps !== undefined) && (
        <div className="mt-3 grid grid-cols-3 gap-1 border-t border-zinc-100 pt-2 text-[9px] text-zinc-500">
          <span><b className="block text-zinc-700">{Math.round(metrics.cpu ?? 0)}%</b>CPU</span>
          <span><b className="block text-zinc-700">{Math.round(metrics.latency ?? 0)}ms</b>Latency</span>
          <span><b className="block text-zinc-700">{Math.round(metrics.rps ?? 0)}</b>RPS</span>
        </div>
      )}

      {data.replicas !== undefined && (data.replicas > 1 || data.componentType === 'autoScalingGroup') && (
        <span className="absolute -left-2 -top-2 flex h-5 min-w-[22px] items-center justify-center rounded-full border-2 border-white bg-zinc-900 px-1 text-[9px] font-bold text-white shadow-sm">
          x{data.replicas}
        </span>
      )}

      {data.hasFailure && (
        <span className="absolute -left-2 -bottom-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-red-500 text-white shadow-sm" title="Failure injected">
          <LightningIcon width={11} height={11} />
        </span>
      )}

      {!!data.commentCount && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={data.onComment}
          title={`${data.commentCount} comment${data.commentCount === 1 ? '' : 's'}`}
          className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white bg-violet-600 px-1 text-[9px] font-bold text-white shadow-sm"
        >
          {data.commentCount}
        </button>
      )}

      <div className="node-actions absolute -right-1.5 -top-8 flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-white p-0.5 shadow-md">
        <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={data.onConfigure} title="Configure" className="rounded-md px-1.5 py-0.5 text-[9px] font-medium text-zinc-500 hover:bg-violet-50 hover:text-violet-600">Configure</button>
        {data.onComment && <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={data.onComment} title="Comments" className="rounded-md px-1.5 py-0.5 text-[9px] font-medium text-zinc-500 hover:bg-violet-50 hover:text-violet-600">Comment</button>}
        <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={data.onDuplicate} title="Duplicate" className="rounded-md px-1.5 py-0.5 text-[9px] font-medium text-zinc-500 hover:bg-zinc-50">Duplicate</button>
        <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={data.onDelete} title="Delete" className="rounded-md px-1.5 py-0.5 text-[9px] font-medium text-red-500 hover:bg-red-50">Delete</button>
      </div>
    </div>
  )
}