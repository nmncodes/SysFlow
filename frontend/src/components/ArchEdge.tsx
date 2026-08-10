import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from 'reactflow'

export interface ArchEdgeData {
  inFlight?: number
  avgLatencyMs?: number
  active?: boolean
  hasFailure?: boolean
}

function latencyToColor(latencyMs: number): string {
  if (latencyMs <= 25) return '#60a5fa'
  if (latencyMs <= 60) return '#f59e0b'
  return '#ef4444'
}

function latencyToDuration(latencyMs: number): number {
  // slower particle = higher latency; clamp so it never freezes or blurs
  return Math.min(4, Math.max(0.6, latencyMs / 30))
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

  const strokeWidth = active ? Math.min(6, 1.5 + inFlight / 4) : 1.5
  const strokeColor = hasFailure ? '#ef4444' : active ? latencyToColor(latency) : '#d4d4d8'
  const particleCount = active ? Math.min(4, Math.max(1, Math.round(inFlight / 3))) : 0
  const rps = inFlight * 10

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: hasFailure ? '6 4' : undefined,
          transition: 'stroke 0.3s, stroke-width 0.3s',
        }}
      />
      {active &&
        Array.from({ length: particleCount }).map((_, i) => (
          <circle key={i} r={3.5} fill={strokeColor}>
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
            className="pointer-events-none flex items-center gap-1 rounded-full border border-zinc-100 bg-white/90 px-2 py-0.5 text-[10px] font-medium text-zinc-500 shadow-sm backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: strokeColor }} />
            {hasFailure && <span className="text-red-500">40% dropped ·</span>}
            {formatRps(rps)} rps · {Math.round(latency)}ms
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
