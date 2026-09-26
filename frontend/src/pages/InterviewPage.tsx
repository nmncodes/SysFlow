import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listInterviewPrompts, type InterviewPrompt } from '../lib/api'
import logo from '../assets/logo.png'

const DIFFICULTY_STYLE: Record<string, string> = {
  Easy: 'bg-emerald-50 text-emerald-600',
  Medium: 'bg-amber-50 text-amber-600',
  Hard: 'bg-red-50 text-red-600',
}

export default function InterviewPage() {
  const navigate = useNavigate()
  const [prompts, setPrompts] = useState<InterviewPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listInterviewPrompts()
      .then(setPrompts)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load prompts'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="SysFlow" className="h-8 w-8 object-contain" />
            <span className="text-[14px] font-semibold tracking-tight">SysFlow</span>
          </Link>
          <Link to="/app" className="text-sm font-medium text-zinc-700 hover:text-zinc-900">Editor</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">System design interview practice</h1>
        <p className="mt-2 text-sm text-zinc-500">Pick a prompt, build your architecture in the editor, then submit it for AI grading against a 4-part rubric — scalability, reliability, component choices, and whether you actually addressed the problem's core trade-off.</p>

        {loading ? (
          <p className="mt-6 text-sm text-zinc-400">Loading…</p>
        ) : error ? (
          <p className="mt-6 text-sm text-red-500">{error}</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {prompts.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/app?interviewPromptId=${p.id}`)}
                className="hover-lift rounded-2xl border border-zinc-200 bg-white p-5 text-left transition hover:border-violet-200 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900">{p.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${DIFFICULTY_STYLE[p.difficulty] ?? 'bg-zinc-100 text-zinc-500'}`}>{p.difficulty}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">{p.brief}</p>
                <ul className="mt-3 space-y-1">
                  {p.keyConsiderations.slice(0, 2).map((k) => (
                    <li key={k} className="text-[11px] text-zinc-400">· {k}</li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
