import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from 'reactflow'

export interface ArchEdgeData {
  inFlight?: number
  avgLatencyMs?: number
  active?: boolean
  hasFailure?: boolean
  selected?: boolean
  onSelect?: () => void
}

function latencyToColor(latencyMs: number): string {
  if (latencyMs <= 60) return '#22c1dc'
  if (latencyMs <= 120) return '#f59e0b'
  return '#ef4444'
}

function latencyToDuration(latencyMs: number): number {
  return Math.min(4, Math.max(0.65, latencyMs / 30))
}

function formatRps(rps: number): string {
  if (rps >= 1000) return `${(rps / 1000).toFixed(1)}k`
  return Math.round(rps).toString()
}

export default function ArchEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<ArchEdgeData>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const inFlight = data?.inFlight ?? 0
  const latency = data?.avgLatencyMs ?? 0
  const active = data?.active ?? false
  const hasFailure = data?.hasFailure ?? false
  const selected = data?.selected ?? false
  const strokeWidth = selected ? 3 : active ? Math.min(5, 1.8 + inFlight / 4) : 2
  const strokeColor = hasFailure ? '#ef4444' : active ? latencyToColor(latency) : '#22c1dc'
  const particleCount = active ? Math.min(4, Math.max(1, Math.round(inFlight / 3))) : 0
  const rps = inFlight * 10
  const markerId = `sysflow-arrow-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`

  return (
    <>
      <defs>
        <filter id={`sysflow-glow-${markerId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={strokeColor} />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={`url(#${markerId})`}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeLinecap: 'round',
          strokeDasharray: hasFailure ? '7 5' : undefined,
          opacity: selected ? 1 : 0.82,
          filter: active || selected ? `url(#sysflow-glow-${markerId})` : undefined,
          transition: 'stroke 0.3s, stroke-width 0.3s, opacity 0.3s',
        }}
      />
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        className="react-flow__edge-interaction"
        onClick={(event) => {
          event.stopPropagation()
          data?.onSelect?.()
        }}
      />
      {active &&
        Array.from({ length: particleCount }).map((_, i) => (
          <circle key={i} r={3.2} fill={strokeColor} pointerEvents="none" className="sysflow-traffic-particle">
            <animateMotion
              dur={`${latencyToDuration(latency)}s`}
              begin={`${(i * latencyToDuration(latency)) / particleCount}s`}
              repeatCount="indefinite"
              path={path}
            />
          </circle>
        ))}
      {(hasFailure || (active && rps > 0.5)) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            className="pointer-events-none flex items-center gap-1 rounded-full border border-zinc-200 bg-white/95 px-2 py-1 text-[10px] font-semibold text-zinc-600 shadow-sm backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: strokeColor }} />
            {hasFailure && <span className="text-red-500">Failed ·</span>}
            {formatRps(rps)} rps · {Math.round(latency)}ms
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}