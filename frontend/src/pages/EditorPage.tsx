import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useEdgesState, useNodesState, type Edge } from 'reactflow'
import Canvas from '../components/Canvas'
import type { ArchNodeData } from '../components/ArchNode'
import { useSimulation } from '../lib/useSimulation'

const SPEED_OPTIONS = [0.5, 1, 2, 4]
const TRAFFIC_OPTIONS = [0.5, 1, 2.5, 5]

export default function EditorPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<ArchNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [baseRps, setBaseRps] = useState(100)
  const [traffic, setTraffic] = useState(1)
  const sim = useSimulation()

  const hasClient = nodes.some((n) => n.data.componentType === 'client')
  const canRun = nodes.length > 0 && hasClient && !sim.isRunning

  const handleRun = () => {
    if (sim.result) {
      sim.resume()
      return
    }
    sim.run(nodes, edges, baseRps * traffic, 3)
  }

  const global = sim.currentTick?.global

  return (
    <div className="flex h-screen flex-col bg-[#fafafa] text-zinc-900">
      <header className="relative flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white/80 px-6 backdrop-blur-sm">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow-sm">
            S
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight text-zinc-900">SysFlow</span>
            <span className="text-xs text-zinc-400">Untitled Project</span>
          </div>
        </Link>

        {sim.isPlaying && global && (
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-full bg-zinc-900 px-4 py-1.5 text-[12px] font-medium text-white shadow-md">
            <span className={global.errorRatePct >= 5 ? 'text-red-400' : 'text-emerald-400'}>
              err {global.errorRatePct.toFixed(1)}%
            </span>
            <span className="text-zinc-500">·</span>
            <span>rps {Math.round(global.rps)}</span>
            <span className="text-zinc-500">·</span>
            <span>p95 {Math.round(global.p95)}ms</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-500">
            Target RPS
            <input
              type="number"
              min={1}
              value={baseRps}
              onChange={(e) => setBaseRps(Math.max(1, Number(e.target.value)))}
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

      <footer className="flex h-16 shrink-0 items-center justify-between gap-4 border-t border-zinc-200 bg-white/80 px-6 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          {!sim.isPlaying ? (
            <button
              onClick={handleRun}
              disabled={!canRun}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm ring-1 ring-emerald-100 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>▶</span> {sim.isRunning ? 'Running…' : 'Run'}
            </button>
          ) : (
            <button
              onClick={sim.pause}
              className="flex items-center gap-1.5 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-100"
            >
              <span>■</span> Stop
            </button>
          )}
          <button
            onClick={sim.reset}
            disabled={!sim.result}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-500 shadow-sm transition hover:border-zinc-300 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ⟲ Reset
          </button>
          {sim.error && <span className="text-xs text-red-500">{sim.error}</span>}
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-500">
            Speed: {sim.speed}x
            <input
              type="range"
              min={0}
              max={SPEED_OPTIONS.length - 1}
              step={1}
              value={SPEED_OPTIONS.indexOf(sim.speed)}
              onChange={(e) => sim.setSpeed(SPEED_OPTIONS[Number(e.target.value)])}
              className="w-24 accent-violet-600"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-500">
            Traffic: {traffic}x
            <input
              type="range"
              min={0}
              max={TRAFFIC_OPTIONS.length - 1}
              step={1}
              value={TRAFFIC_OPTIONS.indexOf(traffic)}
              onChange={(e) => setTraffic(TRAFFIC_OPTIONS[Number(e.target.value)])}
              className="w-24 accent-violet-600"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          {sim.result && sim.result.summary.singlePointsOfFailure.length > 0 && (
            <span className="text-xs text-amber-600">
              ⚠ SPOF: {sim.result.summary.singlePointsOfFailure.join(', ')}
            </span>
          )}
          <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90">
            <span>✨</span> Analyze
          </button>
        </div>
      </footer>
    </div>
  )
}
