import { useEffect, useLayoutEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listInterviewPrompts, type InterviewPrompt } from '../lib/api'
import ThemeToggle from '../components/ThemeToggle'
import logo from '../assets/logo.png'

const DIFFICULTY_STYLE: Record<string, string> = {
  Easy: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  Medium: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  Hard: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
}

function PromptCard({ p, i, onOpen }: { p: InterviewPrompt; i: number; onOpen: () => void }) {
  const navigate = useNavigate()

  return (
    <div className={`card-enter card-stagger-${Math.min(i + 1, 8)} group rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 overflow-hidden transition hover:border-violet-300 dark:hover:border-violet-600 hover:shadow-md`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{p.title}</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400 line-clamp-2">{p.brief}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${DIFFICULTY_STYLE[p.difficulty] ?? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'}`}>{p.difficulty}</span>
        </div>

        {p.hldComponents?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {p.hldComponents.slice(0, 5).map((c) => (
              <span key={c} className="rounded bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 text-[9px] font-medium text-blue-600 dark:text-blue-400">{c}</span>
            ))}
            {p.hldComponents.length > 5 && <span className="text-[9px] text-zinc-400 self-center">+{p.hldComponents.length - 5}</span>}
          </div>
        )}
      </div>

      <div className="flex border-t border-zinc-100 dark:border-zinc-700/50">
        <button onClick={onOpen} className="flex-1 px-3 py-2 text-[10px] font-medium text-zinc-400 dark:text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 hover:text-zinc-700 dark:hover:text-zinc-200 transition">Details</button>
        <button onClick={() => navigate(`/app?interviewPromptId=${p.id}`)} className="flex-1 border-l border-zinc-100 dark:border-zinc-700/50 px-3 py-2 text-[10px] font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition">Start →</button>
      </div>
    </div>
  )
}

function PromptDetail({ p, onBack }: { p: InterviewPrompt; onBack: () => void }) {
  const navigate = useNavigate()

  return (
    <div className="page-enter">
      <button onClick={onBack} className="mb-4 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300">← All prompts</button>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-6 py-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">{p.title}</h2>
            <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase bg-white/20 text-white">{p.difficulty}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-white/80">{p.brief}</p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Key trade-offs to address</h3>
            <ul className="mt-2 space-y-2">
              {p.keyConsiderations.map((k) => (
                <li key={k} className="flex gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                  {k}
                </li>
              ))}
            </ul>
          </div>

          {p.hldComponents?.length > 0 && (
            <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">High-Level Design - Expected components</h3>
              <p className="mt-1 text-[11px] text-blue-500/70 dark:text-blue-400/60">Building blocks a strong solution typically includes</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {p.hldComponents.map((c) => (
                  <span key={c} className="rounded-lg bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-800 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 shadow-sm">{c}</span>
                ))}
              </div>
            </div>
          )}

          {p.lldDetails?.length > 0 && (
            <div className="rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Low-Level Design - Implementation details</h3>
              <p className="mt-1 text-[11px] text-amber-500/70 dark:text-amber-400/60">Database schemas, API contracts, algorithms, and protocol choices</p>
              <ul className="mt-3 space-y-2">
                {p.lldDetails.map((d) => (
                  <li key={d} className="flex gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                    <code className="font-mono text-[11px]">{d}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-100 dark:border-zinc-700/50 px-6 py-4 flex justify-end">
          <button onClick={() => navigate(`/app?interviewPromptId=${p.id}`)} className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition shadow-sm">Start this challenge</button>
        </div>
      </div>
    </div>
  )
}

export default function InterviewPage() {
  const navigate = useNavigate()
  const [prompts, setPrompts] = useState<InterviewPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<InterviewPrompt | null>(null)

  useLayoutEffect(() => { window.scrollTo(0, 0) }, [])

  useEffect(() => {
    listInterviewPrompts()
      .then(setPrompts)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load prompts'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-zinc-900">
      <header className="sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-sm font-medium text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200 transition-colors">← Back</button>
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="SysFlow" className="h-8 w-8 object-contain" />
              <span className="text-[14px] font-semibold tracking-tight dark:text-zinc-100">SysFlow</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link to="/app" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100">Editor</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 page-enter">
        {selected ? (
          <PromptDetail p={selected} onBack={() => setSelected(null)} />
        ) : (
          <>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-8 sm:p-10 page-enter-delay-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">System design interview practice</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">Pick a prompt, build your architecture in the editor, then submit for AI grading against a 4-part rubric - scalability, reliability, component choices, and core trade-offs.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />AI-graded</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm"><span className="h-1.5 w-1.5 rounded-full bg-blue-400" />HLD + LLD</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Real interview prompts</span>
              </div>
            </div>

            {loading ? (
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[1,2,3,4].map(i => <div key={i} className="skeleton-shimmer h-32 rounded-2xl" />)}
              </div>
            ) : error ? (
              <p className="mt-6 text-sm text-red-500">{error}</p>
            ) : (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {prompts.map((p, i) => (
                  <PromptCard key={p.id} p={p} i={i} onOpen={() => setSelected(p)} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
