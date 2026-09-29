import { useCallback, useEffect, useRef, useState } from 'react'
import { Client, type IMessage } from '@stomp/stompjs'
import { getToken } from './auth'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'
const GRAPH_BROADCAST_DEBOUNCE_MS = 400
const CURSOR_BROADCAST_THROTTLE_MS = 80

const CURSOR_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
const HEARTBEAT_INTERVAL_MS = 15000
const STALE_AFTER_MS = 35000 // a bit over 2x the heartbeat interval

export interface Collaborator {
  clientId: string
  name: string
  color: string
}

export interface RemoteCursor extends Collaborator {
  x: number
  y: number
}

export interface GraphPayload {
  nodes: { id: string; type: string; label: string; config: Record<string, unknown>; position: { x: number; y: number } }[]
  edges: { id: string; source: string; target: string }[]
}

function wsUrl(): string {
  const httpBase = API_BASE.replace(/\/api\/?$/, '')
  return httpBase.replace(/^http/, 'ws') + '/ws'
}

function colorFor(clientId: string): string {
  let hash = 0
  for (let i = 0; i < clientId.length; i++) hash = (hash * 31 + clientId.charCodeAt(i)) | 0
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

function mergeValue(base: unknown, local: unknown, remote: unknown, path: string): { value: unknown; conflicts: string[] } {
  if (stableStringify(base) === stableStringify(local)) return { value: remote, conflicts: [] }
  if (stableStringify(base) === stableStringify(remote) || stableStringify(local) === stableStringify(remote)) {
    return { value: local, conflicts: [] }
  }

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
  if (isRecord(local) && isRecord(remote) && (base === undefined || isRecord(base))) {
    const merged: Record<string, unknown> = {}
    const conflicts: string[] = []
    const fields = new Set([...Object.keys(base ?? {}), ...Object.keys(local), ...Object.keys(remote)])
    for (const field of fields) {
      const result = mergeValue(isRecord(base) ? base[field] : undefined, local[field], remote[field], `${path}.${field}`)
      if (result.value !== undefined) merged[field] = result.value
      conflicts.push(...result.conflicts)
    }
    return { value: merged, conflicts }
  }
  return { value: local, conflicts: [path] }
}

function mergeEntities<T extends { id: string }>(base: T[], local: T[], remote: T[], kind: string) {
  const byId = (items: T[]) => new Map(items.map((item) => [item.id, item]))
  const baseById = byId(base)
  const localById = byId(local)
  const remoteById = byId(remote)
  const ids = new Set([...localById.keys(), ...remoteById.keys()])
  const merged: T[] = []
  const conflicts: string[] = []

  for (const id of ids) {
    const result = mergeValue(baseById.get(id), localById.get(id), remoteById.get(id), `${kind}:${id}`)
    if (result.value) merged.push(result.value as T)
    conflicts.push(...result.conflicts)
  }
  return { merged, conflicts }
}

function mergeGraphs(base: GraphPayload, local: GraphPayload, remote: GraphPayload) {
  const nodes = mergeEntities(base.nodes, local.nodes, remote.nodes, 'node')
  const edges = mergeEntities(base.edges, local.edges, remote.edges, 'edge')
  return {
    graph: { nodes: nodes.merged, edges: edges.merged },
    conflicts: [...nodes.conflicts, ...edges.conflicts],
  }
}

export interface CollaborationConflict {
  revision: number
  payload: GraphPayload
  conflicts: string[]
  localDraft: GraphPayload
}

type LiveMessage =
  | { type: 'presence-join'; clientId: string; name: string; color: string; initial?: boolean }
  | { type: 'presence-leave'; clientId: string }
  | { type: 'cursor'; clientId: string; name: string; color: string; x: number; y: number }
  | { type: 'graph'; clientId: string; baseRevision?: number; revision?: number; payload: GraphPayload }
  | { type: 'conflict'; clientId: string; revision: number; payload: GraphPayload; conflicts: string[] }
export function useCollabSession(projectId: string | null, displayName: string | null, canEdit = true) {
  const [connected, setConnected] = useState(false)
  const [revision, setRevision] = useState(0)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({})

  const clientIdRef = useRef<string>(crypto.randomUUID())
  const canEditRef = useRef(canEdit)
  canEditRef.current = canEdit
  const nameRef = useRef<string>(displayName?.trim() || 'Guest')
  const colorRef = useRef<string>(colorFor(clientIdRef.current))
  const stompRef = useRef<Client | null>(null)
  const graphDebounceRef = useRef<number | null>(null)
  const lastSentGraphJsonRef = useRef<string>('')
  const localGraphRef = useRef<GraphPayload | null>(null)
  const baseGraphRef = useRef<GraphPayload | null>(null)
  const serverRevisionRef = useRef(0)
  const pendingConflictRef = useRef<CollaborationConflict | null>(null)
  const [conflict, setConflict] = useState<CollaborationConflict | null>(null)
  const cursorThrottleRef = useRef<number>(0)
  const onRemoteGraphRef = useRef<((payload: GraphPayload) => void) | null>(null)
  const seenClientIdsRef = useRef<Set<string>>(new Set())
  const lastSeenAtRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    nameRef.current = displayName?.trim() || 'Guest'
  }, [displayName])

  const send = useCallback((message: LiveMessage) => {
    const client = stompRef.current
    if (!client?.connected || !projectId) return false
    const destination = message.type === 'graph'
      ? `/app/project/${projectId}/broadcast`
      : `/app/project/${projectId}/presence`
    client.publish({ destination, body: JSON.stringify(message) })
    return true
  }, [projectId])

  const sendGraph = useCallback((payload: GraphPayload, force = false) => {
    if (!canEditRef.current || pendingConflictRef.current) return
    const json = stableStringify(payload)
    if (!force && json === lastSentGraphJsonRef.current) return
    if (send({ type: 'graph', clientId: clientIdRef.current, baseRevision: serverRevisionRef.current, payload })) {
      lastSentGraphJsonRef.current = json
    }
  }, [send])

  useEffect(() => {
    if (!projectId) {
      setConnected(false)
      setCollaborators([])
      setRemoteCursors({})
      return
    }

    const clientId = clientIdRef.current
    const client = new Client({
      brokerURL: wsUrl(),
      connectHeaders: { Authorization: `Bearer ${getToken() ?? ''}` },
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    })

    seenClientIdsRef.current = new Set()
    lastSeenAtRef.current = new Map()
    serverRevisionRef.current = 0
    setRevision(0)
    lastSentGraphJsonRef.current = ''
    baseGraphRef.current = null
    localGraphRef.current = null
    pendingConflictRef.current = null
    setConflict(null)

    client.onConnect = () => {
      setConnected(true)
      client.subscribe(`/user/queue/project/${projectId}`, (msg: IMessage) => {
        let message: LiveMessage
        try {
          message = JSON.parse(msg.body)
        } catch {
          return
        }
        if (message.type === 'graph') {
          if (typeof message.revision !== 'number') return
          if (message.revision <= serverRevisionRef.current) return
          const base = baseGraphRef.current ?? localGraphRef.current ?? message.payload
          const local = localGraphRef.current ?? message.payload
          const result = mergeGraphs(base, local, message.payload)
          serverRevisionRef.current = message.revision
          setRevision(message.revision)
          baseGraphRef.current = message.payload
          if (pendingConflictRef.current) {
            const refreshedConflict = {
              revision: message.revision,
              payload: message.payload,
              conflicts: [...new Set([...pendingConflictRef.current.conflicts, ...result.conflicts])],
              localDraft: result.graph,
            }
            pendingConflictRef.current = refreshedConflict
            setConflict(refreshedConflict)
            if (graphDebounceRef.current) window.clearTimeout(graphDebounceRef.current)
            return
          }
          if (result.conflicts.length > 0) {
            const conflictState = { revision: message.revision, payload: message.payload, conflicts: result.conflicts, localDraft: result.graph }
            pendingConflictRef.current = conflictState
            setConflict(conflictState)
            if (graphDebounceRef.current) window.clearTimeout(graphDebounceRef.current)
            return
          }

          localGraphRef.current = result.graph
          if (stableStringify(result.graph) !== stableStringify(local)) onRemoteGraphRef.current?.(result.graph)
          if (stableStringify(result.graph) === stableStringify(message.payload)) lastSentGraphJsonRef.current = stableStringify(result.graph)
          else sendGraph(result.graph)
          return
        }

        if (message.clientId === clientIdRef.current) return
        lastSeenAtRef.current.set(message.clientId, Date.now())

        if (message.type === 'presence-join') {
          // Only announce ourselves back the FIRST time we see a given clientId. Without this
          // guard, every join (including our own reciprocal announce) would trigger every other
          // peer to announce again, bouncing presence-join messages back and forth forever between
          // any two connected clients. Re-sends of presence-join (our heartbeat) from an
          // already-known peer just refresh their last-seen time, below.
          const isNewPeer = !seenClientIdsRef.current.has(message.clientId)
          seenClientIdsRef.current.add(message.clientId)
          setCollaborators((current) => [
            ...current.filter((c) => c.clientId !== message.clientId),
            { clientId: message.clientId, name: message.name, color: message.color },
          ])
          if (isNewPeer) {
            send({ type: 'presence-join', clientId: clientIdRef.current, name: nameRef.current, color: colorRef.current })
          }
        } else if (message.type === 'presence-leave') {
          seenClientIdsRef.current.delete(message.clientId)
          lastSeenAtRef.current.delete(message.clientId)
          setCollaborators((current) => current.filter((c) => c.clientId !== message.clientId))
          setRemoteCursors((current) => {
            const next = { ...current }
            delete next[message.clientId]
            return next
          })
        } else if (message.type === 'cursor') {
          setRemoteCursors((current) => ({
            ...current,
            [message.clientId]: { clientId: message.clientId, name: message.name, color: message.color, x: message.x, y: message.y },
          }))
        }
      })
      client.subscribe('/user/queue/collaboration-conflicts', (msg: IMessage) => {
        let message: LiveMessage
        try {
          message = JSON.parse(msg.body)
        } catch {
          return
        }
        if (message.type !== 'conflict' || message.clientId !== clientIdRef.current) return
        const base = baseGraphRef.current ?? localGraphRef.current ?? message.payload
        const local = localGraphRef.current ?? message.payload
        const result = mergeGraphs(base, local, message.payload)
        serverRevisionRef.current = message.revision
        setRevision(message.revision)
        baseGraphRef.current = message.payload
        if (pendingConflictRef.current) {
          const refreshedConflict = {
            revision: message.revision,
            payload: message.payload,
            conflicts: [...new Set([...pendingConflictRef.current.conflicts, ...message.conflicts, ...result.conflicts])],
            localDraft: result.graph,
          }
          pendingConflictRef.current = refreshedConflict
          setConflict(refreshedConflict)
          if (graphDebounceRef.current) window.clearTimeout(graphDebounceRef.current)
          return
        }
        if (result.conflicts.length === 0) {
          localGraphRef.current = result.graph
          if (stableStringify(result.graph) === stableStringify(message.payload)) {
            lastSentGraphJsonRef.current = stableStringify(result.graph)
          } else {
            onRemoteGraphRef.current?.(result.graph)
            lastSentGraphJsonRef.current = ''
            sendGraph(result.graph)
          }
          return
        }
        const conflictState = {
          revision: message.revision,
          payload: message.payload,
          conflicts: [...new Set([...message.conflicts, ...result.conflicts])],
          localDraft: result.graph,
        }
        pendingConflictRef.current = conflictState
        setConflict(conflictState)
        if (graphDebounceRef.current) window.clearTimeout(graphDebounceRef.current)
      })
      send({ type: 'presence-join', clientId: clientIdRef.current, name: nameRef.current, color: colorRef.current, initial: true })
      if (canEditRef.current && localGraphRef.current) sendGraph(localGraphRef.current, true)
    }

    client.onWebSocketClose = () => setConnected(false)
    client.activate()
    stompRef.current = client

    // Heartbeat: re-send our own presence-join periodically so peers can tell we're still
    // here (see isNewPeer guard above — a known peer's heartbeat never triggers a re-announce
    // storm). This is what lets a peer purge us if we vanish without a clean unmount (tab
    // crash, force-quit, network drop) instead of showing us as "viewing" forever.
    const heartbeatId = window.setInterval(() => {
      send({ type: 'presence-join', clientId: clientIdRef.current, name: nameRef.current, color: colorRef.current })
    }, HEARTBEAT_INTERVAL_MS)

    const staleCheckId = window.setInterval(() => {
      const now = Date.now()
      const stale = [...lastSeenAtRef.current.entries()]
        .filter(([, lastSeen]) => now - lastSeen > STALE_AFTER_MS)
        .map(([id]) => id)
      if (stale.length === 0) return
      stale.forEach((id) => {
        seenClientIdsRef.current.delete(id)
        lastSeenAtRef.current.delete(id)
      })
      setCollaborators((current) => current.filter((c) => !stale.includes(c.clientId)))
      setRemoteCursors((current) => {
        const next = { ...current }
        stale.forEach((id) => delete next[id])
        return next
      })
    }, HEARTBEAT_INTERVAL_MS)

    return () => {
      window.clearInterval(heartbeatId)
      window.clearInterval(staleCheckId)
      send({ type: 'presence-leave', clientId })
      client.deactivate()
      stompRef.current = null
      setConnected(false)
      setCollaborators([])
      setRemoteCursors({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const broadcastGraph = useCallback((payload: GraphPayload) => {
    localGraphRef.current = payload
    if (!baseGraphRef.current) baseGraphRef.current = payload
    if (pendingConflictRef.current) return
    const json = stableStringify(payload)
    if (json === lastSentGraphJsonRef.current) return
    if (graphDebounceRef.current) window.clearTimeout(graphDebounceRef.current)
    graphDebounceRef.current = window.setTimeout(() => {
      sendGraph(payload)
    }, GRAPH_BROADCAST_DEBOUNCE_MS)
  }, [sendGraph])

  const resolveConflict = useCallback((resolution: 'shared' | 'local') => {
    const current = pendingConflictRef.current
    if (!current) return
    pendingConflictRef.current = null
    setConflict(null)
    baseGraphRef.current = current.payload
    serverRevisionRef.current = current.revision
    setRevision(current.revision)
    if (resolution === 'shared') {
      localGraphRef.current = current.payload
      lastSentGraphJsonRef.current = stableStringify(current.payload)
      onRemoteGraphRef.current?.(current.payload)
      return
    }

    const merged = current.localDraft
    localGraphRef.current = merged
    lastSentGraphJsonRef.current = ''
    onRemoteGraphRef.current?.(merged)
    sendGraph(merged)
  }, [sendGraph])

  const applySavedGraph = useCallback((payload: GraphPayload, nextRevision: number) => {
    if (nextRevision <= serverRevisionRef.current) return
    const base = baseGraphRef.current ?? localGraphRef.current ?? payload
    const local = localGraphRef.current ?? payload
    const result = mergeGraphs(base, local, payload)
    serverRevisionRef.current = nextRevision
    setRevision(nextRevision)
    baseGraphRef.current = payload
    if (result.conflicts.length > 0 || pendingConflictRef.current) {
      const conflictState = {
        revision: nextRevision,
        payload,
        conflicts: [...new Set([...(pendingConflictRef.current?.conflicts ?? []), ...result.conflicts])],
        localDraft: result.graph,
      }
      pendingConflictRef.current = conflictState
      setConflict(conflictState)
      if (graphDebounceRef.current) window.clearTimeout(graphDebounceRef.current)
      return
    }
    localGraphRef.current = result.graph
    if (stableStringify(result.graph) !== stableStringify(local)) onRemoteGraphRef.current?.(result.graph)
    if (stableStringify(result.graph) === stableStringify(payload)) lastSentGraphJsonRef.current = stableStringify(result.graph)
    else sendGraph(result.graph)
  }, [sendGraph])

  const broadcastCursor = useCallback((x: number, y: number) => {
    const now = Date.now()
    if (now - cursorThrottleRef.current < CURSOR_BROADCAST_THROTTLE_MS) return
    cursorThrottleRef.current = now
    send({ type: 'cursor', clientId: clientIdRef.current, name: nameRef.current, color: colorRef.current, x, y })
  }, [send])

  const onRemoteGraph = useCallback((callback: (payload: GraphPayload) => void) => {
    onRemoteGraphRef.current = callback
  }, [])

  return {
    connected,
    revision,
    collaborators,
    remoteCursors: Object.values(remoteCursors),
    conflict,
    resolveConflict,
    applySavedGraph,
    myClientId: clientIdRef.current,
    myColor: colorRef.current,
    broadcastGraph,
    broadcastCursor,
    onRemoteGraph,
  }
}
