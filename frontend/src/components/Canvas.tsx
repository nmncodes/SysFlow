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
import type { RemoteCursor } from '../lib/collab'
import { exportBrandedImage } from '../lib/brandedExport'

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
  onCompareNode?: (nodeId: string) => void
  remoteCursors?: RemoteCursor[]
  onCursorMove?: (x: number, y: number) => void
  onCommentNode?: (nodeId: string) => void
  commentCounts?: Record<string, number>
  onLoadSample?: () => void
  onBrowseTemplates?: () => void
  onImportSrs?: () => void
  brandedExportRequest?: number
  projectName?: string
  estimatedMonthlyCost?: number
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
  onCompareNode,
  remoteCursors = [],
  onCursorMove,
  onCommentNode,
  commentCounts,
  onLoadSample,
  onBrowseTemplates,
  onImportSrs,
  brandedExportRequest,
  projectName = 'Untitled Project',
  estimatedMonthlyCost,
}: Props) {
  const [selectedNodeId, setSelectedNodeIdState] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null)
  const [isDraggingNode, setIsDraggingNode] = useState(false)
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false)
  const [spacePressed, setSpacePressed] = useState(false)
  const [viewportVersion, setViewportVersion] = useState(0)
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

  const addNodeAt = useCallback(
    (componentType: string, position: { x: number; y: number }) => {
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
      return id
    },
    [setNodes, onDirty],
  )

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
      addNodeAt(componentType, position)
      setIsDraggingNode(false)
    },
    [rfInstance, addNodeAt],
  )

  /** Tap-to-add fallback for touch devices — HTML5 drag-and-drop doesn't fire on most mobile browsers. */
  const onTapAdd = useCallback(
    (componentType: string) => {
      if (!rfInstance || !wrapperRef.current) return
      const bounds = wrapperRef.current.getBoundingClientRect()
      const raw = rfInstance.screenToFlowPosition({ x: bounds.width / 2, y: bounds.height / 2 })
      const jitter = nodes.length * 24
      const position = {
        x: Math.round((raw.x + jitter) / SNAP_GRID[0]) * SNAP_GRID[0],
        y: Math.round((raw.y + jitter) / SNAP_GRID[1]) * SNAP_GRID[1],
      }
      addNodeAt(componentType, position)
      setMobilePaletteOpen(false)
    },
    [rfInstance, addNodeAt, nodes.length],
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

  useEffect(() => {
    if (!brandedExportRequest || !wrapperRef.current) return
    const el = wrapperRef.current
    import('html-to-image').then(({ toPng }) => {
      toPng(el, { backgroundColor: '#f8fcfd', pixelRatio: 2 }).then((dataUrl) => {
        exportBrandedImage(dataUrl, { projectName, nodeCount: nodes.length, edgeCount: edges.length, estimatedMonthlyCost })
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandedExportRequest])

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
      onComment: onCommentNode ? () => onCommentNode(n.id) : undefined,
      commentCount: commentCounts?.[n.id],
    },
  }))

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      <div
        ref={wrapperRef}
        className={`editor-canvas relative min-w-0 flex-1 ${isDraggingNode ? 'editor-canvas-drop-active' : ''}`}
        data-viewport-version={viewportVersion}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setIsDraggingNode(false)}
        onMouseMove={(e) => {
          if (!onCursorMove || !rfInstance || !wrapperRef.current) return
          const bounds = wrapperRef.current.getBoundingClientRect()
          const flowPos = rfInstance.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top })
          onCursorMove(flowPos.x, flowPos.y)
        }}
      >
        <ReactFlow
          nodes={renderedNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onMove={() => setViewportVersion((v) => v + 1)}
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
          panOnDrag={spacePressed ? [0, 1, 2] : [0]}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          selectionOnDrag={false}
          fitView
          fitViewOptions={{ padding: 0.22, minZoom: 0.55, maxZoom: 1.1 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#d9edf1" className="dark:opacity-40" />
          <Controls className="sysflow-controls !shadow-md [&>button]:!border-zinc-200 [&>button]:!bg-white dark:[&>button]:!border-zinc-700 dark:[&>button]:!bg-zinc-800" />
          <ArchitectureOverview nodes={nodes} edges={edges} />
        </ReactFlow>

        {/* viewportVersion isn't read directly — bumping it on pan/zoom (via onMove above) forces this
            component to re-render, which is what makes flowToScreenPosition below stay correct. */}
        {rfInstance && remoteCursors.map((cursor) => {
          const screenPos = rfInstance.flowToScreenPosition({ x: cursor.x, y: cursor.y })
          return (
            <div
              key={cursor.clientId}
              className="pointer-events-none absolute z-30 -translate-x-1 -translate-y-1 transition-[left,top] duration-100"
              style={{ left: screenPos.x, top: screenPos.y }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={cursor.color} stroke="white" strokeWidth="1.5">
                <path d="M5 3l14 8-6 2-2 6-6-16z" />
              </svg>
              <span className="ml-3 -mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white shadow" style={{ background: cursor.color }}>
                {cursor.name}
              </span>
            </div>
          )
        })}

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="empty-state-card pointer-events-auto w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 p-6 text-center shadow-xl backdrop-blur-sm">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5v14" />
                </svg>
              </div>
              <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Start building your architecture</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Drag components from the library and connect them to model request flow.</p>
              <div className="mt-5 flex items-center justify-center gap-2 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
                {['Client', 'Load Balancer', 'Service', 'Database'].map((label, index) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-2">{label}</span>
                    {index < 3 && <span className="text-cyan-400">→</span>}
                  </div>
                ))}
              </div>
              {onLoadSample && (
                <>
                  <button
                    onClick={onLoadSample}
                    className="btn-dark mt-5 w-full rounded-xl py-2.5 text-sm font-semibold"
                  >
                    Load a sample architecture
                  </button>
                  <div className="mt-3 flex items-center justify-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
                    {onBrowseTemplates && <button onClick={onBrowseTemplates} className="font-medium text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300">Browse templates</button>}
                    {onBrowseTemplates && onImportSrs && <span className="text-zinc-300 dark:text-zinc-600">·</span>}
                    {onImportSrs && <button onClick={onImportSrs} className="font-medium text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300">Import an SRS doc</button>}
                  </div>
                </>
              )}
              <p className="mt-4 text-[10px] text-zinc-400 dark:text-zinc-500">Tip: drag or scroll to pan · nodes snap to grid automatically</p>
            </div>
          </div>
        )}

        {connectingFromId && (
          <div className="connection-guide pointer-events-none absolute left-1/2 top-5 z-20 -translate-x-1/2 rounded-xl border border-cyan-100 dark:border-cyan-900 bg-white/95 dark:bg-zinc-900/95 px-4 py-2 text-xs font-medium text-cyan-700 dark:text-cyan-400 shadow-lg backdrop-blur-sm">
            Connect to a highlighted node · Esc to cancel
          </div>
        )}

        {selectedEdge && (
          <div className="absolute bottom-5 left-5 z-20 w-72 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 p-4 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Connection metrics</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{selectedEdge.source} → {selectedEdge.target}</p>
              </div>
              <button onClick={() => setSelectedEdgeId(null)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">✕</button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800 p-2"><b className="block text-sm text-zinc-800 dark:text-zinc-100">{Math.round((selectedEdge.data as ArchEdgeData | undefined)?.inFlight ?? 0)}</b><span className="text-[9px] text-zinc-400 dark:text-zinc-500">Requests</span></div>
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800 p-2"><b className="block text-sm text-zinc-800 dark:text-zinc-100">{Math.round((selectedEdge.data as ArchEdgeData | undefined)?.avgLatencyMs ?? 0)}ms</b><span className="text-[9px] text-zinc-400 dark:text-zinc-500">Latency</span></div>
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800 p-2"><b className="block text-sm text-zinc-800 dark:text-zinc-100">{Math.round(((selectedEdge.data as ArchEdgeData | undefined)?.inFlight ?? 0) * 10)}</b><span className="text-[9px] text-zinc-400 dark:text-zinc-500">RPS</span></div>
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
        <>
          <button
            onClick={() => setMobilePaletteOpen(true)}
            aria-label="Add component"
            className="fixed bottom-24 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-100 text-2xl text-white dark:text-zinc-900 shadow-xl md:hidden"
          >
            +
          </button>
          <Palette onAdd={onTapAdd} mobileOpen={mobilePaletteOpen} onCloseMobile={() => setMobilePaletteOpen(false)} />
        </>
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
          onCompare={contextMenu.targetType === 'node' && onCompareNode ? () => { onCompareNode(contextMenu.targetId); setContextMenu(null) } : undefined}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}