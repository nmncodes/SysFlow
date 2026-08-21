import { useCallback, useEffect, useRef, useState } from 'react'
import { Client, type IMessage } from '@stomp/stompjs'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'
const GRAPH_BROADCAST_DEBOUNCE_MS = 400
const CURSOR_BROADCAST_THROTTLE_MS = 80

const CURSOR_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

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

type LiveMessage =
  | { type: 'presence-join'; clientId: string; name: string; color: string }
  | { type: 'presence-leave'; clientId: string }
  | { type: 'cursor'; clientId: string; name: string; color: string; x: number; y: number }
  | { type: 'graph'; clientId: string; updatedAt: number; payload: GraphPayload }

function wsUrl(): string {
  const httpBase = API_BASE.replace(/\/api\/?$/, '')
  return httpBase.replace(/^http/, 'ws') + '/ws'
}

function colorFor(clientId: string): string {
  let hash = 0
  for (let i = 0; i < clientId.length; i++) hash = (hash * 31 + clientId.charCodeAt(i)) | 0
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

/**
 * Whole-document last-write-wins live collaboration: every meaningful local edit
 * (debounced) broadcasts the entire graph snapshot with a timestamp; every client only
 * applies an incoming snapshot if it's newer than the last one it applied. This is
 * deliberately simpler than per-node merging — see backend LiveUpdateController's javadoc
 * for why that trade-off was chosen. Only active for saved projects (projectId set); an
 * unsaved local session has no shared room to join.
 */
export function useCollabSession(projectId: string | null, displayName: string | null) {
  const [connected, setConnected] = useState(false)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({})

  const clientIdRef = useRef<string>(crypto.randomUUID())
  const nameRef = useRef<string>(displayName?.trim() || 'Guest')
  const colorRef = useRef<string>(colorFor(clientIdRef.current))
  const stompRef = useRef<Client | null>(null)
  const graphDebounceRef = useRef<number | null>(null)
  const lastSentGraphJsonRef = useRef<string>('')
  const cursorThrottleRef = useRef<number>(0)
  const lastAppliedGraphAtRef = useRef<number>(0)
  const onRemoteGraphRef = useRef<((payload: GraphPayload) => void) | null>(null)

  useEffect(() => {
    nameRef.current = displayName?.trim() || 'Guest'
  }, [displayName])

  const send = useCallback((message: LiveMessage) => {
    const client = stompRef.current
    if (!client?.connected || !projectId) return
    client.publish({ destination: `/app/project/${projectId}/broadcast`, body: JSON.stringify(message) })
  }, [projectId])

  useEffect(() => {
    if (!projectId) {
      setConnected(false)
      setCollaborators([])
      setRemoteCursors({})
      return
    }

    const client = new Client({
      brokerURL: wsUrl(),
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    })

    client.onConnect = () => {
      setConnected(true)
      client.subscribe(`/topic/project/${projectId}`, (msg: IMessage) => {
        let message: LiveMessage
        try {
          message = JSON.parse(msg.body)
        } catch {
          return
        }
        if (message.clientId === clientIdRef.current) return

        if (message.type === 'presence-join') {
          setCollaborators((current) => [
            ...current.filter((c) => c.clientId !== message.clientId),
            { clientId: message.clientId, name: message.name, color: message.color },
          ])
          // Announce ourselves back so a newcomer sees everyone already in the room.
          send({ type: 'presence-join', clientId: clientIdRef.current, name: nameRef.current, color: colorRef.current })
        } else if (message.type === 'presence-leave') {
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
        } else if (message.type === 'graph') {
          if (message.updatedAt > lastAppliedGraphAtRef.current) {
            lastAppliedGraphAtRef.current = message.updatedAt
            onRemoteGraphRef.current?.(message.payload)
          }
        }
      })
      send({ type: 'presence-join', clientId: clientIdRef.current, name: nameRef.current, color: colorRef.current })
    }

    client.onWebSocketClose = () => setConnected(false)
    client.activate()
    stompRef.current = client

    return () => {
      send({ type: 'presence-leave', clientId: clientIdRef.current })
      client.deactivate()
      stompRef.current = null
      setConnected(false)
      setCollaborators([])
      setRemoteCursors({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const broadcastGraph = useCallback((payload: GraphPayload) => {
    // Content-deduped so a caller that re-triggers on every render (e.g. simulation ticks
    // touching unrelated node.data fields) never actually sends a redundant snapshot,
    // regardless of how often this is called.
    const json = JSON.stringify(payload)
    if (json === lastSentGraphJsonRef.current) return
    if (graphDebounceRef.current) window.clearTimeout(graphDebounceRef.current)
    graphDebounceRef.current = window.setTimeout(() => {
      lastSentGraphJsonRef.current = json
      const updatedAt = Date.now()
      lastAppliedGraphAtRef.current = updatedAt
      send({ type: 'graph', clientId: clientIdRef.current, updatedAt, payload })
    }, GRAPH_BROADCAST_DEBOUNCE_MS)
  }, [send])

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
    collaborators,
    remoteCursors: Object.values(remoteCursors),
    myClientId: clientIdRef.current,
    myColor: colorRef.current,
    broadcastGraph,
    broadcastCursor,
    onRemoteGraph,
  }
}
