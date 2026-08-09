import { useCallback, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'
import ArchNode, { type ArchNodeData } from './ArchNode'
import Palette from './Palette'
import ConfigPanel from './ConfigPanel'
import { COMPONENT_LIBRARY } from './nodes'

const nodeTypes = { archNode: ArchNode }

let idCounter = 1
const nextId = () => `node_${idCounter++}`

export default function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<ArchNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: false }, eds)),
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
        data: { componentType, label: def?.label ?? componentType, health: 'idle' },
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
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                label: typeof config.__label === 'string' ? config.__label : n.data.label,
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

  return (
    <div className="flex h-full min-h-0 flex-1">
      <Palette />
      <div ref={wrapperRef} className="min-w-0 flex-1" onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          fitView
          colorMode="dark"
        >
          <Background gap={20} color="#2e303a" />
          <Controls />
          <MiniMap pannable zoomable className="!bg-[#191b22]" />
        </ReactFlow>
      </div>
      {selectedNode && (
        <ConfigPanel
          node={selectedNode}
          onChange={handleConfigChange}
          onDelete={handleDelete}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  )
}
