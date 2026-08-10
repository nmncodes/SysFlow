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
import { COMPONENT_LIBRARY, deriveHealth } from './nodes'
import type { Tick } from '../lib/api'

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
}

export default function Canvas({ nodes, edges, onNodesChange, onEdgesChange, setNodes, setEdges, currentTick, isPlaying }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
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
    setSelectedNodeId(null)
  }

  // Drive node health from the current simulation tick.
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const stats = currentTick?.nodes[n.id]
        const health = stats ? deriveHealth(stats.loadPct, stats.errorRatePct, stats.down) : 'idle'
        const replicas = stats?.replicas
        return n.data.health === health && n.data.replicas === replicas ? n : { ...n, data: { ...n.data, health, replicas } }
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
          },
        }
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTick, isPlaying])

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
      <div ref={wrapperRef} className="min-w-0 flex-1" onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          fitView
        >
          <Background gap={22} color="#e4e4e7" />
          <Controls className="!shadow-md [&>button]:!border-zinc-200 [&>button]:!bg-white" />
          <MiniMap pannable zoomable className="!bg-white !shadow-md" />
        </ReactFlow>
      </div>
      <Palette />
    </div>
  )
}
