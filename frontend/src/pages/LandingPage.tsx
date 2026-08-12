import { Link } from 'react-router-dom'
import {
  CacheIcon,
  CdnIcon,
  ClientIcon,
  DatabaseIcon,
  GatewayIcon,
  LoadBalancerIcon,
  QueueIcon,
  ServiceIcon,
} from '../components/icons'
import { useInView } from '../lib/useInView'
import logo from '../assets/logo.png'

const BLUE = '#12b8d4'
const BLUE_DARK = '#079fbb'

const FEATURES = [
  {
    title: 'Drag & drop architecture',
    desc: 'Assemble gateways, services, caches, databases and queues on an infinite visual canvas.',
  },
  {
    title: 'Live request simulation',
    desc: 'Watch traffic move through your design and see latency, throughput and failures change in real time.',
  },
  {
    title: 'Break it on purpose',
    desc: 'Kill a node, throttle a service or drop packets on an edge. See how failures ripple through the system.',
  },
  {
    title: 'AI design review',
    desc: 'Get architecture-specific feedback on bottlenecks, single points of failure and risky design choices.',
  },
]

const STEPS = [
  { n: '01', title: 'Build', desc: 'Drag components onto the canvas and connect them like a whiteboard.' },
  { n: '02', title: 'Simulate', desc: 'Set a target load and watch requests travel through your system.' },
  { n: '03', title: 'Stress test', desc: 'Inject failures and see the effects ripple across your architecture.' },
  { n: '04', title: 'Improve', desc: 'Apply the findings, re-run the simulation and compare the result.' },
]

const TEMPLATES = [
  { name: '3-Tier Application', desc: 'Client, load balancer, service and database.', accent: '3-TIER' },
  { name: 'URL Shortener', desc: 'Gateway, redirect service, cache and database.', accent: 'READ-HEAVY' },
  { name: 'Chat Application', desc: 'API, queue, workers and persistent storage.', accent: 'ASYNC' },
]

const NAV_LINK =
  'group relative text-[16px] font-semibold text-zinc-500 transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.04] hover:text-[#079fbb]'

function CircuitBackdrop({
  variant = 'grid',
  className = '',
}: {
  variant?: 'grid' | 'glow'
  className?: string
}) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            variant === 'grid'
              ? 'radial-gradient(circle at 50% 25%, rgba(18,184,212,0.10), transparent 32%), radial-gradient(circle at 15% 70%, rgba(56,189,248,0.05), transparent 28%), radial-gradient(circle at 85% 65%, rgba(14,165,233,0.045), transparent 28%)'
              : 'radial-gradient(circle at 50% 50%, rgba(18,184,212,0.12), transparent 42%), radial-gradient(circle at 20% 45%, rgba(56,189,248,0.055), transparent 24%), radial-gradient(circle at 80% 55%, rgba(56,189,248,0.055), transparent 24%)',
        }}
      />
      {variant === 'grid' && (
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(18,184,212,0.22) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 82%, transparent 100%)',
          }}
        />
      )}
      <svg className="absolute inset-0 h-full w-full opacity-45" viewBox="0 0 1440 760" fill="none" preserveAspectRatio="none">
        <g stroke="#12b8d4" strokeWidth="1.2">
          <path d="M0 180H74V118H154" />
          <path d="M0 300H122V246H210V170H274" />
          <path d="M1440 168H1362V106H1290" />
          <path d="M1440 330H1320V272H1235V204H1170" />
          <path d="M84 760V690H154V620H232" />
          <path d="M1358 760V680H1288V610H1208" />
        </g>
        <g fill="#12b8d4">
          <circle cx="154" cy="118" r="3" />
          <circle cx="210" cy="246" r="3" />
          <circle cx="1290" cy="106" r="3" />
          <circle cx="1235" cy="272" r="3" />
          <circle cx="154" cy="690" r="3" />
          <circle cx="1288" cy="680" r="3" />
        </g>
        <g stroke="#9fe8f2" strokeWidth="1" opacity="0.75">
          <circle cx="180" cy="190" r="62" />
          <circle cx="180" cy="190" r="86" />
          <circle cx="1260" cy="205" r="70" />
          <circle cx="1260" cy="205" r="98" />
        </g>
      </svg>
    </div>
  )
}
function FlowPath({
  d,
  critical = false,
  duration = 1.4,
}: {
  d: string
  critical?: boolean
  duration?: number
}) {
  const color = critical ? '#ef4444' : BLUE
  return (
    <g aria-hidden>
      <path
        d={d}
        fill="none"
        stroke={critical ? '#fecaca' : '#cdeff4'}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <circle r="4.5" fill={color}>
        <animateMotion dur={`${duration}s`} repeatCount="indefinite" path={d} />
      </circle>
    </g>
  )
}

function PreviewNode({
  Icon,
  label,
  meta,
  left,
  top,
  critical = false,
  accent = false,
}: {
  Icon: typeof ClientIcon
  label: string
  meta: string
  left: string
  top: string
  critical?: boolean
  accent?: boolean
}) {
  return (
    <div
      className={`absolute z-10 w-[132px] -translate-x-1/2 rounded-2xl border bg-white/96 p-4 shadow-[0_14px_32px_-16px_rgba(15,23,42,0.35)] backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 ${
        critical
          ? 'border-red-200 shadow-[0_16px_36px_-16px_rgba(239,68,68,0.25)]'
          : accent
            ? 'border-[#8de3ee] shadow-[0_16px_36px_-18px_rgba(18,184,212,0.22)]'
            : 'border-zinc-200'
      }`}
      style={{ left, top }}
    >
      <div className="flex items-center justify-between">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            critical ? 'bg-red-50 text-red-500' : accent ? 'bg-[#e8faff] text-[#079fbb]' : 'bg-zinc-50 text-zinc-700'
          }`}
        >
          <Icon width={22} height={22} />
        </span>
        <span
          className={`h-3 w-3 rounded-full border-2 border-white ${
            critical ? 'live-dot bg-red-500' : 'bg-emerald-500'
          }`}
        />
      </div>
      <div className="mt-3 truncate text-[14px] font-bold text-zinc-800">{label}</div>
      <div className={`mt-1 text-[11px] ${critical ? 'text-red-500' : 'text-zinc-400'}`}>{meta}</div>
    </div>
  )
}

export default function LandingPage() {
  const features = useInView<HTMLDivElement>()
  const howItWorks = useInView<HTMLDivElement>()
  const templates = useInView<HTMLDivElement>()
  const cta = useInView<HTMLDivElement>()

  return (
    <div className="min-h-screen bg-[#fafdfe] text-zinc-900 antialiased">
      <header className="sticky top-0 z-50 border-b border-zinc-200/70 bg-white/88 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-3" aria-label="SysFlow home">
            <img src={logo} alt="SysFlow" className="h-12 w-12 object-contain" />
            <span className="text-[23px] font-bold tracking-[-0.035em] text-[#0f172a]">SysFlow</span>
          </Link>

          <nav className="hidden items-center gap-9 sm:flex">
            <a href="#features" className={NAV_LINK}>
              Features
              <span className="absolute -bottom-2 left-0 h-[2px] w-0 rounded-full bg-[#12b8d4] transition-all duration-200 group-hover:w-full" />
            </a>
            <a href="#how-it-works" className={NAV_LINK}>
              How it works
              <span className="absolute -bottom-2 left-0 h-[2px] w-0 rounded-full bg-[#12b8d4] transition-all duration-200 group-hover:w-full" />
            </a>
            <a href="#templates" className={NAV_LINK}>
              Templates
              <span className="absolute -bottom-2 left-0 h-[2px] w-0 rounded-full bg-[#12b8d4] transition-all duration-200 group-hover:w-full" />
            </a>
          </nav>

          <Link
            to="/app"
            className="btn-dark inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[14px] font-semibold transition-all hover:-translate-y-0.5"
          >
            Open Editor
            <span aria-hidden>→</span>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#fbfeff] px-6 pb-20 pt-14 sm:pt-16">
        <CircuitBackdrop variant="grid" className="opacity-75" />

        <div className="relative z-10 mx-auto max-w-6xl text-center">
          <div className="hero-in inline-flex items-center gap-2 rounded-full border border-[#b8edf4] bg-white/85 px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.13em] text-[#079fbb] shadow-[0_8px_24px_-18px_rgba(18,184,212,0.8)] backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-[#12b8d4] shadow-[0_0_0_4px_rgba(18,184,212,0.12)]" />
            Interactive system design simulator
          </div>

          <h1 className="hero-in hero-in-delay-1 mx-auto mt-7 max-w-4xl text-[44px] font-semibold leading-[1.02] tracking-[-0.045em] text-[#0f172a] sm:text-[64px]">
            Design your system.
            <br />
            <span className="relative inline-block pb-3 text-[#079fbb]">
              Find what breaks.
              <span
                aria-hidden
                className="absolute -bottom-1 left-[2%] right-[2%] h-2.5 rounded-full bg-[#bff2f7] opacity-95"
              />
            </span>
          </h1>

          <p className="hero-in hero-in-delay-2 mx-auto mt-7 max-w-2xl text-[17px] leading-7 text-zinc-500 sm:text-[19px]">
            Build architectures visually, simulate real traffic, inject failures and understand bottlenecks before deployment.
          </p>

          <div className="hero-in hero-in-delay-3 mt-9 flex items-center justify-center gap-3">
            <Link
              to="/app"
              className="btn-dark rounded-full px-7 py-3.5 text-[16px] font-semibold transition-all shadow-[0_12px_28px_-14px_rgba(15,23,42,0.55)] hover:-translate-y-0.5"
            >
              Start building — it's free
            </Link>
            <a
              href="#how-it-works"
              className="rounded-full border border-zinc-200 bg-white/85 px-6 py-3.5 text-[15px] font-semibold text-zinc-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#a7e8f1] hover:text-[#079fbb]"
            >
              See how it works
            </a>
          </div>

          {/* Live system preview */}
          <div className="hero-in hero-in-delay-4 relative mx-auto mt-14 max-w-[1080px] overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white/96 text-left shadow-[0_30px_80px_-30px_rgba(15,23,42,0.28)] backdrop-blur-xl">
            <CircuitBackdrop variant="glow" className="opacity-35" />

            <div className="relative z-10 flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
                </div>
                <span className="hidden text-[12px] font-medium text-zinc-400 sm:inline">checkout · friday traffic surge</span>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-600 ring-1 ring-red-100">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-red-500" />
                BOTTLENECK DETECTED
              </span>
            </div>

            <div className="relative z-10 grid grid-cols-2 divide-x divide-y divide-zinc-100 sm:grid-cols-4 sm:divide-y-0">
              {[
                { label: 'Error rate', value: '8.6%', tone: 'text-red-500' },
                { label: 'p95 latency', value: '418ms', tone: 'text-[#079fbb]' },
                { label: 'Throughput', value: '4.2k rps', tone: 'text-[#079fbb]' },
                { label: 'Open issues', value: '3', tone: 'text-red-500' },
              ].map((s) => (
                <div key={s.label} className="px-4 py-4 text-center sm:py-4.5">
                  <div className={`text-[25px] font-semibold tracking-[-0.03em] ${s.tone}`}>{s.value}</div>
                  <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-400">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="relative z-10 border-t border-zinc-100 bg-white/75 px-4 py-5 sm:px-7 sm:py-5.5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-bold text-zinc-800">Live architecture</div>
                  <div className="mt-0.5 text-[11px] text-zinc-400">Requests are flowing through the system</div>
                </div>
                <div className="hidden items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-zinc-500 sm:flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#12b8d4]" />
                  Simulation running
                </div>
              </div>

              <div className="relative mx-auto h-[350px] w-full overflow-hidden rounded-2xl border border-zinc-100 bg-white/88 shadow-[inset_0_1px_8px_rgba(15,23,42,0.025)]">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-75"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.035) 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                  }}
                />

                <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 350" preserveAspectRatio="none" aria-hidden>
                  <FlowPath d="M112 105 H208" duration={0.9} />
                  <FlowPath d="M312 105 H408" duration={1.0} />
                  <FlowPath d="M512 105 H608" duration={1.1} />
                  <FlowPath d="M712 105 H808" critical duration={1.65} />
                  <FlowPath d="M808 135 C808 175 500 180 500 230" duration={1.3} />
                  <FlowPath d="M808 135 C808 175 650 190 650 230" critical duration={1.7} />
                  <FlowPath d="M808 135 C808 175 800 190 800 230" duration={1.4} />
                </svg>

                <PreviewNode Icon={ClientIcon} label="Client" meta="1.2k rps" left="10%" top="62px" accent />
                <PreviewNode Icon={CdnIcon} label="CDN" meta="edge cache" left="30%" top="62px" />
                <PreviewNode Icon={GatewayIcon} label="API Gateway" meta="healthy" left="50%" top="62px" accent />
                <PreviewNode Icon={LoadBalancerIcon} label="Load Balancer" meta="4.2k rps" left="70%" top="62px" />
                <PreviewNode Icon={ServiceIcon} label="Order Service" meta="87% capacity" left="90%" top="62px" critical />
                <PreviewNode Icon={CacheIcon} label="Cache" meta="62% hit rate" left="57%" top="220px" />
                <PreviewNode Icon={DatabaseIcon} label="Database" meta="418ms p95" left="75%" top="220px" critical />
                <PreviewNode Icon={QueueIcon} label="Queue" meta="1.8k pending" left="93%" top="220px" />

                <div className="absolute bottom-3 left-3 rounded-xl border border-red-100 bg-white/94 px-3 py-2 shadow-sm backdrop-blur sm:left-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="text-[11px] font-semibold text-red-600">Bottleneck</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-400">Order Service → Database</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative overflow-hidden border-t border-zinc-200/60 bg-[#f8fcfd] px-6 py-20 sm:py-24">
        <CircuitBackdrop variant="grid" className="opacity-45" />

        <div className="relative z-10 mx-auto max-w-6xl">
          <div ref={features.ref} className={`reveal ${features.inView ? 'in-view' : ''} mx-auto max-w-3xl text-center`}>
            <div className="mx-auto mb-5 inline-flex rounded-full border border-[#b8edf4] bg-white/90 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#079fbb] shadow-sm">
              Built for systems thinking
            </div>
            <h2 className="text-[36px] font-bold tracking-[-0.04em] text-[#0f172a] sm:text-[46px]">
              Understand how your architecture behaves.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-7 text-zinc-500 sm:text-[18px]">
              Every feature exists to turn an architecture diagram into something you can reason about, stress and improve.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className={`reveal hover-lift ${features.inView ? 'in-view' : ''} rounded-2xl border border-zinc-200/80 bg-white/94 p-8 shadow-[0_16px_45px_-25px_rgba(15,23,42,0.20)] transition-all duration-300 hover:border-[#8de3ee] hover:shadow-[0_22px_55px_-22px_rgba(18,184,212,0.34)]`}
                style={{ transitionDelay: features.inView ? `${i * 90}ms` : '0ms' }}
              >
                <div className="flex items-start justify-between">
                  <span className="text-[18px] font-extrabold tracking-[0.12em] text-[#12b8d4]">{String(i + 1).padStart(2, '0')}</span>
                  <span className="h-3 w-3 rounded-full bg-[#c9f5fa] shadow-[0_0_0_5px_rgba(201,245,250,0.4)]" />
                </div>
                <h3 className="mt-8 text-[21px] font-bold text-[#0f172a]">{f.title}</h3>
                <p className="mt-3 text-[16px] leading-7 text-zinc-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates */}
      <section id="templates" className="relative overflow-hidden border-y border-zinc-200/70 bg-[#eef9fb] py-20 sm:py-24">
        <CircuitBackdrop variant="glow" className="opacity-45" />

        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div ref={templates.ref} className={`reveal ${templates.inView ? 'in-view' : ''} flex flex-col justify-between gap-5 sm:flex-row sm:items-end`}>
            <div>
              <div className="mb-4 inline-flex rounded-full border border-[#b8edf4] bg-white/90 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#079fbb]">
                Start faster
              </div>
              <h2 className="text-[36px] font-bold tracking-[-0.04em] text-[#0f172a] sm:text-[46px]">Start from a real architecture.</h2>
              <p className="mt-4 max-w-xl text-[17px] leading-7 text-zinc-500">Pick a template, change the topology and see where it breaks under load.</p>
            </div>
            <Link to="/app" className="text-[15px] font-bold text-[#079fbb] transition-all hover:translate-x-1 hover:text-[#057f95]">Browse in editor →</Link>
          </div>

          <div className="mt-11 grid grid-cols-1 gap-5 md:grid-cols-3">
            {TEMPLATES.map((template, i) => (
              <Link
                key={template.name}
                to="/app"
                className={`reveal hover-lift ${templates.inView ? 'in-view' : ''} group rounded-2xl border border-zinc-200/80 bg-white/96 p-7 shadow-[0_16px_45px_-25px_rgba(15,23,42,0.22)] transition-all duration-300 hover:-translate-y-1 hover:border-[#8de3ee] hover:shadow-[0_24px_55px_-22px_rgba(18,184,212,0.30)]`}
                style={{ transitionDelay: templates.inView ? `${i * 90}ms` : '0ms' }}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[#effcff] px-3 py-1.5 text-[11px] font-bold tracking-[0.1em] text-[#079fbb]">{template.accent}</span>
                  <span className="text-[16px] text-zinc-300 transition-colors group-hover:text-[#12b8d4]">→</span>
                </div>

                <div className="mt-7 flex h-28 items-center justify-center rounded-xl border border-zinc-100 bg-[#fbfdfe] shadow-inner">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-[#079fbb] shadow-sm"><ClientIcon width={19} height={19} /></span>
                    <span className="h-px w-5 bg-[#bdeef4]" />
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 shadow-sm"><GatewayIcon width={19} height={19} /></span>
                    <span className="h-px w-5 bg-[#bdeef4]" />
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 shadow-sm"><ServiceIcon width={19} height={19} /></span>
                    <span className="h-px w-5 bg-[#bdeef4]" />
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 shadow-sm"><DatabaseIcon width={19} height={19} /></span>
                  </div>
                </div>

                <h3 className="mt-6 text-[19px] font-bold text-[#0f172a]">{template.name}</h3>
                <p className="mt-2 text-[15px] leading-6 text-zinc-500">{template.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative overflow-hidden border-b border-zinc-200/70 bg-[#fafdfe] py-20 sm:py-24">
        <CircuitBackdrop variant="grid" className="opacity-35" />

        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div ref={howItWorks.ref} className={`reveal ${howItWorks.inView ? 'in-view' : ''} mx-auto max-w-3xl text-center`}>
            <div className="mx-auto mb-5 inline-flex rounded-full border border-[#b8edf4] bg-white/90 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#079fbb]">
              How SysFlow works
            </div>
            <h2 className="text-[36px] font-bold tracking-[-0.04em] text-[#0f172a] sm:text-[46px]">From idea to stress-tested design.</h2>
            <p className="mt-5 text-[17px] leading-7 text-zinc-500 sm:text-[18px]">Four steps. No deployment required.</p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className={`reveal ${howItWorks.inView ? 'in-view' : ''} rounded-2xl border border-zinc-200/80 bg-white/94 p-7 shadow-[0_16px_42px_-28px_rgba(15,23,42,0.22)] transition-all duration-300 hover:-translate-y-1 hover:border-[#8de3ee] hover:shadow-[0_22px_50px_-24px_rgba(18,184,212,0.25)]`}
                style={{ transitionDelay: howItWorks.inView ? `${i * 90}ms` : '0ms' }}
              >
                <span className="text-[19px] font-extrabold tracking-[0.12em] text-[#12b8d4]">{s.n}</span>
                <h3 className="mt-8 text-[21px] font-bold text-[#0f172a]">{s.title}</h3>
                <p className="mt-3 text-[16px] leading-7 text-zinc-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden px-6 py-24 text-center sm:py-28">
        <CircuitBackdrop variant="glow" className="opacity-40" />
        <div ref={cta.ref} className={`relative z-10 reveal ${cta.inView ? 'in-view' : ''} mx-auto max-w-3xl`}>
          <div className="mx-auto mb-6 h-3 w-3 rounded-full bg-[#12b8d4] shadow-[0_0_0_8px_rgba(18,184,212,0.10),0_0_30px_rgba(18,184,212,0.35)]" />
          <h2 className="text-[40px] font-bold tracking-[-0.04em] text-[#0f172a] sm:text-[50px]">See your system come alive.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-7 text-zinc-500 sm:text-[18px]">
            Build an architecture, run traffic through it and find the weak point before production does.
          </p>
          <Link
            to="/app"
            className="btn-dark mt-9 inline-flex rounded-full px-8 py-4 text-[16px] font-bold shadow-[0_12px_28px_-14px_rgba(15,23,42,0.55)] transition-all hover:-translate-y-0.5"
          >
            Open the editor →
          </Link>
        </div>
      </section>

      <footer className="border-t border-zinc-200/70 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-[13px] text-zinc-400 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-7 w-7 object-contain" />
            <span>© 2026 SysFlow</span>
          </div>
          <span>Built by Aryan, Naman, Aditya, Isha, Debojyoti</span>
        </div>
      </footer>
    </div>
  )
}