import { useMemo, useState } from 'react'
import { COMPONENT_CATEGORIES, COMPONENT_LIBRARY } from './nodes'
import { COMPONENT_ICONS } from './icons'

export default function Palette() {
  const [query, setQuery] = useState('')

  const onDragStart = (event: React.DragEvent, componentType: string) => {
    event.dataTransfer.setData('application/archflow-node', componentType)
    event.dataTransfer.effectAllowed = 'move'
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COMPONENT_LIBRARY
    return COMPONENT_LIBRARY.filter((c) => c.label.toLowerCase().includes(q))
  }, [query])

  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 p-4">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Components</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search components..."
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {COMPONENT_CATEGORIES.map((category) => {
          const items = filtered.filter((c) => c.category === category)
          if (items.length === 0) return null
          return (
            <div key={category} className="mb-5">
              <div className="mb-2 flex items-center justify-between px-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{category}</span>
                <span className="text-[11px] text-zinc-300">{items.length}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {items.map((c) => {
                  const Icon = COMPONENT_ICONS[c.type]
                  return (
                    <div
                      key={c.type}
                      draggable
                      onDragStart={(e) => onDragStart(e, c.type)}
                      title={c.label}
                      className="group flex cursor-grab flex-col items-center gap-1.5 rounded-xl border border-zinc-100 bg-white px-2 py-3 text-center transition hover:border-violet-200 hover:bg-violet-50/40 active:cursor-grabbing"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-50 text-zinc-600 group-hover:bg-white group-hover:text-violet-600">
                        <Icon width={16} height={16} />
                      </span>
                      <span className="line-clamp-2 text-[11px] font-medium leading-tight text-zinc-600">
                        {c.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="px-1 text-xs text-zinc-400">No components match "{query}".</p>
        )}
      </div>
    </aside>
  )
}
