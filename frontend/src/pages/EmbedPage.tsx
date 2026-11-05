import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ReactFlow, { Background, type Edge, type Node } from 'reactflow'
import 'reactflow/dist/style.css'
import ArchNode, { type ArchNodeData } from '../components/ArchNode'
import ArchEdge from '../components/ArchEdge'
import { getSharedProject, type ProjectDetail } from '../lib/projects'

const nodeTypes = { archNode: ArchNode }
const edgeTypes = { archEdge: ArchEdge }

export default function EmbedPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    getSharedProject(id).then(setProject).catch(() => setError(true))
  }, [id])

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fafafa] dark:bg-zinc-900 text-sm text-zinc-400 dark:text-zinc-500">
        Architecture not found
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fafafa] dark:bg-zinc-900">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-violet-500" />
      </div>
    )
  }

  const nodes: Node<ArchNodeData>[] = project.graphJson.nodes.map((n) => ({
    id: n.id,
    type: 'archNode',
    position: n.position ?? { x: 0, y: 0 },
    data: { componentType: n.type, label: n.label ?? n.type, config: n.config, health: 'idle' as const },
    draggable: false,
    selectable: false,
  }))
  const edges: Edge[] = project.graphJson.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'archEdge',
  }))

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  return (
    <div className="relative h-screen w-screen bg-[#fafafa] dark:bg-zinc-900">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} color={isDark ? '#3f3f46' : '#e4e4e7'} />
      </ReactFlow>
      <a
        href={`${window.location.origin}/share/${id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-lg bg-white/90 dark:bg-zinc-800/90 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 shadow-sm backdrop-blur-sm hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
      >
        Built with SysFlow
      </a>
    </div>
  )
}
