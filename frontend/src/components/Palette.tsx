import { useMemo, useState } from 'react'
import { COMPONENT_CATEGORIES, COMPONENT_LIBRARY } from './nodes'
import { COMPONENT_ICONS } from './icons'

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

export default function Palette({ onAdd, mobileOpen = false, onCloseMobile }: Props) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [recent, setRecent] = useState<string[]>([])
  const [dragging, setDragging] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COMPONENT_LIBRARY
    return COMPONENT_LIBRARY.filter((component) => {
      const haystack = [component.label, component.type, ...(SEARCH_ALIASES[component.label.toLowerCase()] ?? [])].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [query])

  const recentlyUsed = recent
    .map((type) => COMPONENT_LIBRARY.find((component) => component.type === type))
    .filter(Boolean)
    .slice(0, 4)

  const onDragStart = (event: React.DragEvent, componentType: string) => {
    event.dataTransfer.setData('application/archflow-node', componentType)
    event.dataTransfer.effectAllowed = 'move'
    setDragging(componentType)
    setRecent((items) => [componentType, ...items.filter((item) => item !== componentType)].slice(0, 6))
  }

  const onTap = (componentType: string) => {
    if (!onAdd) return
    setRecent((items) => [componentType, ...items.filter((item) => item !== componentType)].slice(0, 6))
    onAdd(componentType)
  }

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-zinc-900/20 dark:bg-black/50 md:hidden" onClick={onCloseMobile} />}
      <aside
        className={`component-sidebar fixed inset-x-0 bottom-0 z-40 flex h-[70vh] flex-col rounded-t-2xl border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl transition-transform md:static md:z-auto md:h-full md:w-[276px] md:shrink-0 md:translate-y-0 md:rounded-none md:border-t-0 md:border-l md:shadow-none ${mobileOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
      <div className="border-b border-zinc-100 dark:border-zinc-800 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Components</h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-300 dark:text-zinc-600">{COMPONENT_LIBRARY.length}</span>
            <button onClick={onCloseMobile} className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 md:hidden">✕</button>
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

      <div className="flex-1 overflow-y-auto p-3">
        {!query && recentlyUsed.length > 0 && (
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-500 dark:text-violet-400">Recently used</span>
              <span className="text-[9px] text-zinc-300 dark:text-zinc-600">{recentlyUsed.length}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {recentlyUsed.map((component) => {
                if (!component) return null
                const Icon = COMPONENT_ICONS[component.type]
                return <div key={component.type} draggable onDragStart={(e) => onDragStart(e, component.type)} onDragEnd={() => setDragging(null)} onClick={() => onTap(component.type)} title={component.label} className={`component-card group ${dragging === component.type ? 'component-dragging' : ''}`}><span className="component-icon"><Icon width={15} height={15} /></span><span className="line-clamp-1 text-[9px] font-semibold">{component.label}</span></div>
              })}
            </div>
          </div>
        )}

        {COMPONENT_CATEGORIES.map((category) => {
          const items = filtered.filter((component) => component.category === category)
          if (items.length === 0) return null
          const isCollapsed = collapsed[category]
          return (
            <div key={category} className="mb-4">
              <button onClick={() => setCollapsed((current) => ({ ...current, [category]: !current[category] }))} className="mb-2 flex w-full items-center justify-between px-1 text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{category}</span>
                <span className="text-[10px] text-zinc-300 dark:text-zinc-600">{isCollapsed ? '+' : '⌃'} {items.length}</span>
              </button>
              {!isCollapsed && (
                <div className="grid grid-cols-3 gap-1.5">
                  {items.map((component) => {
                    const Icon = COMPONENT_ICONS[component.type]
                    return (
                      <div
                        key={component.type}
                        draggable
                        onDragStart={(e) => onDragStart(e, component.type)}
                        onDragEnd={() => setDragging(null)}
                        onClick={() => onTap(component.type)}
                        title={`${component.label} — drag to canvas, or tap to add`}
                        className={`component-card group ${dragging === component.type ? 'component-dragging' : ''}`}
                      >
                        <span className="component-icon"><Icon width={16} height={16} /></span>
                        <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-zinc-600 dark:text-zinc-300">{component.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && <p className="rounded-xl bg-zinc-50 dark:bg-zinc-800 p-4 text-xs text-zinc-400 dark:text-zinc-500">No components match “{query}”. Try DB, storage, cache, API or queue.</p>}
      </div>
      </aside>
    </>
  )
}