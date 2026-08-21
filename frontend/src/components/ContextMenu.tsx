import { useEffect, useRef } from 'react'
import { ClockIcon, PacketDropIcon, SkullIcon, ThrottleIcon } from './icons'

export interface ContextMenuState {
  x: number
  y: number
  targetType: 'node' | 'edge'
  targetId: string
}

interface Props {
  state: ContextMenuState
  hasFailure: boolean
  onKill: () => void
  onLatency: () => void
  onThrottle: () => void
  onDropPackets: () => void
  onClear: () => void
  onClose: () => void
  onCompare?: () => void
}

const itemClass =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50'

export default function ContextMenu({ state, hasFailure, onKill, onLatency, onThrottle, onDropPackets, onClear, onClose, onCompare }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', handler)
    window.addEventListener('scroll', onClose, true)
    return () => {
      window.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{ left: state.x, top: state.y }}
      className="fixed z-50 w-56 rounded-xl border border-zinc-100 bg-white p-1.5 shadow-xl"
    >
      {state.targetType === 'node' ? (
        <>
          <button onClick={onKill} className={itemClass}>
            <SkullIcon width={16} height={16} className="text-red-500" />
            Kill node
          </button>
          <button onClick={onLatency} className={itemClass}>
            <ClockIcon width={16} height={16} className="text-amber-500" />
            Add latency (+250ms)
          </button>
          <button onClick={onThrottle} className={itemClass}>
            <ThrottleIcon width={16} height={16} className="text-amber-500" />
            Throttle capacity (-60%)
          </button>
          {onCompare && (
            <>
              <div className="my-1 h-px bg-zinc-100" />
              <button onClick={onCompare} className={itemClass}>
                <span className="w-4 text-center text-violet-500">⇄</span>
                Compare alternative…
              </button>
            </>
          )}
        </>
      ) : (
        <button onClick={onDropPackets} className={itemClass}>
          <PacketDropIcon width={16} height={16} className="text-red-500" />
          Drop 40% of packets
        </button>
      )}
      {hasFailure && (
        <>
          <div className="my-1 h-px bg-zinc-100" />
          <button onClick={onClear} className={itemClass}>
            Restore to healthy
          </button>
        </>
      )}
    </div>
  )
}
