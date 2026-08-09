import { Link } from 'react-router-dom'
import { ClientIcon, DatabaseIcon, LoadBalancerIcon, ServiceIcon } from '../components/icons'

const FEATURES = [
  {
    title: 'Drag & drop architecture',
    desc: 'Assemble load balancers, services, caches, databases and queues on a clean, infinite canvas.',
  },
  {
    title: 'Live request simulation',
    desc: 'Watch traffic move through your design in real time. Slow particles mean high latency — you feel it.',
  },
  {
    title: 'Break it on purpose',
    desc: 'Kill a node, throttle a service, drop packets on an edge. See exactly how your design degrades.',
  },
  {
    title: 'AI design review',
    desc: 'Grounded, graph-specific feedback — single points of failure, missing caches, unprotected databases.',
  },
]

const STEPS = [
  { n: '01', title: 'Build', desc: 'Drag components onto the canvas and connect them like a whiteboard.' },
  { n: '02', title: 'Simulate', desc: 'Set a target load and run it. Watch traffic move through your system.' },
  { n: '03', title: 'Stress test', desc: 'Inject failures and watch the effects ripple across your design.' },
  { n: '04', title: 'Improve', desc: 'Apply AI-suggested fixes and re-run until it holds up.' },
]

const NAV_LINK = 'text-[13.5px] text-zinc-500 transition-colors hover:text-zinc-900'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 antialiased">
      <header className="sticky top-0 z-20 border-b border-zinc-100/80 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-[13px] font-semibold text-white">
              S
            </div>
            <span className="text-[14px] font-semibold tracking-tight">SysFlow</span>
          </div>
          <nav className="hidden items-center gap-9 sm:flex">
            <a href="#features" className={NAV_LINK}>Features</a>
            <a href="#how-it-works" className={NAV_LINK}>How it works</a>
          </nav>
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Open Editor
            <span aria-hidden>→</span>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-28 pt-24 text-center sm:pt-32">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(50%_50%_at_50%_0%,rgba(109,40,217,0.08),transparent)]"
        />
        <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-violet-600">
          Interactive System Design Simulator
        </p>
        <h1 className="mx-auto mt-6 max-w-3xl text-[42px] font-medium leading-[1.1] tracking-[-0.02em] text-zinc-900 sm:text-[64px]">
          Design systems that actually behave the way you think
        </h1>
        <p className="mx-auto mt-6 max-w-lg text-[16px] leading-relaxed text-zinc-500 sm:text-[17px]">
          Stop drawing static boxes and arrows. Build your architecture, run real traffic through
          it, and find the bottlenecks before production does.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link
            to="/app"
            className="rounded-full bg-zinc-900 px-6 py-3 text-[14px] font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Start building — it's free
          </Link>
          <a
            href="#how-it-works"
            className="rounded-full px-6 py-3 text-[14px] font-medium text-zinc-600 transition-colors hover:text-zinc-900"
          >
            See how it works
          </a>
        </div>

        {/* Preview mock */}
        <div className="relative mx-auto mt-20 max-w-4xl rounded-2xl border border-zinc-100 bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)]">
          <div className="flex items-center gap-1.5 border-b border-zinc-100 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
          </div>
          <div className="flex items-center justify-center gap-6 px-8 py-16 sm:gap-10">
            {[
              { Icon: ClientIcon, label: 'Client', status: 'healthy' },
              { Icon: LoadBalancerIcon, label: 'Load Balancer', status: 'healthy' },
              { Icon: ServiceIcon, label: 'Service', status: 'warning' },
              { Icon: DatabaseIcon, label: 'Database', status: 'critical' },
            ].map((n, i) => (
              <div key={n.label} className="flex items-center gap-6 sm:gap-10">
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-100 bg-white px-5 py-4">
                  <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-50 text-zinc-700">
                    <n.Icon />
                    <span
                      className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white"
                      style={{
                        background:
                          n.status === 'healthy' ? '#22c55e' : n.status === 'warning' ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </span>
                  <span className="text-xs font-medium text-zinc-600">{n.label}</span>
                </div>
                {i < 3 && <span className="hidden text-zinc-300 sm:block">→</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-5xl px-6 py-24">
        <div className="mx-auto max-w-lg text-center">
          <h2 className="text-[30px] font-medium tracking-[-0.01em] text-zinc-900">Built to build intuition</h2>
          <p className="mt-3 text-[15px] text-zinc-500">
            Every feature exists to make one thing true — you can look at your architecture and know how it will behave.
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="flex gap-4">
              <span className="mt-0.5 text-[13px] font-medium text-zinc-300">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3 className="text-[15px] font-medium text-zinc-900">{f.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-500">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-zinc-100 bg-zinc-50/50 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto max-w-lg text-center">
            <h2 className="text-[30px] font-medium tracking-[-0.01em] text-zinc-900">From idea to stress-tested design</h2>
            <p className="mt-3 text-[15px] text-zinc-500">Four steps. No deployment required.</p>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n}>
                <span className="text-[13px] font-medium text-violet-500">{s.n}</span>
                <h3 className="mt-2 text-[15px] font-medium text-zinc-900">{s.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-28 text-center">
        <h2 className="text-[32px] font-medium tracking-[-0.01em] text-zinc-900 sm:text-[38px]">
          Ready to see your system come alive?
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-[15px] text-zinc-500">
          Build your first architecture in under a minute. No account required to try it.
        </p>
        <Link
          to="/app"
          className="mt-8 inline-block rounded-full bg-zinc-900 px-7 py-3.5 text-[14px] font-medium text-white transition-colors hover:bg-zinc-700"
        >
          Open the editor →
        </Link>
      </section>

      <footer className="border-t border-zinc-100 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 text-[12.5px] text-zinc-400 sm:flex-row">
          <span>© 2026 SysFlow</span>
          <span>Built by Aryan, Naman, Aditya, Isha, Debojyoti</span>
        </div>
      </footer>
    </div>
  )
}
