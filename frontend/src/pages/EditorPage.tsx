import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useEdgesState, useNodesState, type Edge } from 'reactflow'
import Canvas from '../components/Canvas'
import type { ArchNodeData } from '../components/ArchNode'
import { useSimulation } from '../lib/useSimulation'

export default function EditorPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<ArchNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [targetRps, setTargetRps] = useState(100)
  const sim = useSimulation()

  const hasClient = nodes.some((n) => n.data.componentType === 'client')
  const canRun = nodes.length > 0 && hasClient && !sim.isRunning

  const handleRun = () => {
    if (sim.result) {
      sim.resume()
      return
    }
    sim.run(nodes, edges, targetRps, 3)
  }

  return (
    <div className="flex h-screen flex-col bg-[#fafafa] text-zinc-900">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white/80 px-6 backdrop-blur-sm">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow-sm">
            S
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight text-zinc-900">SysFlow</span>
            <span className="text-xs text-zinc-400">Untitled Project</span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-500">
            Target RPS
            <input
              type="number"
              min={1}
              value={targetRps}
              onChange={(e) => setTargetRps(Math.max(1, Number(e.target.value)))}
              className="w-20 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
            />
          </label>
          <button className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50">
            Save
          </button>
        </div>
      </header>

      <Canvas
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        setNodes={setNodes}
        setEdges={setEdges}
        currentTick={sim.currentTick}
        isPlaying={sim.isPlaying}
      />

      <footer className="flex h-16 shrink-0 items-center justify-between border-t border-zinc-200 bg-white/80 px-6 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={!canRun}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm ring-1 ring-emerald-100 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span>▶</span> {sim.isRunning ? 'Running…' : 'Run'}
          </button>
          <button
            onClick={sim.pause}
            disabled={!sim.isPlaying}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-500 shadow-sm transition hover:border-zinc-300 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ⏸ Pause
          </button>
          <button
            onClick={sim.reset}
            disabled={!sim.result}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-500 shadow-sm transition hover:border-zinc-300 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ⟲ Reset
          </button>
          {sim.error && <span className="text-xs text-red-500">{sim.error}</span>}
          {sim.result && (
            <span className="ml-2 text-xs text-zinc-400">
              {sim.result.summary.avgRps} rps · {sim.result.summary.avgErrorRatePct}% errors
              {sim.result.summary.singlePointsOfFailure.length > 0 && (
                <span className="ml-2 text-amber-600">
                  ⚠ SPOF: {sim.result.summary.singlePointsOfFailure.join(', ')}
                </span>
              )}
            </span>
          )}
        </div>
        <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90">
          <span>✨</span> Analyze
        </button>
      </footer>
    </div>
  )
}
