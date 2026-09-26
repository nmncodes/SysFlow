import type { InjectedFailure } from './api'

export type NodeFailureType = 'kill' | 'latency' | 'throttle'
export type EdgeFailureType = 'dropPct'

export function makeNodeFailure(nodeId: string, type: NodeFailureType): InjectedFailure {
  switch (type) {
    case 'kill':
      return { type: 'kill', nodeId, fromTick: 0 }
    case 'latency':
      return { type: 'latency', nodeId, fromTick: 0, extraMs: 250 }
    case 'throttle':
      return { type: 'throttle', nodeId, fromTick: 0, throttlePct: 60 }
  }
}

export function makeEdgeFailure(edgeId: string): InjectedFailure {
  return { type: 'dropPct', edgeId, fromTick: 0, dropPct: 40 }
}
