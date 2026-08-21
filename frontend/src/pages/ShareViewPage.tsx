import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReactFlow, { Background, Controls, type Edge, type Node } from 'reactflow'
import 'reactflow/dist/style.css'
import ArchNode, { type ArchNodeData } from '../components/ArchNode'
import { getPublicProject, type ProjectDetail } from '../lib/projects'
import logo from '../assets/logo.png'

const nodeTypes = { archNode: ArchNode }

export default function ShareViewPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getPublicProject(id)
      .then(setProject)
      .catch(() => setError('This project doesn\'t exist or is no longer shared.'))
  }, [id])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#fafafa] text-center">
        <p className="text-sm text-zinc-500">{error}</p>
        <Link to="/" className="text-sm font-medium text-violet-600 hover:text-violet-800">
          ← Back to SysFlow
        </Link>
      </div>
    )
  }

  if (!project) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-zinc-400">Loading…</div>
  }

  const nodes: Node<ArchNodeData>[] = project.graphJson.nodes.map((n) => ({
    id: n.id,
    type: 'archNode',
    position: n.position ?? { x: 0, y: 0 },
    data: { componentType: n.type, label: n.label ?? n.type, config: n.config, health: 'idle' },
    draggable: false,
    selectable: false,
  }))
  const edges: Edge[] = project.graphJson.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))

  return (
    <div className="flex h-screen flex-col bg-[#fafafa]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="SysFlow" className="h-8 w-8 object-contain" />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold text-zinc-900">{project.name}</span>
            <span className="text-[11px] text-zinc-400">Shared from SysFlow · read-only</span>
          </div>
        </Link>
        <Link to="/app" className="btn-dark rounded-lg px-4 py-2 text-sm font-medium">
          Open your own editor →
        </Link>
      </header>
      <div className="flex-1">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}>
          <Background gap={22} color="#e4e4e7" />
          <Controls showInteractive={false} className="!shadow-md [&>button]:!border-zinc-200 [&>button]:!bg-white" />
        </ReactFlow>
      </div>
    </div>
  )
}
