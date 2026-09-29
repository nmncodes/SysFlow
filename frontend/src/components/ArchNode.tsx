import { Handle, Position, type NodeProps } from 'reactflow'
import type { CSSProperties } from 'react'
import { COMPONENT_FAMILY_COLORS, COMPONENT_LIBRARY, formatComponentSpecs, HEALTH_COLORS, type HealthState } from './nodes'
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
  const familyColor = def ? COMPONENT_FAMILY_COLORS[def.category] : '#64748b'
  const iconColor = health === 'idle' ? familyColor : ringColor
  const pulsing = health === 'underLoad' || health === 'critical'
  const metrics = data.metrics
  const borderColor = selected
    ? '#8b5cf6'
    : health === 'down'
      ? '#ef4444'
      : health === 'critical'
        ? '#f97316'
        : health === 'underLoad'
          ? '#f59e0b'
          : familyColor
  const capacity = Number(data.config?.maxThroughput ?? data.config?.maxConcurrency ?? 0)
  const clientTargetRps = def?.category === 'Client' ? Number(data.config?.targetRps ?? 100) : 0
  const currentRps = Number(metrics?.rps ?? 0)
  const capacityPct = capacity > 0 ? Math.min(100, Math.round((currentRps / capacity) * 100)) : 0
  const capacityColor = capacityPct >= 90 ? '#ef4444' : capacityPct >= 70 ? '#f59e0b' : '#12b7d2'
  const specs = def ? formatComponentSpecs(def, data.config) : []

  return (
    <div
      className={`sysflow-node node-pop-in group relative flex min-w-[150px] flex-col rounded-2xl border-2 bg-white dark:bg-zinc-900 px-3 py-2.5 shadow-sm transition-all duration-200 ${
        selected ? 'z-20 shadow-[0_0_0_3px_rgba(124,58,237,0.13),0_12px_28px_rgba(24,24,27,0.12)]' : 'hover:z-30 hover:-translate-y-0.5 hover:shadow-lg'
      } ${data.connectionTarget ? 'connection-target' : ''} ${data.connectionSource ? 'connection-source' : ''} ${pulsing ? 'node-health-pulse' : ''}`}
      style={{ borderColor, '--node-family-color': familyColor, '--node-border-color': borderColor } as CSSProperties}
    >
      <Handle type="target" position={Position.Left} className="sysflow-handle !h-3 !w-3 !border-2 !border-white" style={{ backgroundColor: familyColor }} />
      <Handle type="source" position={Position.Right} className="sysflow-handle !h-3 !w-3 !border-2 !border-white" style={{ backgroundColor: familyColor }} />

      <div className="node-topline" style={{ background: familyColor }} />
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className="node-icon-wrap flex h-7 w-7 items-center justify-center rounded-lg text-zinc-700 dark:text-zinc-300"
          style={{ color: iconColor, borderColor: `${familyColor}45` }}
        >
          {Icon && <Icon width={15} height={15} />}
        </span>
        <span className="node-health-badge rounded-full px-1.5 py-0.5 text-[8px] font-semibold" style={{ color: ringColor, backgroundColor: `${ringColor}15` }}>
          {HEALTH_LABEL[health]}
        </span>
      </div>

      <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: health === 'idle' ? familyColor : ringColor }} /><span className="text-sm font-bold tracking-[-0.01em] text-zinc-900 dark:text-zinc-50">{data.label}</span></div>
      <div className="mt-1 flex items-center justify-between gap-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{def?.label}</span>
        {def?.category && (
          <span
            className="rounded-md border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
            style={{ color: familyColor, borderColor: `${familyColor}45`, backgroundColor: `${familyColor}14` }}
          >
            {def.category}
          </span>
        )}
      </div>

      {clientTargetRps > 0 && (
        <div className="mt-2.5 flex items-center justify-between rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/50 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          <span>Target RPS</span>
          <span style={{ color: familyColor }}>{clientTargetRps.toLocaleString()} req/s</span>
        </div>
      )}

      {capacity > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[8px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"><span>Capacity</span><span style={{ color: capacityColor }}>{capacityPct}%</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(3, capacityPct)}%`, backgroundColor: capacityColor }} /></div>
        </div>
      )}

      {metrics && (metrics.cpu !== undefined || metrics.latency !== undefined || metrics.rps !== undefined) && (
        <div className="mt-3 grid grid-cols-3 gap-1 border-t border-zinc-100 dark:border-zinc-800 pt-2 text-[9px] text-zinc-500 dark:text-zinc-400">
          <span><b className="block text-zinc-700 dark:text-zinc-200">{Math.round(metrics.cpu ?? 0)}%</b>CPU</span>
          <span><b className="block text-zinc-700 dark:text-zinc-200">{Math.round(metrics.latency ?? 0)}ms</b>Latency</span>
          <span><b className="block text-zinc-700 dark:text-zinc-200">{Math.round(metrics.rps ?? 0)}</b>RPS</span>
        </div>
      )}

      {data.replicas !== undefined && (data.replicas > 1 || data.componentType === 'autoScalingGroup') && (
        <span className="absolute -left-2 -top-2 flex h-5 min-w-[22px] items-center justify-center rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-900 dark:bg-zinc-100 px-1 text-[9px] font-bold text-white dark:text-zinc-900 shadow-sm">
          x{data.replicas}
        </span>
      )}

      {data.hasFailure && (
        <span className="absolute -left-2 -bottom-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white dark:border-zinc-900 bg-red-500 text-white shadow-sm" title="Failure injected">
          <LightningIcon width={11} height={11} />
        </span>
      )}

      {!!data.commentCount && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={data.onComment}
          title={`${data.commentCount} comment${data.commentCount === 1 ? '' : 's'}`}
          className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white dark:border-zinc-900 bg-violet-600 px-1 text-[9px] font-bold text-white shadow-sm"
        >
          {data.commentCount}
        </button>
      )}

      <div className="node-actions absolute -right-1.5 -top-8 flex items-center gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-0.5 shadow-md">
        <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={data.onConfigure} title="Configure" className="rounded-md px-1.5 py-0.5 text-[9px] font-medium text-zinc-500 dark:text-zinc-400 hover:bg-violet-50 dark:hover:bg-violet-950/50 hover:text-violet-600 dark:hover:text-violet-400">Configure</button>
        {data.onComment && <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={data.onComment} title="Comments" className="rounded-md px-1.5 py-0.5 text-[9px] font-medium text-zinc-500 dark:text-zinc-400 hover:bg-violet-50 dark:hover:bg-violet-950/50 hover:text-violet-600 dark:hover:text-violet-400">Comment</button>}
        <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={data.onDuplicate} title="Duplicate" className="rounded-md px-1.5 py-0.5 text-[9px] font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700">Duplicate</button>
        <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={data.onDelete} title="Delete" className="rounded-md px-1.5 py-0.5 text-[9px] font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50">Delete</button>
      </div>

      {def && (
        <div
          className="node-hover-overview pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-60 -translate-x-1/2 rounded-xl border bg-white/98 dark:bg-zinc-900/98 p-2.5 opacity-0 shadow-xl backdrop-blur-md transition-opacity duration-150 group-hover:opacity-100"
          style={{ borderColor: familyColor }}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100">{def.label}</span>
            <span className="truncate text-[9px] font-medium text-zinc-400 dark:text-zinc-500">{def.examples}</span>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-zinc-600 dark:text-zinc-300">{def.description}</p>
          {specs.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1 border-t border-zinc-100 dark:border-zinc-800 pt-1.5">
              {specs.map((spec) => (
                <span key={spec} className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[8px] font-semibold text-zinc-600 dark:text-zinc-300">
                  {spec}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}