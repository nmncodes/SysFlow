import { useCallback, useEffect, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type OnConnectStart,
  type OnEdgesChange,
  type OnNodesChange,
  type ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'
import ArchNode, { type ArchNodeData } from './ArchNode'
import ArchEdge, { type ArchEdgeData } from './ArchEdge'
import ArchitectureOverview from './ArchitectureOverview'
import Palette from './Palette'
import ConfigPanel from './ConfigPanel'
import ContextMenu, { type ContextMenuState } from './ContextMenu'
import { COMPONENT_LIBRARY, deriveHealth } from './nodes'
import type { InjectedFailure, Tick } from '../lib/api'
import { makeEdgeFailure, makeNodeFailure } from '../lib/failures'

const nodeTypes = { archNode: ArchNode }
const edgeTypes = { archEdge: ArchEdge }
const SNAP_GRID: [number, number] = [20, 20]

let idCounter = 1
const nextId = () => `node_${idCounter++}`

interface Props {
  nodes: Node<ArchNodeData>[]
  edges: Edge[]
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  setNodes: React.Dispatch<React.SetStateAction<Node<ArchNodeData>[]>>
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
  currentTick: Tick | null
  isPlaying: boolean
  failures: InjectedFailure[]
  setFailures: React.Dispatch<React.SetStateAction<InjectedFailure[]>>
  focusRequest?: { nodeId: string; token: number } | null
  exportRequest?: number
  onSelectionChange?: (nodeId: string | null) => void
  onDirty?: () => void
  hideSidebar?: boolean
}

export default function Canvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  setNodes,
  setEdges,
  currentTick,
  isPlaying,
  failures,
  setFailures,
  focusRequest,
  exportRequest,
  onSelectionChange,
  onDirty,
  hideSidebar = false,
}: Props) {
  const [selectedNodeId, setSelectedNodeIdState] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null)
  const [isDraggingNode, setIsDraggingNode] = useState(false)
  const [spacePressed, setSpacePressed] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const setSelectedNodeId = (id: string | null) => {
    setSelectedNodeIdState(id)
    if (id) setSelectedEdgeId(null)
    onSelectionChange?.(id)
  }

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)) {
        event.preventDefault()
        setSpacePressed(true)
      }
    }
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpacePressed(false)
      if (event.key === 'Escape') setConnectingFromId(null)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) return
      if (edges.some((edge) => edge.source === connection.source && edge.target === connection.target)) return
      setEdges((eds) => addEdge({ ...connection, type: 'archEdge' }, eds))
      onDirty?.()
      setConnectingFromId(null)
    },
    [edges, setEdges, onDirty],
  )

  const onConnectStart: OnConnectStart = useCallback((_, params) => {
    setConnectingFromId(params.nodeId ?? null)
    setSelectedEdgeId(null)
  }, [])

  const onConnectEnd = useCallback(() => setConnectingFromId(null), [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const componentType = event.dataTransfer.getData('application/archflow-node')
      if (!componentType || !rfInstance || !wrapperRef.current) return
      const bounds = wrapperRef.current.getBoundingClientRect()
      const raw = rfInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })
      const position = {
        x: Math.round(raw.x / SNAP_GRID[0]) * SNAP_GRID[0],
        y: Math.round(raw.y / SNAP_GRID[1]) * SNAP_GRID[1],
      }
      const def = COMPONENT_LIBRARY.find((c) => c.type === componentType)
      const id = nextId()
      const newNode: Node<ArchNodeData> = {
        id,
        type: 'archNode',
        position,
        data: {
          componentType,
          label: def?.label ?? componentType,
          config: { ...(def?.defaultConfig ?? {}) },
          health: 'idle',
        },
      }
      setNodes((nds) => nds.concat(newNode))
      onDirty?.()
      setSelectedNodeId(id)
      setIsDraggingNode(false)
    },
    [rfInstance, setNodes, onDirty],
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setIsDraggingNode(true)
  }, [])

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null

  const handleConfigChange = (nodeId: string, config: Record<string, unknown>) => {
    const { __label, ...rest } = config
    onDirty?.()
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                label: typeof __label === 'string' ? __label : n.data.label,
                config: rest,
              },
            }
          : n,
      ),
    )
  }

  const handleDelete = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    onDirty?.()
    setFailures((fs) => fs.filter((f) => f.nodeId !== nodeId))
    setSelectedNodeId(null)
  }

  const duplicateNode = (nodeId: string) => {
    const source = nodes.find((n) => n.id === nodeId)
    if (!source) return
    const id = nextId()
    const copy: Node<ArchNodeData> = {
      ...source,
      id,
      position: { x: source.position.x + SNAP_GRID[0] * 2, y: source.position.y + SNAP_GRID[1] * 2 },
      selected: false,
      data: { ...source.data, health: 'idle', hasFailure: false },
    }
    setNodes((nds) => nds.concat(copy))
    onDirty?.()
    setSelectedNodeId(id)
  }

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const stats = currentTick?.nodes[n.id]
        const health = stats ? deriveHealth(stats.loadPct, stats.errorRatePct, stats.down) : 'idle'
        const outgoing = edges.filter((edge) => edge.source === n.id)
        const rps = outgoing.reduce((sum, edge) => sum + ((currentTick?.edges[edge.id]?.inFlight ?? 0) * 10), 0)
        return {
          ...n,
          data: {
            ...n.data,
            health,
            replicas: stats?.replicas ?? n.data.replicas,
            metrics: stats
              ? { cpu: stats.loadPct, latency: stats.avgLatencyMs, rps }
              : n.data.metrics,
          },
        }
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTick])

  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => {
        const stats = currentTick?.edges[e.id]
        return {
          ...e,
          type: 'archEdge',
          data: {
            inFlight: stats?.inFlight ?? 0,
            avgLatencyMs: stats?.avgLatencyMs ?? 0,
            active: isPlaying && !!stats && stats.inFlight > 0.01,
            hasFailure: failures.some((f) => f.edgeId === e.id),
            selected: selectedEdgeId === e.id,
            onSelect: () => {
              setSelectedEdgeId(e.id)
              setSelectedNodeId(null)
            },
          } satisfies ArchEdgeData,
        }
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTick, isPlaying, failures, selectedEdgeId])

  useEffect(() => {
    if (!focusRequest || !rfInstance) return
    const node = nodes.find((n) => n.id === focusRequest.nodeId)
    if (!node) return
    const width = node.width ?? 156
    const height = node.height ?? 130
    rfInstance.setCenter(node.position.x + width / 2, node.position.y + height / 2, { zoom: 1.1, duration: 500 })
    setSelectedNodeId(node.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest])

  useEffect(() => {
    if (!exportRequest || !wrapperRef.current) return
    const el = wrapperRef.current
    import('html-to-image').then(({ toPng }) => {
      toPng(el, { backgroundColor: '#f8fcfd', pixelRatio: 2 }).then((dataUrl) => {
        const link = document.createElement('a')
        link.download = 'sysflow-architecture.png'
        link.href = dataUrl
        link.click()
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportRequest])

  const applyNodeFailure = (nodeId: string, type: 'kill' | 'latency' | 'throttle') => {
    setFailures((fs) => [...fs.filter((f) => f.nodeId !== nodeId), makeNodeFailure(nodeId, type)])
    setContextMenu(null)
  }

  const applyEdgeFailure = (edgeId: string) => {
    setFailures((fs) => [...fs.filter((f) => f.edgeId !== edgeId), makeEdgeFailure(edgeId)])
    setContextMenu(null)
  }

  const clearFailure = () => {
    if (!contextMenu) return
    setFailures((fs) =>
      contextMenu.targetType === 'node'
        ? fs.filter((f) => f.nodeId !== contextMenu.targetId)
        : fs.filter((f) => f.edgeId !== contextMenu.targetId),
    )
    setContextMenu(null)
  }

  const renderedNodes = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      hasFailure: failures.some((f) => f.nodeId === n.id),
      connectionTarget: !!connectingFromId && connectingFromId !== n.id,
      connectionSource: connectingFromId === n.id,
      onConfigure: () => setSelectedNodeId(n.id),
      onDuplicate: () => duplicateNode(n.id),
      onDelete: () => handleDelete(n.id),
    },
  }))

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      <div
        ref={wrapperRef}
        className={`editor-canvas relative min-w-0 flex-1 ${isDraggingNode ? 'editor-canvas-drop-active' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setIsDraggingNode(false)}
      >
        <ReactFlow
          nodes={renderedNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          isValidConnection={(connection) =>
            !!connection.source && !!connection.target && connection.source !== connection.target &&
            !edges.some((edge) => edge.source === connection.source && edge.target === connection.target)
          }
          onInit={setRfInstance}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onEdgeClick={(_, edge) => {
            setSelectedEdgeId(edge.id)
            setSelectedNodeId(null)
          }}
          onPaneClick={() => {
            setSelectedNodeId(null)
            setSelectedEdgeId(null)
            setContextMenu(null)
          }}
          onNodeContextMenu={(e, node) => {
            e.preventDefault()
            setContextMenu({ x: e.clientX, y: e.clientY, targetType: 'node', targetId: node.id })
          }}
          onEdgeContextMenu={(e, edge) => {
            e.preventDefault()
            setContextMenu({ x: e.clientX, y: e.clientY, targetType: 'edge', targetId: edge.id })
          }}
          snapToGrid
          snapGrid={SNAP_GRID}
          panOnDrag={spacePressed}
          selectionOnDrag={false}
          fitView
          fitViewOptions={{ padding: 0.22, minZoom: 0.55, maxZoom: 1.1 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#d9edf1" />
          <Controls className="sysflow-controls !shadow-md [&>button]:!border-zinc-200 [&>button]:!bg-white" />
          <ArchitectureOverview nodes={nodes} edges={edges} />
        </ReactFlow>

        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="empty-state-card w-full max-w-md rounded-2xl border border-zinc-200 bg-white/95 p-6 text-center shadow-xl backdrop-blur-sm">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5v14" />
                </svg>
              </div>
              <p className="text-base font-semibold text-zinc-900">Start building your architecture</p>
              <p className="mt-1 text-xs text-zinc-500">Drag components from the library and connect them to model request flow.</p>
              <div className="mt-5 flex items-center justify-center gap-2 text-[10px] font-semibold text-zinc-600">
                {['Client', 'Load Balancer', 'Service', 'Database'].map((label, index) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2">{label}</span>
                    {index < 3 && <span className="text-cyan-400">→</span>}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[10px] text-zinc-400">Tip: hold Space + drag to pan · nodes snap to grid automatically</p>
            </div>
          </div>
        )}

        {connectingFromId && (
          <div className="connection-guide pointer-events-none absolute left-1/2 top-5 z-20 -translate-x-1/2 rounded-xl border border-cyan-100 bg-white/95 px-4 py-2 text-xs font-medium text-cyan-700 shadow-lg backdrop-blur-sm">
            Connect to a highlighted node · Esc to cancel
          </div>
        )}

        {selectedEdge && (
          <div className="absolute bottom-5 left-5 z-20 w-72 rounded-2xl border border-zinc-200 bg-white/95 p-4 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Connection metrics</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{selectedEdge.source} → {selectedEdge.target}</p>
              </div>
              <button onClick={() => setSelectedEdgeId(null)} className="text-zinc-400 hover:text-zinc-700">✕</button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-zinc-50 p-2"><b className="block text-sm text-zinc-800">{Math.round((selectedEdge.data as ArchEdgeData | undefined)?.inFlight ?? 0)}</b><span className="text-[9px] text-zinc-400">Requests</span></div>
              <div className="rounded-xl bg-zinc-50 p-2"><b className="block text-sm text-zinc-800">{Math.round((selectedEdge.data as ArchEdgeData | undefined)?.avgLatencyMs ?? 0)}ms</b><span className="text-[9px] text-zinc-400">Latency</span></div>
              <div className="rounded-xl bg-zinc-50 p-2"><b className="block text-sm text-zinc-800">{Math.round(((selectedEdge.data as ArchEdgeData | undefined)?.inFlight ?? 0) * 10)}</b><span className="text-[9px] text-zinc-400">RPS</span></div>
            </div>
          </div>
        )}
      </div>

      {!hideSidebar && selectedNode ? (
        <ConfigPanel
          node={selectedNode}
          onChange={handleConfigChange}
          onDelete={handleDelete}
          onClose={() => setSelectedNodeId(null)}
        />
      ) : !hideSidebar ? (
        <Palette />
      ) : null}

      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          hasFailure={failures.some((f) =>
            contextMenu.targetType === 'node' ? f.nodeId === contextMenu.targetId : f.edgeId === contextMenu.targetId,
          )}
          onKill={() => applyNodeFailure(contextMenu.targetId, 'kill')}
          onLatency={() => applyNodeFailure(contextMenu.targetId, 'latency')}
          onThrottle={() => applyNodeFailure(contextMenu.targetId, 'throttle')}
          onDropPackets={() => applyEdgeFailure(contextMenu.targetId)}
          onClear={clearFailure}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}