import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LEARNING_PATHS, getCompletedChallenges, type Challenge, type LearningPath } from '../lib/learningPaths'
import ThemeToggle from '../components/ThemeToggle'
import logo from '../assets/logo.png'

const DIFF_STYLE: Record<Challenge['difficulty'], string> = {
  beginner: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20',
  intermediate: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20',
  advanced: 'bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/20',
}

const PATH_CONFIG: Record<string, { gradient: string; icon: string; accent: string }> = {
  foundations: { gradient: 'from-emerald-500 via-teal-500 to-cyan-500', icon: '🧱', accent: '#10b981' },
  'scale-up': { gradient: 'from-amber-500 via-orange-500 to-red-400', icon: '📈', accent: '#f59e0b' },
  resilience: { gradient: 'from-rose-500 via-pink-500 to-purple-500', icon: '🛡️', accent: '#f43f5e' },
}

function CountUp({ end, suffix = '' }: { end: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const counted = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || counted.current) return
      counted.current = true
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min((now - start) / 1500, 1)
        const ease = 1 - Math.pow(1 - t, 3)
        el.textContent = `${Math.round(ease * end)}${suffix}`
        if (t < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, { threshold: 0.3 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [end, suffix])
  return <span ref={ref}>0{suffix}</span>
}

function PathCard({ path, completed, onSelect, index }: { path: LearningPath; completed: Set<string>; onSelect: () => void; index: number }) {
  const done = path.challenges.filter((c) => completed.has(c.id)).length
  const total = path.challenges.length
  const pct = Math.round((done / total) * 100)
  const config = PATH_CONFIG[path.id] ?? { gradient: 'from-violet-500 to-purple-600', icon: '📘', accent: '#8b5cf6' }

  return (
    <button
      onClick={onSelect}
      className={`card-enter card-stagger-${index + 1} group relative w-full overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 bg-white dark:bg-zinc-800/90 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-black/20 hover:border-transparent`}
    >
      <div className={`relative bg-gradient-to-br ${config.gradient} px-6 py-6 overflow-hidden min-h-[160px] flex flex-col justify-end`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-xl transition-transform duration-500 group-hover:scale-150" />
        <span className="relative text-3xl drop-shadow-sm">{config.icon}</span>
        <h3 className="relative mt-2 text-lg font-bold text-white tracking-tight">{path.title}</h3>
        <p className="relative mt-1 text-[13px] leading-relaxed text-white/75">{path.description}</p>
      </div>

      <div className="px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {path.challenges.map((c, i) => (
              <div
                key={c.id}
                className={`h-2 w-2 rounded-full transition-colors ${completed.has(c.id) ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]' : i === 0 || completed.has(path.challenges[i-1]?.id) ? 'bg-zinc-300 dark:bg-zinc-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
              />
            ))}
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{done}/{total}</span>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700/50">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.max(pct > 0 ? 4 : 0, pct)}%`, background: `linear-gradient(90deg, ${config.accent}, ${config.accent}dd)` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${DIFF_STYLE[path.challenges[0].difficulty]}`}>{path.challenges[0].difficulty}</span>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{total} challenges</span>
          </div>
          <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 opacity-0 transition-opacity group-hover:opacity-100">Start →</span>
        </div>
      </div>
    </button>
  )
}

function PathDetail({ path, completed, onBack }: { path: LearningPath; completed: Set<string>; onBack: () => void }) {
  const navigate = useNavigate()
  const config = PATH_CONFIG[path.id] ?? { gradient: 'from-violet-500 to-purple-600', icon: '📘', accent: '#8b5cf6' }
  const done = path.challenges.filter((c) => completed.has(c.id)).length

  return (
    <div className="page-enter">
      <button onClick={onBack} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:-translate-x-0.5"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        All learning paths
      </button>

      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${config.gradient} px-8 py-8 sm:py-10`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.12),transparent_50%)]" />
        <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <span className="text-4xl">{config.icon}</span>
            <h2 className="mt-3 text-2xl font-bold text-white tracking-tight sm:text-3xl">{path.title}</h2>
            <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-white/75">{path.description}</p>
          </div>
          <div className="hidden sm:block text-right">
            <div className="text-3xl font-bold text-white">{done}<span className="text-white/50">/{path.challenges.length}</span></div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-white/50">Completed</div>
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {path.challenges.map((challenge, i) => {
          const isDone = completed.has(challenge.id)
          const prevDone = i === 0 || completed.has(path.challenges[i - 1].id)
          const locked = !prevDone && !isDone

          return (
            <div
              key={challenge.id}
              className={`card-enter card-stagger-${Math.min(i + 1, 8)} group relative overflow-hidden rounded-xl border bg-white dark:bg-zinc-800/90 transition-all duration-200 ${
                isDone
                  ? 'border-emerald-200 dark:border-emerald-800/50 shadow-sm'
                  : locked
                    ? 'border-zinc-100 dark:border-zinc-800 opacity-50'
                    : 'border-zinc-200 dark:border-zinc-700 shadow-sm hover:border-violet-300 dark:hover:border-violet-600 hover:shadow-md'
              }`}
            >
              {isDone && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />}

              <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-colors ${
                        isDone
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                          : locked
                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-300 dark:text-zinc-600'
                            : 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400'
                      }`}>
                        {isDone ? (
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 8l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        ) : locked ? (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        ) : (
                          i + 1
                        )}
                      </span>
                      <div>
                        <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{challenge.title}</h3>
                        <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${DIFF_STYLE[challenge.difficulty]}`}>{challenge.difficulty}</span>
                      </div>
                    </div>

                    <p className="mt-3 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{challenge.description}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {challenge.objectives.map((obj) => (
                        <span key={obj} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-100 dark:border-zinc-700/50 px-2.5 py-1 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                          <span className="h-1 w-1 rounded-full bg-violet-400" />
                          {obj}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center gap-6 text-[11px] font-semibold">
                      <span className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        {challenge.targetRps.toLocaleString()} RPS
                      </span>
                      <span className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5"/><path d="M6 3.5V6l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        p95 &lt; {challenge.maxP95Ms}ms
                      </span>
                      <span className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2L2 10h8L6 2z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 7v.5M6 5v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        Errors &lt; {challenge.maxErrorRate}%
                      </span>
                    </div>
                  </div>

                  <button
                    disabled={locked}
                    onClick={() => navigate(`/app?challengeId=${challenge.id}`)}
                    className={`shrink-0 rounded-xl px-5 py-2.5 text-[12px] font-semibold transition-all ${
                      isDone
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 ring-1 ring-emerald-200 dark:ring-emerald-800'
                        : locked
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-300 dark:text-zinc-600 cursor-not-allowed'
                          : 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-600/20 hover:shadow-md hover:shadow-violet-600/30 hover:-translate-y-0.5'
                    }`}
                  >
                    {isDone ? 'Retry' : locked ? 'Locked' : 'Start'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function LearnPage() {
  const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null)
  const completed = getCompletedChallenges()
  const totalChallenges = LEARNING_PATHS.reduce((s, p) => s + p.challenges.length, 0)
  const totalDone = LEARNING_PATHS.reduce((s, p) => s + p.challenges.filter(c => completed.has(c.id)).length, 0)

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-zinc-900">
      <header className="sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm font-medium text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200 transition-colors">← Home</Link>
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

      <main className="mx-auto max-w-5xl px-6 py-10">
        {selectedPath ? (
          <PathDetail path={selectedPath} completed={completed} onBack={() => setSelectedPath(null)} />
        ) : (
          <div className="page-enter">
            <div className="text-center page-enter-delay-1">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
                Learn by building
              </div>
              <h1 className="mt-5 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">Master System Design</h1>
              <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Go from blank canvas to production-ready architecture. Each path is a structured set of challenges with real performance targets - build it, simulate it, prove it works.
              </p>
            </div>

            <div className="mt-10 flex items-center justify-center gap-8 sm:gap-14 page-enter-delay-1">
              {[
                { end: totalChallenges, suffix: '', label: 'Challenges' },
                { end: 3, suffix: '', label: 'Skill levels' },
                { end: totalDone, suffix: `/${totalChallenges}`, label: 'Your progress' },
              ].map(({ end, suffix, label }) => (
                <div key={label} className="text-center">
                  <div className="text-2xl font-bold tracking-tight text-violet-600 dark:text-violet-400"><CountUp end={end} suffix={suffix} /></div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{label}</div>
                </div>
              ))}
            </div>

            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {LEARNING_PATHS.map((path, i) => (
                <PathCard key={path.id} path={path} completed={completed} onSelect={() => setSelectedPath(path)} index={i} />
              ))}
            </div>

            <div className="mt-12 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 bg-white dark:bg-zinc-800/90 overflow-hidden page-enter-delay-2">
              <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-700/50">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">How it works</h2>
              </div>
              <div className="grid gap-0 sm:grid-cols-3">
                {[
                  { step: '1', title: 'Pick a challenge', desc: 'Each one has specific RPS, latency, and error rate targets you must hit.', color: 'text-emerald-500' },
                  { step: '2', title: 'Build in the editor', desc: 'Drag components, connect them, configure settings - then run the simulation.', color: 'text-amber-500' },
                  { step: '3', title: 'Prove your solution', desc: 'One click grades your architecture against all targets. Green means you pass.', color: 'text-violet-500' },
                ].map(({ step, title, desc, color }, i) => (
                  <div key={step} className={`flex gap-4 p-6 ${i > 0 ? 'border-t sm:border-t-0 sm:border-l border-zinc-100 dark:border-zinc-700/50' : ''}`}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-900 text-sm font-bold ${color}`}>{step}</span>
                    <div>
                      <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
                      <p className="mt-1 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
