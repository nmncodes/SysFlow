import { COMPONENT_LIBRARY } from './nodes'

export default function Palette() {
  const onDragStart = (event: React.DragEvent, componentType: string) => {
    event.dataTransfer.setData('application/archflow-node', componentType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-1.5 overflow-y-auto border-r border-zinc-200 bg-white p-4">
      <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        Components
      </h2>
      {COMPONENT_LIBRARY.map((c) => (
        <div
          key={c.type}
          draggable
          onDragStart={(e) => onDragStart(e, c.type)}
          className="group flex cursor-grab items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-700 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-violet-200 hover:bg-violet-50/50 hover:shadow-sm active:cursor-grabbing"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-50 text-base group-hover:bg-white">
            {c.icon}
          </span>
          <span className="font-medium">{c.label}</span>
        </div>
      ))}
      <p className="mt-3 px-1 text-xs leading-relaxed text-zinc-400">
        Drag a component onto the canvas to start building.
      </p>
    </aside>
  )
}
