import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useEdgesState, useNodesState, type Edge, type Node } from 'reactflow'
import Canvas from '../components/Canvas'
import FindingsPanel from '../components/FindingsPanel'
import type { ArchNodeData } from '../components/ArchNode'
import { useSimulation } from '../lib/useSimulation'
import { analyzeGraph, type AnalyzeResult, type InjectedFailure } from '../lib/api'
import { ClockIcon, PacketDropIcon, SkullIcon, ThrottleIcon } from '../components/icons'
import { useAuth } from '../lib/AuthContext'
import { createProject, getProject, updateProject } from '../lib/projects'
import { TEMPLATES } from '../lib/templates'
import { estimateTotalMonthlyCost } from '../lib/cost'
import { useHistory } from '../lib/useHistory'
import type { ComponentType } from '../components/nodes'
import { stashPendingSave, takePendingSave } from '../lib/pendingSave'

const SPEED_OPTIONS = [0.5, 1, 2, 4]
const TRAFFIC_OPTIONS = [0.5, 1, 2.5, 5]

const CHAOS_TYPES: { type: InjectedFailure['type']; label: string; Icon: typeof SkullIcon }[] = [
  { type: 'kill', label: 'Kill node', Icon: SkullIcon },
  { type: 'latency', label: 'Add latency', Icon: ClockIcon },
  { type: 'throttle', label: 'Throttle', Icon: ThrottleIcon },
  { type: 'dropPct', label: 'Drop packets', Icon: PacketDropIcon },
]

function toGraphNodes(nodes: Node<ArchNodeData>[]) {
  return nodes.map((n) => ({
    id: n.id,
    type: n.data.componentType,
    config: n.data.config,
    position: n.position,
    label: n.data.label,
  }))
}

export default function EditorPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<ArchNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [baseRps, setBaseRps] = useState(100)
  const [traffic, setTraffic] = useState(1)
  const [failures, setFailures] = useState<InjectedFailure[]>([])
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [focusRequest, setFocusRequest] = useState<{ nodeId: string; token: number } | null>(null)
  const [exportRequest, setExportRequest] = useState(0)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('Untitled Project')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveDraftName, setSaveDraftName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isLoadingProject, setIsLoadingProject] = useState(false)

  const sim = useSimulation()
  const auth = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const loadedRef = useRef(false)
  const history = useHistory(nodes, edges, setNodes, setEdges)

  // Load from a template or a saved project once, on mount.
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    const pending = takePendingSave()
    if (pending) {
      setNodes(
        pending.graphJson.nodes.map((n) => ({
          id: n.id,
          type: 'archNode',
          position: n.position ?? { x: 0, y: 0 },
          data: { componentType: n.type, label: n.label ?? n.type, config: n.config, health: 'idle' },
        })),
      )
      setEdges(pending.graphJson.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: 'archEdge' })))
      setProjectName(pending.name)
      setSaveDraftName(pending.name === 'Untitled Project' ? '' : pending.name)
      setShowSaveDialog(true)
      setToast('Welcome back — pick up where you left off and save')
      return
    }

    const templateId = params.get('template')
    const loadProjectId = params.get('projectId')

    if (templateId) {
      const template = TEMPLATES.find((t) => t.id === templateId)
      if (template) {
        setNodes(
          template.graph.nodes.map((n) => ({
            id: n.id,
            type: 'archNode',
            position: n.position ?? { x: 0, y: 0 },
            data: { componentType: n.type, label: n.label ?? n.type, config: n.config, health: 'idle' },
          })),
        )
        setEdges(template.graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: 'archEdge' })))
        setProjectName(template.name)
      }
    } else if (loadProjectId) {
      setIsLoadingProject(true)
      getProject(loadProjectId)
        .then((project) => {
          setProjectId(project.id)
          setProjectName(project.name)
          setNodes(
            project.graphJson.nodes.map((n) => ({
              id: n.id,
              type: 'archNode',
              position: n.position ?? { x: 0, y: 0 },
              data: { componentType: n.type, label: n.label ?? n.type, config: n.config, health: 'idle' },
            })),
          )
          setEdges(project.graphJson.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: 'archEdge' })))
        })
        .catch(() => setToast("Couldn't load that project"))
        .finally(() => setIsLoadingProject(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const hasClient = nodes.some((n) => n.data.componentType === 'client')
  const canRun = nodes.length > 0 && hasClient && !sim.isRunning

  const handleRun = () => {
    if (sim.result) {
      sim.resume()
      return
    }
    sim.run(nodes, edges, baseRps * traffic, 3, failures)
  }

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    try {
      const result = await analyzeGraph(
        nodes.map((n) => ({ id: n.id, type: n.data.componentType, config: n.data.config })),
        edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
        sim.result?.summary ?? null,
      )
      setAnalysis(result)
    } catch {
      setAnalysis({ findings: [], aiEnabled: false })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const performSave = async (name: string) => {
    setIsSaving(true)
    setSaveError(null)
    const graphJson = { nodes: toGraphNodes(nodes), edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })) }
    try {
      if (projectId) {
        await updateProject(projectId, name, '', graphJson)
      } else {
        const created = await createProject(name, '', graphJson)
        setProjectId(created.id)
      }
      setProjectName(name)
      setToast('Saved')
      setShowSaveDialog(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveClick = () => {
    if (!auth.user) {
      const graphJson = { nodes: toGraphNodes(nodes), edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })) }
      stashPendingSave(projectName, graphJson)
      navigate('/login?redirect=/app')
      return
    }
    if (projectId) {
      performSave(projectName)
    } else {
      setSaveDraftName(projectName === 'Untitled Project' ? '' : projectName)
      setShowSaveDialog(true)
    }
  }

  const handleDeleteSelected = () => {
    if (!selectedNodeId) return
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId))
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId))
    setFailures((fs) => fs.filter((f) => f.nodeId !== selectedNodeId))
    setSelectedNodeId(null)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        history.undo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        history.redo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSaveClick()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          e.preventDefault()
          handleDeleteSelected()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId, projectId, projectName, nodes, edges])

  const global = sim.currentTick?.global
  const monthlyCost = estimateTotalMonthlyCost(nodes.map((n) => ({ type: n.data.componentType as ComponentType })))

  return (
    <div className="flex h-screen flex-col bg-[#fafafa] text-zinc-900">
      <header className="relative flex min-h-16 flex-wrap items-center justify-between gap-y-2 border-b border-zinc-200 bg-white/80 px-4 py-2 backdrop-blur-sm sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow-sm">
            S
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight text-zinc-900">SysFlow</span>
            <span className="text-xs text-zinc-400">{projectName}</span>
          </div>
        </Link>

        {sim.isPlaying && global && (
          <div className="status-pill-in absolute left-1/2 top-1/2 flex items-center gap-3 rounded-full bg-zinc-900 px-4 py-1.5 text-[12px] font-medium text-white shadow-md">
            <span className={global.errorRatePct >= 5 ? 'text-red-400' : 'text-emerald-400'}>
              err {global.errorRatePct.toFixed(1)}%
            </span>
            <span className="text-zinc-500">·</span>
            <span>rps {Math.round(global.rps)}</span>
            <span className="text-zinc-500">·</span>
            <span>p95 {Math.round(global.p95)}ms</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={history.undo}
            disabled={!history.canUndo}
            title="Undo (Ctrl+Z)"
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-500 shadow-sm transition hover:border-zinc-300 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ↶
          </button>
          <button
            onClick={history.redo}
            disabled={!history.canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-500 shadow-sm transition hover:border-zinc-300 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ↷
          </button>
          <label className="ml-2 flex items-center gap-2 text-xs font-medium text-zinc-500">
            <span className="hidden sm:inline">Target RPS</span>
            <span className="sm:hidden">RPS</span>
            <input
              type="number"
              min={1}
              value={baseRps}
              onChange={(e) => setBaseRps(Math.max(1, Number(e.target.value)))}
              className="w-20 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
            />
          </label>
          <button
            onClick={() => setExportRequest((t) => t + 1)}
            title="Export as PNG"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            Export
          </button>
          <button
            onClick={() => {
              if (!projectId) {
                setToast('Save the project first to get a share link')
                return
              }
              navigator.clipboard.writeText(`${window.location.origin}/share/${projectId}`)
              setToast('Share link copied')
            }}
            title="Copy a read-only share link"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            Share
          </button>
          {auth.user ? (
            <Link
              to="/projects"
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              My Projects
            </Link>
          ) : (
            <Link
              to="/login"
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              Log in
            </Link>
          )}
          <button
            onClick={handleSaveClick}
            disabled={isSaving}
            title="Save (Ctrl+S)"
            className="btn-dark rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {isLoadingProject && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-zinc-500 shadow-md">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-violet-500" />
              Loading project…
            </div>
          </div>
        )}
        <Canvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          setNodes={setNodes}
          setEdges={setEdges}
          currentTick={sim.currentTick}
          isPlaying={sim.isPlaying}
          failures={failures}
          setFailures={setFailures}
          focusRequest={focusRequest}
          exportRequest={exportRequest}
          onSelectionChange={setSelectedNodeId}
        />
        {analysis && (
          <FindingsPanel
            findings={analysis.findings}
            aiEnabled={analysis.aiEnabled}
            onFocusNode={(nodeId) => setFocusRequest({ nodeId, token: Date.now() })}
            onClose={() => setAnalysis(null)}
          />
        )}
      </div>

      <footer className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-white/80 px-4 py-2 backdrop-blur-sm sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
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
          {nodes.length > 0 && (
            <span className="ml-2 text-xs text-zinc-400" title="Rough illustrative estimate — not real cloud pricing">
              ~${monthlyCost}/mo
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Chaos:</span>
            {CHAOS_TYPES.map(({ type, label, Icon }) => {
              const activeCount = failures.filter((f) => f.type === type).length
              return (
                <button
                  key={type}
                  title={activeCount > 0 ? `${label} — click to clear` : `${label} (right-click a ${type === 'dropPct' ? 'edge' : 'node'} to apply)`}
                  onClick={() => activeCount > 0 && setFailures((fs) => fs.filter((f) => f.type !== type))}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                    activeCount > 0
                      ? 'bg-red-50 text-red-500 ring-1 ring-red-100'
                      : 'text-zinc-300 hover:bg-zinc-50 hover:text-zinc-400'
                  }`}
                >
                  <Icon width={14} height={14} />
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {sim.result && sim.result.summary.singlePointsOfFailure.length > 0 && (
            <span className="text-xs text-amber-600">
              ⚠ SPOF: {sim.result.summary.singlePointsOfFailure.join(', ')}
            </span>
          )}
          <button
            onClick={handleAnalyze}
            disabled={nodes.length === 0 || isAnalyzing}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span>✨</span> {isAnalyzing ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      </footer>

      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowSaveDialog(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-zinc-900">Save project</h3>
            <input
              autoFocus
              type="text"
              placeholder="Project name"
              value={saveDraftName}
              onChange={(e) => setSaveDraftName(e.target.value)}
              className="mt-4 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
            />
            {saveError && <p className="mt-2 text-xs text-red-500">{saveError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowSaveDialog(false)} className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700">
                Cancel
              </button>
              <button
                onClick={() => saveDraftName.trim() && performSave(saveDraftName.trim())}
                disabled={!saveDraftName.trim() || isSaving}
                className="btn-dark rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
