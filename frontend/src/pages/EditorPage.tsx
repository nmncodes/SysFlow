import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useEdgesState, useNodesState, type Edge, type Node } from 'reactflow'
import Canvas from '../components/Canvas'
import FindingsPanel from '../components/FindingsPanel'
import type { ArchNodeData } from '../components/ArchNode'
import { useSimulation } from '../lib/useSimulation'
import { analyzeGraph, importSrs, type AnalyzeResult, type InjectedFailure, type SrsImportResult } from '../lib/api'
import { ClockIcon, PacketDropIcon, SkullIcon, ThrottleIcon } from '../components/icons'
import { useAuth } from '../lib/AuthContext'
import { createProject, getProject, listVersions, restoreVersion, updateProject, type ProjectVersionSummary } from '../lib/projects'
import { TEMPLATES } from '../lib/templates'
import { useHistory } from '../lib/useHistory'
import { stashPendingSave, takePendingSave } from '../lib/pendingSave'
import { estimateTotalMonthlyCost, replicasOf } from '../lib/cost'
import { generateDockerCompose } from '../lib/iac'
import { COMPONENT_LIBRARY, type ComponentType } from '../components/nodes'
import CompareModal from '../components/CompareModal'
import SrsDiffModal from '../components/SrsDiffModal'
import logo from '../assets/logo.png'

const SPEED_OPTIONS = [0.5, 1, 2, 4]
const TRAFFIC_OPTIONS = [0.5, 1, 2.5, 5]
const RPS_PRESETS = [100, 500, 1000, 5000, 10000]

type ChaosType = InjectedFailure['type']

const CHAOS_TYPES: { type: ChaosType; label: string; Icon: typeof SkullIcon }[] = [
  { type: 'kill', label: 'Kill Node', Icon: SkullIcon },
  { type: 'latency', label: 'Add Latency', Icon: ClockIcon },
  { type: 'dropPct', label: 'Drop Packets', Icon: PacketDropIcon },
  { type: 'throttle', label: 'Reduce Capacity', Icon: ThrottleIcon },
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

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
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
  const [isDirty, setIsDirty] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isImportingSrs, setIsImportingSrs] = useState(false)
  const [srsUnrecognized, setSrsUnrecognized] = useState<string[]>([])
  const srsFileInputRef = useRef<HTMLInputElement>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [versions, setVersions] = useState<ProjectVersionSummary[]>([])
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null)
  const [compareNodeId, setCompareNodeId] = useState<string | null>(null)
  const [pendingSrsImport, setPendingSrsImport] = useState<{ result: SrsImportResult; fileName: string } | null>(null)
  const [chaosOpen, setChaosOpen] = useState(false)
  const [chaosType, setChaosType] = useState<ChaosType>('kill')
  const [chaosTarget, setChaosTarget] = useState('')
  const [chaosLatency, setChaosLatency] = useState(100)
  const [chaosDrop, setChaosDrop] = useState(10)
  const [chaosThrottle, setChaosThrottle] = useState(50)

  const sim = useSimulation()
  const auth = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const loadedRef = useRef(false)
  const history = useHistory(nodes, edges, setNodes, setEdges)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    const pending = takePendingSave()
    if (pending) {
      setNodes(pending.graphJson.nodes.map((n) => ({
        id: n.id,
        type: 'archNode',
        position: n.position ?? { x: 0, y: 0 },
        data: { componentType: n.type, label: n.label ?? n.type, config: n.config, health: 'idle' },
      })))
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
        setNodes(template.graph.nodes.map((n) => ({
          id: n.id,
          type: 'archNode',
          position: n.position ?? { x: 0, y: 0 },
          data: { componentType: n.type, label: n.label ?? n.type, config: n.config, health: 'idle' },
        })))
        setEdges(template.graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: 'archEdge' })))
        setProjectName(template.name)
      }
    } else if (loadProjectId) {
      setIsLoadingProject(true)
      getProject(loadProjectId)
        .then((project) => {
          setProjectId(project.id)
          setProjectName(project.name)
          setNodes(project.graphJson.nodes.map((n) => ({
            id: n.id,
            type: 'archNode',
            position: n.position ?? { x: 0, y: 0 },
            data: { componentType: n.type, label: n.label ?? n.type, config: n.config, health: 'idle' },
          })))
          setEdges(project.graphJson.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: 'archEdge' })))
        })
        .catch(() => setToast("Couldn't load that project"))
        .finally(() => setIsLoadingProject(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const hasClient = nodes.some((n) => n.data.componentType === 'client')
  const canRun = nodes.length > 0 && hasClient && !sim.isRunning
  const global = sim.currentTick?.global
  const estimatedMonthlyCost = estimateTotalMonthlyCost(
    nodes.map((n) => ({ type: n.data.componentType as ComponentType, replicas: replicasOf(n.data.componentType, n.data.config, n.data.replicas) })),
  )
  const simulationState = sim.isRunning ? 'Starting' : sim.isPlaying ? 'Running' : sim.result ? 'Paused' : 'Ready'

  const markDirty = () => setIsDirty(true)

  const handleNodesChange = (changes: Parameters<typeof onNodesChange>[0]) => {
    if (changes.length > 0) setIsDirty(true)
    onNodesChange(changes)
  }

  const handleEdgesChange = (changes: Parameters<typeof onEdgesChange>[0]) => {
    if (changes.length > 0) setIsDirty(true)
    onEdgesChange(changes)
  }

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
      setToast('Analysis service is unavailable — showing local checks')
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
      setIsDirty(false)
      setToast('Project saved')
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

  const applyTemplate = (templateId: string) => {
    const template = TEMPLATES.find((item) => item.id === templateId)
    if (!template) return
    setNodes(template.graph.nodes.map((n) => ({
      id: n.id,
      type: 'archNode',
      position: n.position ?? { x: 0, y: 0 },
      data: { componentType: n.type, label: n.label ?? n.type, config: n.config, health: 'idle' },
    })))
    setEdges(template.graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: 'archEdge' })))
    setProjectName(template.name)
    setSelectedNodeId(null)
    setTemplatesOpen(false)
    setIsDirty(true)
    setToast(`${template.name} loaded`)
  }

  const openHistory = async () => {
    if (!projectId) return
    setHistoryOpen((v) => !v)
    setExportOpen(false)
    setTemplatesOpen(false)
    setMobileMenuOpen(false)
    setIsLoadingVersions(true)
    try {
      setVersions(await listVersions(projectId))
    } catch {
      setToast("Couldn't load version history")
    } finally {
      setIsLoadingVersions(false)
    }
  }

  const handleRestoreVersion = async (versionId: string) => {
    if (!projectId) return
    setRestoringVersionId(versionId)
    try {
      const restored = await restoreVersion(projectId, versionId)
      setNodes(restored.graphJson.nodes.map((n) => ({
        id: n.id,
        type: 'archNode',
        position: n.position ?? { x: 0, y: 0 },
        data: { componentType: n.type, label: n.label ?? n.type, config: n.config, health: 'idle' },
      })))
      setEdges(restored.graphJson.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: 'archEdge' })))
      setIsDirty(false)
      setHistoryOpen(false)
      setToast('Restored previous version')
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Restore failed')
    } finally {
      setRestoringVersionId(null)
    }
  }

  const applyImportedGraph = (result: SrsImportResult, fileName: string) => {
    setNodes(result.graphJson.nodes.map((n) => ({
      id: n.id,
      type: 'archNode',
      position: n.position,
      data: { componentType: n.type, label: n.label, config: n.config, health: 'idle' },
    })))
    setEdges(result.graphJson.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: 'archEdge' })))
    setProjectId(null)
    setProjectName(fileName.replace(/\.[^.]+$/, ''))
    setSelectedNodeId(null)
    setIsDirty(true)
    setAnalysis({ findings: result.findings, aiEnabled: result.aiEnabled })
    setSrsUnrecognized(result.unrecognizedTerms)
    setToast(`Generated ${result.graphJson.nodes.length} components from "${fileName}"`)
  }

  const handleSrsFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setIsImportingSrs(true)
    setSrsUnrecognized([])
    try {
      const result = await importSrs(file)
      if (nodes.length > 0) {
        setPendingSrsImport({ result, fileName: file.name })
      } else {
        applyImportedGraph(result, file.name)
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'SRS import failed')
    } finally {
      setIsImportingSrs(false)
    }
  }

  const exportJson = () => {
    downloadText('sysflow-architecture.json', JSON.stringify({ projectName, nodes: toGraphNodes(nodes), edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })) }, null, 2), 'application/json')
    setExportOpen(false)
  }

  const exportPdf = () => {
    setExportOpen(false)
    window.print()
  }

  const exportDockerCompose = () => {
    const compose = generateDockerCompose(
      nodes.map((n) => ({ id: n.id, type: n.data.componentType, label: n.data.label, config: n.data.config })),
      edges.map((e) => ({ source: e.source, target: e.target })),
    )
    downloadText('docker-compose.yml', compose, 'text/yaml')
    setExportOpen(false)
  }

  const nodeTargets = nodes
  const edgeTargets = edges
  const chaosTargetOptions = chaosType === 'dropPct' ? edgeTargets : nodeTargets

  useEffect(() => {
    if (!chaosTargetOptions.some((item) => item.id === chaosTarget)) setChaosTarget(chaosTargetOptions[0]?.id ?? '')
  }, [chaosType, nodes.length, edges.length, chaosTarget])

  const injectChaos = () => {
    if (!chaosTarget) return
    let failure: InjectedFailure
    if (chaosType === 'kill') failure = { type: 'kill', nodeId: chaosTarget, fromTick: 0 }
    else if (chaosType === 'latency') failure = { type: 'latency', nodeId: chaosTarget, fromTick: 0, extraMs: Math.max(1, chaosLatency) }
    else if (chaosType === 'throttle') failure = { type: 'throttle', nodeId: chaosTarget, fromTick: 0, throttlePct: Math.max(1, Math.min(100, chaosThrottle)) }
    else failure = { type: 'dropPct', edgeId: chaosTarget, fromTick: 0, dropPct: Math.max(1, Math.min(100, chaosDrop)) }
    setFailures((current) => [...current.filter((item) => !(item.type === failure.type && (item.nodeId === failure.nodeId || item.edgeId === failure.edgeId))), failure])
    setIsDirty(true)
    setToast(`${CHAOS_TYPES.find((item) => item.type === chaosType)?.label} injected`)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        history.undo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        history.redo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSaveClick()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setNodes((nds) => nds.map((node) => ({ ...node, selected: true })))
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          e.preventDefault()
          setNodes((nds) => nds.filter((node) => node.id !== selectedNodeId))
          setEdges((eds) => eds.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId))
          setFailures((fs) => fs.filter((failure) => failure.nodeId !== selectedNodeId))
          setSelectedNodeId(null)
          setIsDirty(true)
        }
      } else if (e.key === 'Escape') {
        setExportOpen(false)
        setTemplatesOpen(false)
        setChaosOpen(false)
        setMobileMenuOpen(false)
        setHistoryOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId, projectId, projectName, nodes, edges])

  return (
    <div className="editor-shell flex h-screen min-h-0 flex-col bg-[#f8fcfd] text-zinc-900">
      <header className="editor-header relative z-30 flex min-h-[76px] items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-2 shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:px-6">
        <div className="flex min-w-[220px] items-center gap-3">
          <Link to="/" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
            <img src={logo} alt="SysFlow" className="h-11 w-11 object-contain" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2"><span className="text-base font-semibold tracking-tight text-zinc-900">SysFlow</span><span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-zinc-400">Editor</span></div>
            <input
              value={projectName}
              onChange={(e) => { setProjectName(e.target.value); markDirty() }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              title="Edit project name"
              className="mt-0.5 w-44 border-0 bg-transparent p-0 text-xs text-zinc-400 outline-none hover:text-zinc-600 focus:text-zinc-800"
            />
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 lg:flex">
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${isDirty ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" /> {isSaving ? 'Saving…' : isDirty ? 'Unsaved changes' : 'Saved'}
          </span>
          {nodes.length > 0 && (
            <span title="Rough, illustrative cloud cost estimate — not real pricing" className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold text-zinc-600">
              ~${estimatedMonthlyCost.toLocaleString()}/mo
            </span>
          )}
          {isLoadingProject && <span className="text-[10px] text-zinc-400">Loading project…</span>}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button onClick={history.undo} disabled={!history.canUndo} title="Undo (Ctrl+Z)" className="toolbar-icon" aria-label="Undo">↶</button>
          <button onClick={history.redo} disabled={!history.canRedo} title="Redo (Ctrl+Y)" className="toolbar-icon" aria-label="Redo">↷</button>

          <div className="target-rps-box hidden items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 xl:flex">
            <div><p className="text-[10px] font-bold text-zinc-500">Target RPS <span className="text-zinc-300">ⓘ</span></p><input type="number" min={1} max={1000000} value={baseRps} onChange={(e) => { const value = Math.min(1000000, Math.max(1, Number(e.target.value) || 1)); setBaseRps(value); markDirty() }} className="w-20 border-0 bg-transparent p-0 text-sm font-bold text-zinc-900 outline-none" /></div>
            <div className="flex items-end gap-1">
              {RPS_PRESETS.map((value) => <button key={value} onClick={() => { setBaseRps(value); markDirty() }} className={`rps-preset ${baseRps === value ? 'active' : ''}`}>{value >= 1000 ? `${value / 1000}K` : value}</button>)}
            </div>
          </div>

          <div className="relative">
            <button onClick={() => { setExportOpen((v) => !v); setTemplatesOpen(false); setHistoryOpen(false) }} className="toolbar-button">Export⌄</button>
            {exportOpen && <div className="popover-menu right-0 top-12">
              <button onClick={() => { setExportRequest((v) => v + 1); setExportOpen(false) }}>PNG image</button>
              <button onClick={exportJson}>JSON graph</button>
              <button onClick={exportDockerCompose}>docker-compose.yml</button>
              <button onClick={exportPdf}>PDF / Print</button>
            </div>}
          </div>

          <button onClick={() => { if (!projectId) { setToast('Save the project first to get a share link'); return }; navigator.clipboard.writeText(`${window.location.origin}/share/${projectId}`); setToast('Share link copied') }} className="toolbar-button hidden md:block">Share ↗</button>

          {projectId && <div className="relative">
            <button onClick={openHistory} className="toolbar-button hidden md:block">History</button>
            {historyOpen && <div className="popover-menu right-0 top-12 w-72">
              <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-wider text-zinc-400">Version history</p>
              {isLoadingVersions && <p className="px-3 py-2 text-xs text-zinc-400">Loading…</p>}
              {!isLoadingVersions && versions.length === 0 && <p className="px-3 py-2 text-xs text-zinc-400">No previous versions yet — saves create one automatically.</p>}
              {!isLoadingVersions && versions.map((v) => (
                <button key={v.id} onClick={() => handleRestoreVersion(v.id)} disabled={restoringVersionId === v.id} className="flex w-full items-center justify-between disabled:opacity-50">
                  <span className="text-zinc-700">{new Date(v.createdAt).toLocaleString()}</span>
                  <span className="text-[10px] font-semibold text-violet-600">{restoringVersionId === v.id ? 'Restoring…' : 'Restore'}</span>
                </button>
              ))}
            </div>}
          </div>}

          <input ref={srsFileInputRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={handleSrsFileSelected} />
          <button onClick={() => srsFileInputRef.current?.click()} disabled={isImportingSrs} className="toolbar-button hidden md:block disabled:opacity-50">{isImportingSrs ? 'Importing…' : 'Import SRS'}</button>

          <div className="relative">
            <button onClick={() => { setTemplatesOpen((v) => !v); setExportOpen(false); setHistoryOpen(false) }} className="toolbar-button hidden md:block">Templates</button>
            {templatesOpen && <div className="popover-menu right-0 top-12 w-64">
              <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-wider text-zinc-400">Start with a template</p>
              {TEMPLATES.map((template) => <button key={template.id} onClick={() => applyTemplate(template.id)}><span className="block font-semibold text-zinc-800">{template.name}</span><span className="mt-0.5 block text-[10px] leading-relaxed text-zinc-400">{template.description}</span></button>)}
            </div>}
          </div>

          {auth.user ? <Link to="/projects" className="toolbar-button hidden lg:block">Projects</Link> : <Link to="/login" className="toolbar-button hidden lg:block">Log in</Link>}
          <button onClick={handleSaveClick} disabled={isSaving} title="Save (Ctrl+S)" className="btn-dark rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{isSaving ? 'Saving…' : 'Save'}</button>

          <div className="relative lg:hidden">
            <button onClick={() => setMobileMenuOpen((v) => !v)} className="toolbar-icon" aria-label="More options">⋯</button>
            {mobileMenuOpen && <div className="popover-menu right-0 top-12 w-56">
              <button onClick={() => { srsFileInputRef.current?.click(); setMobileMenuOpen(false) }} disabled={isImportingSrs}>{isImportingSrs ? 'Importing…' : 'Import SRS'}</button>
              <div className="my-1 border-t border-zinc-100" />
              <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-wider text-zinc-400">Templates</p>
              {TEMPLATES.map((template) => <button key={template.id} onClick={() => { applyTemplate(template.id); setMobileMenuOpen(false) }}><span className="block font-semibold text-zinc-800">{template.name}</span></button>)}
              <div className="my-1 border-t border-zinc-100" />
              <button onClick={() => { if (!projectId) { setToast('Save the project first to get a share link'); setMobileMenuOpen(false); return }; navigator.clipboard.writeText(`${window.location.origin}/share/${projectId}`); setToast('Share link copied'); setMobileMenuOpen(false) }}>Share ↗</button>
              {auth.user ? <Link to="/projects" onClick={() => setMobileMenuOpen(false)}>Projects</Link> : <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Log in</Link>}
            </div>}
          </div>
        </div>
      </header>

      {srsUnrecognized.length > 0 && (
        <div className="relative z-20 flex items-center justify-between gap-3 border-b border-amber-100 bg-amber-50 px-4 py-1.5 text-xs text-amber-700 sm:px-6">
          <span>Couldn't confidently map: <b>{srsUnrecognized.join(', ')}</b> — placed as a generic Service. Review before running.</span>
          <button onClick={() => setSrsUnrecognized([])} className="shrink-0 text-amber-500 hover:text-amber-800">✕</button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {isLoadingProject && <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/60 backdrop-blur-sm"><div className="rounded-full bg-white px-4 py-2 text-sm text-zinc-500 shadow-lg">Loading project…</div></div>}
        <Canvas
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          setNodes={setNodes}
          setEdges={setEdges}
          currentTick={sim.currentTick}
          isPlaying={sim.isPlaying}
          failures={failures}
          setFailures={setFailures}
          focusRequest={focusRequest}
          exportRequest={exportRequest}
          onSelectionChange={setSelectedNodeId}
          onDirty={markDirty}
          hideSidebar={!!analysis}
          onCompareNode={setCompareNodeId}
        />
        {analysis && <FindingsPanel findings={analysis.findings} aiEnabled={analysis.aiEnabled} summary={sim.result?.summary} onFocusNode={(nodeId) => setFocusRequest({ nodeId, token: Date.now() })} onClose={() => setAnalysis(null)} />}
      </div>

      {pendingSrsImport && (
        <SrsDiffModal
          currentNodes={nodes}
          currentEdges={edges}
          imported={pendingSrsImport.result}
          fileName={pendingSrsImport.fileName}
          onCancel={() => setPendingSrsImport(null)}
          onConfirm={() => {
            applyImportedGraph(pendingSrsImport.result, pendingSrsImport.fileName)
            setPendingSrsImport(null)
          }}
        />
      )}

      {compareNodeId && (() => {
        const compareTarget = nodes.find((n) => n.id === compareNodeId)
        if (!compareTarget) return null
        return (
          <CompareModal
            node={compareTarget}
            nodes={nodes}
            edges={edges}
            targetRps={baseRps * traffic}
            failures={failures}
            onClose={() => setCompareNodeId(null)}
            onApply={(newType) => {
              const def = COMPONENT_LIBRARY.find((c) => c.type === newType)
              setNodes((nds) => nds.map((n) =>
                n.id === compareNodeId
                  ? { ...n, data: { ...n.data, componentType: newType, label: def?.label ?? newType, config: { ...(def?.defaultConfig ?? {}) }, replicas: undefined, metrics: undefined, hasFailure: false, health: 'idle' } }
                  : n,
              ))
              setIsDirty(true)
              setCompareNodeId(null)
              setToast(`Swapped to ${def?.label ?? newType}`)
            }}
          />
        )
      })()}

      <footer className="simulation-footer relative z-30 border-t border-zinc-200 bg-white px-4 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-3 xl:flex-nowrap">
          <div className="flex items-center gap-2">
            <button onClick={handleRun} disabled={!canRun} className="run-button"><span>{sim.isPlaying ? '▶' : '▶'}</span> {sim.isPlaying ? 'Running' : sim.result ? 'Resume' : sim.isRunning ? 'Starting…' : 'Run'}<small>Ctrl + Enter</small></button>
            {sim.isPlaying && <button onClick={sim.pause} className="simulation-secondary">Pause</button>}
            {sim.result && <button onClick={sim.reset} className="simulation-secondary danger">Stop</button>}
          </div>

          <div className="simulation-state"><span className={`state-dot ${simulationState.toLowerCase()}`} /> Simulation: <b>{simulationState}</b></div>

          <div className="segmented-group"><span>Speed</span>{SPEED_OPTIONS.map((value) => <button key={value} onClick={() => sim.setSpeed(value)} className={sim.speed === value ? 'active' : ''}>{value}×</button>)}</div>
          <div className="segmented-group"><span>Traffic</span>{TRAFFIC_OPTIONS.map((value) => <button key={value} onClick={() => { setTraffic(value); markDirty() }} className={traffic === value ? 'active' : ''}>{value}×</button>)}</div>

          <div className="relative">
            <button onClick={() => setChaosOpen((v) => !v)} className={`chaos-button ${failures.length > 0 ? 'active' : ''}`}>⚡ Chaos {failures.length > 0 && <b>{failures.length}</b>}</button>
            {chaosOpen && <div className="chaos-popover">
              <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Chaos engineering</p><p className="mt-0.5 text-xs font-semibold text-zinc-900">Inject a controlled failure</p></div><button onClick={() => setChaosOpen(false)} className="text-zinc-400">✕</button></div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">{CHAOS_TYPES.map(({ type, label, Icon }) => <button key={type} onClick={() => setChaosType(type)} className={`chaos-option ${chaosType === type ? 'active' : ''}`}><Icon width={14} height={14} />{label}</button>)}</div>
              <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{chaosType === 'dropPct' ? 'Select edge' : 'Select node'}
                <select value={chaosTarget} onChange={(e) => setChaosTarget(e.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-700 outline-none focus:border-violet-400">
                  {chaosTargetOptions.length === 0 && <option value="">No targets available</option>}
                  {chaosTargetOptions.map((item) => <option key={item.id} value={item.id}>{chaosType === 'dropPct' && 'source' in item ? `${item.source} → ${item.target}` : nodes.find((n) => n.id === item.id)?.data.label}</option>)}
                </select>
              </label>
              {chaosType === 'latency' && <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Latency (ms)<input type="number" min={1} value={chaosLatency} onChange={(e) => setChaosLatency(Number(e.target.value))} className="mt-1.5 w-full rounded-lg border border-zinc-200 px-2.5 py-2 text-xs" /></label>}
              {chaosType === 'dropPct' && <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Drop packets (%)<input type="number" min={1} max={100} value={chaosDrop} onChange={(e) => setChaosDrop(Number(e.target.value))} className="mt-1.5 w-full rounded-lg border border-zinc-200 px-2.5 py-2 text-xs" /></label>}
              {chaosType === 'throttle' && <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Reduce capacity (%)<input type="number" min={1} max={100} value={chaosThrottle} onChange={(e) => setChaosThrottle(Number(e.target.value))} className="mt-1.5 w-full rounded-lg border border-zinc-200 px-2.5 py-2 text-xs" /></label>}
              <button onClick={injectChaos} disabled={!chaosTarget} className="mt-3 w-full rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-40">Inject Failure</button>
              {failures.length > 0 && <button onClick={() => { setFailures([]); setIsDirty(true) }} className="mt-2 w-full text-[10px] font-semibold text-red-500">Clear all failures</button>}
            </div>}
          </div>

          <div className="live-metrics ml-auto flex min-w-[310px] items-center gap-5 rounded-xl border border-zinc-100 bg-zinc-50/70 px-4 py-2">
            <div><span>RPS</span><b>{Math.round(global?.rps ?? 0).toLocaleString()}</b></div>
            <div><span>p95 latency</span><b>{Math.round(global?.p95 ?? 0)}ms</b></div>
            <div><span>Error rate</span><b className={(global?.errorRatePct ?? 0) >= 5 ? 'bad' : ''}>{(global?.errorRatePct ?? 0).toFixed(1)}%</b></div>
            <div><span>Throughput</span><b>{((global?.rps ?? 0) / 100).toFixed(1)} MB/s</b></div>
          </div>

          <button onClick={handleAnalyze} disabled={nodes.length === 0 || isAnalyzing} className="analyze-button">✨ <span>{isAnalyzing ? 'Analyzing…' : 'Analyze'}</span><small>AI Analysis</small></button>
        </div>
        {sim.error && <p className="mt-1 text-xs text-red-500">{sim.error}</p>}
      </footer>

      <div className="shortcut-strip hidden items-center justify-center gap-5 border-t border-zinc-100 bg-white px-4 py-1.5 text-[9px] text-zinc-400 lg:flex">
        <span><kbd>Delete</kbd> Delete node</span><span><kbd>Ctrl + Z</kbd> Undo</span><span><kbd>Ctrl + Y</kbd> Redo</span><span><kbd>Ctrl + S</kbd> Save</span><span><kbd>Ctrl + A</kbd> Select all</span><span><kbd>Space + Drag</kbd> Pan</span><span><kbd>Esc</kbd> Cancel connection</span>
      </div>

      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/20 p-4 backdrop-blur-sm" onClick={() => setShowSaveDialog(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-zinc-900">Save project</h3>
            <p className="mt-1 text-xs text-zinc-400">Give this architecture a name so you can return to it later.</p>
            <input autoFocus type="text" placeholder="Project name" value={saveDraftName} onChange={(e) => setSaveDraftName(e.target.value)} className="mt-4 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 outline-none focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100" />
            {saveError && <p className="mt-2 text-xs text-red-500">{saveError}</p>}
            <div className="mt-4 flex justify-end gap-2"><button onClick={() => setShowSaveDialog(false)} className="rounded-xl px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-50">Cancel</button><button onClick={() => saveDraftName.trim() && performSave(saveDraftName.trim())} disabled={!saveDraftName.trim() || isSaving} className="btn-dark rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50">{isSaving ? 'Saving…' : 'Save'}</button></div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white shadow-xl">{toast}</div>}
    </div>
  )
}