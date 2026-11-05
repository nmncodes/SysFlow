import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReactFlow, { Background, Controls, type Edge, type Node } from 'reactflow'
import 'reactflow/dist/style.css'
import ArchNode, { type ArchNodeData } from '../components/ArchNode'
import ArchEdge from '../components/ArchEdge'
import { getSharedProject, type ProjectDetail } from '../lib/projects'
import { useSimulation } from '../lib/useSimulation'
import { deriveHealth } from '../components/nodes'
import logo from '../assets/logo.png'

const nodeTypes = { archNode: ArchNode }
const edgeTypes = { archEdge: ArchEdge }

export default function ShareViewPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getSharedProject(id)
      .then(setProject)
      .catch(() => setError('This project doesn\'t exist or is no longer shared.'))
  }, [id])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#fafafa] dark:bg-zinc-900 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{error}</p>
        <Link to="/" className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300">← Back to SysFlow</Link>
      </div>
    )
  }

  if (!project) {
    return <div className="flex min-h-screen items-center justify-center bg-[#fafafa] dark:bg-zinc-900 text-sm text-zinc-400 dark:text-zinc-500">Loading…</div>
  }

  return <ShareViewInner project={project} />
}

function ShareViewInner({ project }: { project: ProjectDetail }) {
  const sim = useSimulation()

  const rfNodes: Node<ArchNodeData>[] = useMemo(() => project.graphJson.nodes.map((n) => ({
    id: n.id,
    type: 'archNode',
    position: n.position ?? { x: 0, y: 0 },
    data: { componentType: n.type, label: n.label ?? n.type, config: n.config, health: 'idle' as const },
    draggable: false,
    selectable: false,
  })), [project])

  const rfEdges: Edge[] = useMemo(() => project.graphJson.edges.map((e) => ({
    id: e.id, source: e.source, target: e.target, type: 'archEdge',
  })), [project])

  const clientRps = useMemo(() => {
    const clients = project.graphJson.nodes.filter((n) => ['client', 'mobile', 'webBrowser', 'apiClient', 'customClient'].includes(n.type))
    return clients.reduce((sum, n) => sum + Number(n.config?.targetRps ?? 100), 0) || 100
  }, [project])

  const handleRun = () => sim.run(rfNodes, rfEdges, clientRps)

  const renderedNodes = useMemo(() => {
    if (!sim.currentTick) return rfNodes
    return rfNodes.map((n) => {
      const stats = sim.currentTick?.nodes[n.id]
      if (!stats) return n
      const health = deriveHealth(stats.loadPct, stats.errorRatePct, stats.down)
      const outEdges = rfEdges.filter((e) => e.source === n.id)
      const rps = outEdges.reduce((sum, e) => sum + ((sim.currentTick?.edges[e.id]?.inFlight ?? 0) * 10), 0)
      return { ...n, data: { ...n.data, health, metrics: { cpu: stats.loadPct, latency: stats.avgLatencyMs, rps } } }
    })
  }, [rfNodes, rfEdges, sim.currentTick])

  const renderedEdges = useMemo(() => {
    if (!sim.currentTick) return rfEdges
    return rfEdges.map((e) => {
      const stats = sim.currentTick?.edges[e.id]
      if (!stats) return e
      return { ...e, data: { inFlight: stats.inFlight, avgLatencyMs: stats.avgLatencyMs, active: true, hasFailure: false } }
    })
  }, [rfEdges, sim.currentTick])

  const tick = sim.currentTick?.global

  return (
    <div className="flex h-screen flex-col bg-[#fafafa] dark:bg-zinc-900">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-6">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="SysFlow" className="h-8 w-8 object-contain" />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{project.name}</span>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Shared from SysFlow · read-only</span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {sim.isRunning ? (
            <span className="text-xs text-zinc-400">Simulating…</span>
          ) : sim.isPlaying ? (
            <button onClick={sim.pause} className="rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">⏸ Pause</button>
          ) : (
            <button onClick={sim.result ? sim.resume : handleRun} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700">
              ▶ {sim.result ? 'Resume' : 'Run Simulation'}
            </button>
          )}
          {sim.result && !sim.isRunning && (
            <button onClick={sim.reset} className="rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">↺ Reset</button>
          )}
          <Link to="/app" className="btn-dark rounded-lg px-4 py-2 text-sm font-medium">Open editor →</Link>
        </div>
      </header>

      {tick && (
        <div className="flex shrink-0 items-center justify-center gap-6 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
          <span>RPS <b className="text-zinc-900 dark:text-zinc-100">{Math.round(tick.rps)}</b></span>
          <span>p95 <b className="text-zinc-900 dark:text-zinc-100">{Math.round(tick.p95)}ms</b></span>
          <span>Error <b className={tick.errorRatePct > 5 ? 'text-red-500' : 'text-zinc-900 dark:text-zinc-100'}>{tick.errorRatePct.toFixed(1)}%</b></span>
        </div>
      )}

      <div className="flex-1">
        <ReactFlow nodes={renderedNodes} edges={renderedEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}>
          <Background gap={22} color={window.matchMedia('(prefers-color-scheme: dark)').matches ? '#3f3f46' : '#e4e4e7'} />
          <Controls showInteractive={false} className="!shadow-md [&>button]:!border-zinc-200 dark:[&>button]:!border-zinc-600 [&>button]:!bg-white dark:[&>button]:!bg-zinc-700 dark:[&>button]:!fill-zinc-300" />
        </ReactFlow>
      </div>
    </div>
  )
}
