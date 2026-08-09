import { COMPONENT_LIBRARY } from './nodes'

export default function Palette() {
  const onDragStart = (event: React.DragEvent, componentType: string) => {
    event.dataTransfer.setData('application/archflow-node', componentType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-2 border-r border-[#2e303a] bg-[#14151b] p-3">
      <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Components
      </h2>
      {COMPONENT_LIBRARY.map((c) => (
        <div
          key={c.type}
          draggable
          onDragStart={(e) => onDragStart(e, c.type)}
          className="flex cursor-grab items-center gap-2 rounded-lg border border-[#2e303a] bg-[#191b22] px-3 py-2 text-sm text-gray-200 hover:border-purple-400 active:cursor-grabbing"
        >
          <span className="text-lg">{c.icon}</span>
          <span>{c.label}</span>
        </div>
      ))}
      <p className="mt-2 px-1 text-xs text-gray-500">Drag a component onto the canvas to start.</p>
    </aside>
  )
}
