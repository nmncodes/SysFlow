import Canvas from './components/Canvas'

function App() {
  return (
    <div className="flex h-screen flex-col bg-[#0f1117] text-gray-200">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#2e303a] px-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-purple-400">SysFlow</span>
          <span className="text-sm text-gray-500">Untitled Project</span>
        </div>
        <div className="flex gap-2">
          <button className="rounded border border-[#2e303a] px-3 py-1.5 text-sm hover:border-purple-400">
            Save
          </button>
        </div>
      </header>

      <Canvas />

      <footer className="flex h-14 shrink-0 items-center justify-between border-t border-[#2e303a] px-4">
        <div className="flex gap-2">
          <button className="rounded bg-green-600/20 px-3 py-1.5 text-sm text-green-400 hover:bg-green-600/30">
            ▶ Run
          </button>
          <button className="rounded border border-[#2e303a] px-3 py-1.5 text-sm text-gray-400 hover:border-purple-400">
            ⏸ Pause
          </button>
          <button className="rounded border border-[#2e303a] px-3 py-1.5 text-sm text-gray-400 hover:border-purple-400">
            ⟲ Reset
          </button>
        </div>
        <button className="rounded bg-purple-600/20 px-3 py-1.5 text-sm text-purple-300 hover:bg-purple-600/30">
          🤖 Analyze
        </button>
      </footer>
    </div>
  )
}

export default App
