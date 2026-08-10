import { useCallback, useEffect, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
  type ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'
import ArchNode, { type ArchNodeData } from './ArchNode'
import ArchEdge from './ArchEdge'
import Palette from './Palette'
import ConfigPanel from './ConfigPanel'
import ContextMenu, { type ContextMenuState } from './ContextMenu'
import { COMPONENT_LIBRARY, deriveHealth } from './nodes'
import type { InjectedFailure, Tick } from '../lib/api'
import { makeEdgeFailure, makeNodeFailure } from '../lib/failures'

const nodeTypes = { archNode: ArchNode }
const edgeTypes = { archEdge: ArchEdge }

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
}: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, type: 'archEdge' }, eds)),
    [setEdges],
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const componentType = event.dataTransfer.getData('application/archflow-node')
      if (!componentType || !rfInstance || !wrapperRef.current) return
      const bounds = wrapperRef.current.getBoundingClientRect()
      const position = rfInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })
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
    },
    [rfInstance, setNodes],
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null

  const handleConfigChange = (nodeId: string, config: Record<string, unknown>) => {
    const { __label, ...rest } = config
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
    setFailures((fs) => fs.filter((f) => f.nodeId !== nodeId))
    setSelectedNodeId(null)
  }

  // Drive node health from the current simulation tick.
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const stats = currentTick?.nodes[n.id]
        const health = stats ? deriveHealth(stats.loadPct, stats.errorRatePct, stats.down) : 'idle'
        return n.data.health === health ? n : { ...n, data: { ...n.data, health } }
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
          },
        }
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTick, isPlaying, failures])

  useEffect(() => {
    if (!focusRequest || !rfInstance) return
    const node = nodes.find((n) => n.id === focusRequest.nodeId)
    if (!node) return
    const width = node.width ?? 140
    const height = node.height ?? 90
    rfInstance.setCenter(node.position.x + width / 2, node.position.y + height / 2, { zoom: 1.1, duration: 500 })
    setSelectedNodeId(node.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest])

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

  return (
    <div className="flex h-full min-h-0 flex-1">
      {selectedNode && (
        <ConfigPanel
          node={selectedNode}
          onChange={handleConfigChange}
          onDelete={handleDelete}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
      <div ref={wrapperRef} className="relative min-w-0 flex-1" onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes.map((n) => ({
            ...n,
            data: { ...n.data, hasFailure: failures.some((f) => f.nodeId === n.id) },
          }))}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => {
            setSelectedNodeId(null)
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
          fitView
        >
          <Background gap={22} color="#e4e4e7" />
          <Controls className="!shadow-md [&>button]:!border-zinc-200 [&>button]:!bg-white" />
          {nodes.length > 0 && <MiniMap pannable zoomable className="!bg-white !shadow-md" />}
        </ReactFlow>
        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="empty-canvas-hint flex flex-col items-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-zinc-300 text-zinc-300">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-400">Drag a component here to start</p>
              <p className="text-xs text-zinc-300">Try Client → Load Balancer → Service → Database</p>
            </div>
          </div>
        )}
      </div>
      <Palette />
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
