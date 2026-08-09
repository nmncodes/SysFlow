import { Link } from 'react-router-dom'
import Canvas from '../components/Canvas'

export default function EditorPage() {
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
        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50">
            Save
          </button>
          <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800">
            Share
          </button>
        </div>
      </header>

      <Canvas />

      <footer className="flex h-16 shrink-0 items-center justify-between border-t border-zinc-200 bg-white/80 px-6 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm ring-1 ring-emerald-100 transition hover:bg-emerald-100">
            <span>▶</span> Run
          </button>
          <button className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-500 shadow-sm transition hover:border-zinc-300 hover:text-zinc-700">
            ⏸ Pause
          </button>
          <button className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-500 shadow-sm transition hover:border-zinc-300 hover:text-zinc-700">
            ⟲ Reset
          </button>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90">
          <span>✨</span> Analyze
        </button>
      </footer>
    </div>
  )
}
