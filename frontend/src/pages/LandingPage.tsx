import { Link } from 'react-router-dom'

const FEATURES = [
  {
    icon: '🧩',
    title: 'Drag & drop architecture',
    desc: 'Assemble load balancers, services, caches, databases and queues on a clean, infinite canvas — no code required.',
  },
  {
    icon: '⚡',
    title: 'Live request simulation',
    desc: 'Watch animated traffic flow through your design in real time. Slow particles mean high latency — you feel it, not just read it.',
  },
  {
    icon: '🔥',
    title: 'Break it on purpose',
    desc: 'Kill a node, throttle a service, drop packets on an edge — see exactly how your design degrades under failure.',
  },
  {
    icon: '🤖',
    title: 'AI design review',
    desc: 'Get grounded, graph-specific feedback — single points of failure, missing caches, unprotected databases — before they cost you.',
  },
]

const STEPS = [
  { n: '01', title: 'Build', desc: 'Drag components onto the canvas and connect them like you would on a whiteboard.' },
  { n: '02', title: 'Simulate', desc: 'Set a target load and run it. Watch traffic move through your system live.' },
  { n: '03', title: 'Stress test', desc: 'Inject failures and see cascading effects ripple across your architecture.' },
  { n: '04', title: 'Improve', desc: 'Apply AI-suggested fixes and re-run until your design holds up.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow-sm">
            S
          </div>
          <span className="text-[15px] font-semibold tracking-tight">SysFlow</span>
        </div>
        <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-500 sm:flex">
          <a href="#features" className="transition hover:text-zinc-900">Features</a>
          <a href="#how-it-works" className="transition hover:text-zinc-900">How it works</a>
        </nav>
        <Link
          to="/app"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
        >
          Open Editor →
        </Link>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl overflow-hidden px-6 pb-24 pt-16 text-center sm:pt-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(124,58,237,0.10),transparent)]"
        />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
          Interactive System Design Simulator
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-zinc-900 sm:text-6xl">
          Design systems that <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">actually behave</span> the way you think
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-500 sm:text-lg">
          Stop drawing static boxes and arrows. Build your architecture, run real traffic through it,
          break it on purpose, and see the bottlenecks before production does.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <Link
            to="/app"
            className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition hover:opacity-90"
          >
            Start Building — it's free
          </Link>
          <a
            href="#how-it-works"
            className="rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            See how it works
          </a>
        </div>

        {/* Preview mock */}
        <div className="relative mx-auto mt-16 max-w-4xl rounded-2xl border border-zinc-200 bg-white p-3 shadow-2xl shadow-zinc-200/60">
          <div className="flex items-center gap-1.5 border-b border-zinc-100 px-3 pb-3">
            <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          </div>
          <div className="flex items-center justify-center gap-6 px-8 py-14 sm:gap-10">
            {[
              { icon: '🧑', label: 'Client', ring: '#22c55e' },
              { icon: '🔀', label: 'Load Balancer', ring: '#22c55e' },
              { icon: '⬡', label: 'Service', ring: '#f59e0b' },
              { icon: '🛢️', label: 'Database', ring: '#ef4444' },
            ].map((n, i) => (
              <div key={n.label} className="flex items-center gap-6 sm:gap-10">
                <div
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-white bg-white px-4 py-3.5"
                  style={{ boxShadow: `0 0 0 1.5px ${n.ring}55, 0 1px 3px rgba(0,0,0,0.04)` }}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-50 text-xl">
                    {n.icon}
                  </span>
                  <span className="text-xs font-medium text-zinc-700">{n.label}</span>
                </div>
                {i < 3 && <span className="hidden text-zinc-300 sm:block">→</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">Built to build intuition</h2>
          <p className="mt-3 text-zinc-500">Every feature exists to make one thing true: you can look at your architecture and know how it will behave.</p>
        </div>
        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-zinc-200 bg-white p-6 transition hover:border-violet-200 hover:shadow-md">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-xl">
                {f.icon}
              </span>
              <h3 className="mt-4 text-base font-semibold text-zinc-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-zinc-100 bg-zinc-50/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">From idea to stress-tested design</h2>
            <p className="mt-3 text-zinc-500">Four steps, no deployment required.</p>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n}>
                <span className="text-sm font-semibold text-violet-500">{s.n}</span>
                <h3 className="mt-2 text-base font-semibold text-zinc-900">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">Ready to see your system come alive?</h2>
        <p className="mx-auto mt-3 max-w-md text-zinc-500">Build your first architecture in under a minute — no account required to try it.</p>
        <Link
          to="/app"
          className="mt-8 inline-block rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition hover:opacity-90"
        >
          Open the Editor →
        </Link>
      </section>

      <footer className="border-t border-zinc-100 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-xs text-zinc-400">
          <span>© 2026 SysFlow</span>
          <span>Built by Aryan, Naman, Aditya, Isha, Debojyoti</span>
        </div>
      </footer>
    </div>
  )
}
