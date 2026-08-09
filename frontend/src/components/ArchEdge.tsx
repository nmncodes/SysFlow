import { BaseEdge, getBezierPath, type EdgeProps } from 'reactflow'

export interface ArchEdgeData {
  inFlight?: number
  avgLatencyMs?: number
  active?: boolean
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
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const inFlight = data?.inFlight ?? 0
  const latency = data?.avgLatencyMs ?? 0
  const active = data?.active ?? false

  const strokeWidth = active ? Math.min(6, 1.5 + inFlight / 4) : 1.5
  const strokeColor = active ? latencyToColor(latency) : '#d4d4d8'
  const particleCount = active ? Math.min(4, Math.max(1, Math.round(inFlight / 3))) : 0

  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: strokeColor, strokeWidth, transition: 'stroke 0.3s, stroke-width 0.3s' }} />
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
    </>
  )
}
