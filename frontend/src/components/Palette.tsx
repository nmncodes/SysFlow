import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  COMPONENT_CATEGORIES,
  COMPONENT_FAMILY_COLORS,
  COMPONENT_LIBRARY,
  formatComponentSpecs,
  type ComponentCategory,
  type ComponentDef,
} from './nodes'
import { COMPONENT_ICONS } from './icons'
import { getCustomComponents, saveCustomComponent, deleteCustomComponent, exportCustomComponents, importCustomComponents, toComponentDef, type CustomComponentDef } from '../lib/customComponents'

const SEARCH_ALIASES: Record<string, string[]> = {
  database: ['db', 'storage', 'sql', 'postgres', 'data'],
  cache: ['redis', 'memory', 'fast storage'],
  queue: ['messaging', 'kafka', 'broker', 'async'],
  service: ['api', 'microservice', 'backend'],
  'load balancer': ['lb', 'traffic', 'balancer'],
  'api gateway': ['gateway', 'api'],
  cdn: ['edge', 'content delivery'],
}

interface Props {
  /** Tap-to-add fallback for touch devices, where HTML5 drag-and-drop doesn't work. Desktop keeps drag as primary. */
  onAdd?: (componentType: string) => void
  /** Mobile-only: whether this renders as an open bottom sheet. Always visible on md+ regardless. */
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

interface HoveredCardState {
  component: ComponentDef
  rect: DOMRect
  sidebarLeft: number
}

export default function Palette({ onAdd, mobileOpen = false, onCloseMobile }: Props) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [recent, setRecent] = useState<string[]>([])
  const [dragging, setDragging] = useState<string | null>(null)
  const [hoveredCard, setHoveredCard] = useState<HoveredCardState | null>(null)
  const [customDefs, setCustomDefs] = useState<CustomComponentDef[]>(() => getCustomComponents())
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [editingCustom, setEditingCustom] = useState<CustomComponentDef | null>(null)
  const sidebarRef = useRef<HTMLElement | null>(null)
  const [panelWidth, setPanelWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('sysflow:component_panel_width'))
      return Number.isFinite(saved) ? Math.min(480, Math.max(260, saved)) : 286
    } catch {
      return 286
    }
  })
  const [panelCollapsed, setPanelCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sysflow:component_panel_collapsed') === 'true'
    } catch {
      return false
    }
  })
  const [resizing, setResizing] = useState(false)

  useEffect(() => {
    if (!resizing) return
    const onMove = (event: MouseEvent) => {
      const nextWidth = Math.min(480, Math.max(260, window.innerWidth - event.clientX))
      setPanelWidth(nextWidth)
    }
    const onUp = () => setResizing(false)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizing])

  useEffect(() => {
    try {
      localStorage.setItem('sysflow:component_panel_width', String(panelWidth))
    } catch {
      // ignore
    }
  }, [panelWidth])

  useEffect(() => {
    try {
      localStorage.setItem('sysflow:component_panel_collapsed', String(panelCollapsed))
    } catch {
      // ignore
    }
  }, [panelCollapsed])

  const togglePanel = () => {
    setHoveredCard(null)
    setPanelCollapsed((current) => !current)
  }

  const allComponents = useMemo(() => [...COMPONENT_LIBRARY, ...customDefs.map(toComponentDef)], [customDefs])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allComponents
    return allComponents.filter((component) => {
      const haystack = [
        component.label,
        component.type,
        component.description,
        component.examples,
        ...(SEARCH_ALIASES[component.label.toLowerCase()] ?? []),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [query, allComponents])

  const recentlyUsed = recent
    .map((type) => allComponents.find((component) => component.type === type))
    .filter(Boolean)
    .slice(0, 4)

  const onDragStart = (event: React.DragEvent, componentType: string) => {
    event.dataTransfer.setData('application/archflow-node', componentType)
    event.dataTransfer.effectAllowed = 'move'
    setDragging(componentType)
    setHoveredCard(null)
    setRecent((items) => [componentType, ...items.filter((item) => item !== componentType)].slice(0, 6))
  }

  const onTap = (componentType: string) => {
    if (!onAdd) return
    setHoveredCard(null)
    setRecent((items) => [componentType, ...items.filter((item) => item !== componentType)].slice(0, 6))
    onAdd(componentType)
  }

  const handleCardEnter = (event: React.MouseEvent<HTMLDivElement>, component: ComponentDef) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const sidebarRect = sidebarRef.current?.getBoundingClientRect()
    setHoveredCard({
      component,
      rect,
      sidebarLeft: sidebarRect ? sidebarRect.left : rect.left,
    })
  }

  const handleCardLeave = () => {
    setHoveredCard(null)
  }

  const getIcon = (type: string) => COMPONENT_ICONS[type as keyof typeof COMPONENT_ICONS] ?? null
  const getEmoji = (type: string) => customDefs.find((c) => c.type === type)?.icon ?? '⚙'

  const renderHoverOverview = () => {
    if (!hoveredCard || dragging || panelCollapsed) return null
    const { component, rect, sidebarLeft } = hoveredCard
    const Icon = getIcon(component.type)
    const familyColor = COMPONENT_FAMILY_COLORS[component.category]
    const specs = formatComponentSpecs(component)
    const cardWidth = 264
    const left = Math.max(12, sidebarLeft - cardWidth - 12)
    const top = Math.min(Math.max(68, rect.top - 8), window.innerHeight - 210)

    return createPortal(
      <div
        className="pointer-events-none fixed z-[350] hidden w-[264px] overflow-hidden rounded-2xl border bg-white/98 dark:bg-zinc-900/98 p-3.5 shadow-[0_20px_48px_rgba(15,23,42,0.18)] dark:shadow-[0_20px_48px_rgba(0,0,0,0.65)] backdrop-blur-xl md:block"
        style={{
          left,
          top,
          borderColor: familyColor,
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: familyColor }}
        />
        <div className="flex items-start gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm"
            style={{
              color: familyColor,
              borderColor: `${familyColor}45`,
              backgroundColor: `${familyColor}14`,
            }}
          >
            {Icon ? <Icon width={17} height={17} /> : getEmoji(component.type)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1.5">
              <p className="truncate text-xs font-bold text-zinc-900 dark:text-zinc-50">
                {component.label}
              </p>
              <span
                className="shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                style={{
                  color: familyColor,
                  borderColor: `${familyColor}45`,
                  backgroundColor: `${familyColor}14`,
                }}
              >
                {component.category}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
              {component.examples}
            </p>
          </div>
        </div>

        <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
          {component.description}
        </p>

        {specs.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1 border-t border-zinc-100 dark:border-zinc-800 pt-2">
            {specs.map((spec) => (
              <span
                key={spec}
                className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-600 dark:text-zinc-300"
              >
                {spec}
              </span>
            ))}
          </div>
        )}
      </div>,
      document.body,
    )
  }

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-zinc-900/20 dark:bg-black/50 md:hidden" onClick={onCloseMobile} />}
      <aside
        ref={sidebarRef}
        className={`component-sidebar ${panelCollapsed ? 'component-sidebar-collapsed' : ''} ${resizing ? 'component-sidebar-resizing' : ''} fixed inset-x-0 bottom-0 z-40 flex h-[70vh] flex-col rounded-t-2xl border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl transition-[transform,width] duration-200 md:static md:z-auto md:h-full md:w-[276px] md:shrink-0 md:translate-y-0 md:rounded-none md:border-t-0 md:border-l md:shadow-none ${mobileOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ ['--component-panel-width' as string]: `${panelCollapsed ? 56 : panelWidth}px` }}
      >
        <div
          className="component-sidebar-resize-handle hidden md:block"
          onMouseDown={(event) => {
            event.preventDefault()
            setResizing(true)
          }}
          title="Drag to resize components panel"
          aria-hidden="true"
        />
        <button
          type="button"
          className="component-sidebar-toggle hidden md:flex"
          onClick={togglePanel}
          aria-label={panelCollapsed ? 'Expand components panel' : 'Collapse components panel'}
          title={panelCollapsed ? 'Expand components panel' : 'Collapse components panel'}
        >
          <span aria-hidden="true">{panelCollapsed ? '‹' : '›'}</span>
        </button>
      <div className="component-sidebar-content border-b border-zinc-100 dark:border-zinc-800 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Components</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (mobileOpen ? onCloseMobile?.() : togglePanel())}
              aria-label="Close components panel"
              title="Close components panel"
              className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="relative mt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search components..."
            title="Search by component name, DB, storage, API, etc."
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2.5 pr-16 text-xs text-zinc-700 dark:text-zinc-200 outline-none transition focus:border-violet-300 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-violet-100 dark:focus:ring-violet-900/40"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-white dark:bg-zinc-900 px-1.5 py-1 text-[9px] text-zinc-400 dark:text-zinc-500 shadow-sm">Ctrl K</span>
        </div>
      </div>

      <div
        className="component-sidebar-content flex-1 overflow-y-auto p-3"
        onScroll={() => setHoveredCard(null)}
      >
        {!query && recentlyUsed.length > 0 && (
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-500 dark:text-violet-400">Recently used</span>
              <span className="text-[9px] text-zinc-300 dark:text-zinc-600">{recentlyUsed.length}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {recentlyUsed.map((component) => {
                if (!component) return null
                const Icon = getIcon(component.type)
                const familyColor = COMPONENT_FAMILY_COLORS[component.category]
                return (
                  <div
                    key={component.type}
                    draggable
                    onDragStart={(e) => onDragStart(e, component.type)}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => onTap(component.type)}
                    onMouseEnter={(e) => handleCardEnter(e, component)}
                    onMouseLeave={handleCardLeave}
                    title={`${component.label} (${component.category}) - ${component.description}`}
                    className={`component-card group ${dragging === component.type ? 'component-dragging' : ''}`}
                    style={{ '--card-family-color': familyColor, borderColor: familyColor } as CSSProperties}
                  >
                    <span className="component-icon" style={{ color: familyColor, borderColor: `${familyColor}45` }}>
                      {Icon ? <Icon width={15} height={15} /> : <span className="text-sm">{getEmoji(component.type)}</span>}
                    </span>
                    <span className="line-clamp-1 text-[9px] font-semibold">{component.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {COMPONENT_CATEGORIES.map((category) => {
          const items = filtered.filter((component) => component.category === category)
          if (items.length === 0) return null
          const isCollapsed = collapsed[category]
          const familyColor = COMPONENT_FAMILY_COLORS[category]
          return (
            <div
              key={category}
              className="mb-4 rounded-xl border-l-2 pl-2"
              style={{ borderLeftColor: familyColor }}
            >
              <button
                onClick={() => setCollapsed((current) => ({ ...current, [category]: !current[category] }))}
                className="mb-2 flex w-full items-center justify-between px-1 text-left"
              >
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: familyColor }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: familyColor }} />
                  {category}
                </span>
                <span
                  className="rounded-full border px-1.5 py-0.5 text-[9px] font-bold"
                  style={{ color: familyColor, borderColor: `${familyColor}40`, backgroundColor: `${familyColor}12` }}
                >
                  {isCollapsed ? '+' : '⌃'} {items.length}
                </span>
              </button>
              {!isCollapsed && (
                <div className="grid grid-cols-3 gap-1.5">
                  {items.map((component) => {
                    const Icon = getIcon(component.type)
                    return (
                      <div
                        key={component.type}
                        draggable
                        onDragStart={(e) => onDragStart(e, component.type)}
                        onDragEnd={() => setDragging(null)}
                        onClick={() => onTap(component.type)}
                        onMouseEnter={(e) => handleCardEnter(e, component)}
                        onMouseLeave={handleCardLeave}
                        title={`${component.label} (${category}) - ${component.description}`}
                        className={`component-card group ${dragging === component.type ? 'component-dragging' : ''}`}
                        style={{ '--card-family-color': familyColor, borderColor: familyColor } as CSSProperties}
                      >
                        <span className="component-icon" style={{ color: familyColor, borderColor: `${familyColor}45` }}>
                          {Icon ? <Icon width={16} height={16} /> : <span className="text-sm">{getEmoji(component.type)}</span>}
                        </span>
                        <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-zinc-600 dark:text-zinc-300">{component.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && <p className="rounded-xl bg-zinc-50 dark:bg-zinc-800 p-4 text-xs text-zinc-400 dark:text-zinc-500">No components match "{query}". Try DB, storage, cache, API or queue.</p>}

        <div className="mt-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-500">Custom Components</span>
            <div className="flex gap-1">
              <button onClick={() => { const json = exportCustomComponents(); navigator.clipboard.writeText(json).catch(() => {}); }} className="rounded px-1.5 py-0.5 text-[9px] font-semibold text-zinc-400 hover:text-violet-500" title="Copy custom components JSON">Export</button>
              <button onClick={() => { const input = prompt('Paste custom components JSON:'); if (input) { try { setCustomDefs(importCustomComponents(input)) } catch { /* invalid */ } } }} className="rounded px-1.5 py-0.5 text-[9px] font-semibold text-zinc-400 hover:text-violet-500" title="Import custom components JSON">Import</button>
            </div>
          </div>
          {customDefs.map((c) => {
            const familyColor = '#8b5cf6'
            const def = toComponentDef(c)
            return (
              <div key={c.type} className="mb-1 flex items-center gap-2 rounded-lg border border-violet-200 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/20 px-2 py-1.5">
                <span
                  draggable
                  onDragStart={(e) => onDragStart(e, c.type)}
                  onDragEnd={() => setDragging(null)}
                  onClick={() => onTap(c.type)}
                  onMouseEnter={(e) => handleCardEnter(e, def)}
                  onMouseLeave={handleCardLeave}
                  className="flex flex-1 cursor-grab items-center gap-2"
                >
                  <span className="text-base">{c.icon}</span>
                  <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">{c.label}</span>
                </span>
                <button onClick={() => { setEditingCustom(c); setShowCustomModal(true) }} className="text-[9px] text-zinc-400 hover:text-violet-500">Edit</button>
                <button onClick={() => { deleteCustomComponent(c.type); setCustomDefs(getCustomComponents()) }} className="text-[9px] text-red-400 hover:text-red-600">✕</button>
              </div>
            )
          })}
          <button
            onClick={() => { setEditingCustom(null); setShowCustomModal(true) }}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-violet-200 dark:border-violet-800 py-3 text-xs font-semibold text-violet-500 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30"
          >
            + Create custom component
          </button>
        </div>
      </div>
      </aside>
      {renderHoverOverview()}
      {showCustomModal && <CustomComponentModal
        initial={editingCustom}
        onSave={(def) => { saveCustomComponent(def); setCustomDefs(getCustomComponents()); setShowCustomModal(false) }}
        onClose={() => setShowCustomModal(false)}
      />}
    </>
  )
}

function CustomComponentModal({ initial, onSave, onClose }: { initial: CustomComponentDef | null; onSave: (def: CustomComponentDef) => void; onClose: () => void }) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? '⚙')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [category, setCategory] = useState<ComponentCategory>(initial?.category ?? 'Custom')
  const [baseLatency, setBaseLatency] = useState(String(initial?.defaultConfig?.minLatencyMs ?? 20))
  const [maxLatency, setMaxLatency] = useState(String(initial?.defaultConfig?.maxLatencyMs ?? 100))
  const [maxConcurrency, setMaxConcurrency] = useState(String(initial?.defaultConfig?.maxConcurrency ?? 500))
  const [maxThroughput, setMaxThroughput] = useState(String(initial?.defaultConfig?.maxThroughput ?? 1000))

  const handleSubmit = () => {
    if (!label.trim()) return
    const type = initial?.type ?? `custom_${label.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`
    onSave({
      type,
      label: label.trim(),
      category,
      description: description.trim() || `Custom ${label.trim()} component`,
      icon: icon || '⚙',
      defaultConfig: {
        minLatencyMs: Number(baseLatency) || 20,
        maxLatencyMs: Number(maxLatency) || 100,
        maxConcurrency: Number(maxConcurrency) || 500,
        maxThroughput: Number(maxThroughput) || 1000,
      },
    })
  }

  const inputClass = 'w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-200 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 dark:focus:ring-violet-900/40'
  const labelClass = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500'

  return createPortal(
    <div className="modal-backdrop-enter fixed inset-0 z-[500] flex items-center justify-center bg-zinc-900/20 dark:bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="modal-content-enter w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{initial ? 'Edit' : 'Create'} custom component</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">✕</button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex gap-3">
            <div className="w-16">
              <label className={labelClass}>Icon</label>
              <input value={icon} onChange={(e) => setIcon(e.target.value)} className={inputClass + ' text-center text-lg'} maxLength={2} />
            </div>
            <div className="flex-1">
              <label className={labelClass}>Name</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} placeholder="e.g. Kafka Consumer" autoFocus />
            </div>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="What this component does" />
          </div>

          <div>
            <label className={labelClass}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as ComponentCategory)} className={inputClass}>
              {COMPONENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-3">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-violet-500">Simulation behavior</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Min latency (ms)</label>
                <input type="number" value={baseLatency} onChange={(e) => setBaseLatency(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Max latency (ms)</label>
                <input type="number" value={maxLatency} onChange={(e) => setMaxLatency(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Max concurrency</label>
                <input type="number" value={maxConcurrency} onChange={(e) => setMaxConcurrency(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Max throughput</label>
                <input type="number" value={maxThroughput} onChange={(e) => setMaxThroughput(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">Cancel</button>
          <button onClick={handleSubmit} disabled={!label.trim()} className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
            {initial ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}