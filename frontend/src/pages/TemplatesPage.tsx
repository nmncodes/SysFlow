import { Link } from 'react-router-dom'
import {
  CacheIcon,
  CdnIcon,
  ClientIcon,
  DatabaseIcon,
  GatewayIcon,
  LoadBalancerIcon,
  MobileIcon,
  ObjectStorageIcon,
  PaymentGatewayIcon,
  QueueIcon,
  ServiceIcon,
  WorkerIcon,
} from '../components/icons'
import ThemeToggle from '../components/ThemeToggle'
import logo from '../assets/logo.png'
import { TEMPLATES, type Template } from '../lib/templates'
import type { ComponentType } from '../components/nodes'

type PreviewItem = {
  type: ComponentType
  label: string
}

const PREVIEW_ICONS: Partial<Record<ComponentType, typeof ClientIcon>> = {
  client: ClientIcon,
  webBrowser: ClientIcon,
  mobile: MobileIcon,
  apiGateway: GatewayIcon,
  loadBalancer: LoadBalancerIcon,
  service: ServiceIcon,
  cache: CacheIcon,
  database: DatabaseIcon,
  cdn: CdnIcon,
  queue: QueueIcon,
  messageBroker: QueueIcon,
  worker: WorkerIcon,
  objectStorage: ObjectStorageIcon,
  paymentGateway: PaymentGatewayIcon,
}

const TEMPLATE_META: Record<string, { accent: string; category: string; summary: string }> = {
  'basic-3-tier': {
    accent: 'FOUNDATION',
    category: 'Core architecture',
    summary: 'A clean starting point for a standard web application.',
  },
  'url-shortener': {
    accent: 'READ-HEAVY',
    category: 'Caching',
    summary: 'A read-heavy service with cache-backed redirect lookups.',
  },
  'chat-app': {
    accent: 'ASYNC',
    category: 'Event-driven',
    summary: 'An asynchronous messaging flow using queues and workers.',
  },
  'ecommerce-platform': {
    accent: 'TRANSACTIONAL',
    category: 'Commerce',
    summary: 'A scalable commerce flow covering catalog, orders and payments.',
  },
  'social-media': {
    accent: 'HIGH-TRAFFIC',
    category: 'Distributed',
    summary: 'A feed-oriented architecture with cache, storage and events.',
  },
  'video-streaming': {
    accent: 'CONTENT',
    category: 'Media delivery',
    summary: 'A content delivery architecture built around CDN and storage.',
  },
}

function CircuitBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 18%, rgba(18,184,212,0.12), transparent 34%), radial-gradient(circle at 8% 62%, rgba(56,189,248,0.05), transparent 28%), radial-gradient(circle at 92% 64%, rgba(14,165,233,0.05), transparent 28%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(18,184,212,0.20) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 82%, transparent 100%)',
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full opacity-40"
        viewBox="0 0 1440 760"
        fill="none"
        preserveAspectRatio="none"
      >
        <g stroke="#12b8d4" strokeWidth="1.2">
          <path d="M0 160H90V105H170" />
          <path d="M0 350H125V280H210V220H275" />
          <path d="M1440 150H1350V95H1270" />
          <path d="M1440 360H1320V290H1240V220H1170" />
          <path d="M80 760V690H155V625H235" />
          <path d="M1360 760V680H1290V615H1205" />
        </g>
        <g fill="#12b8d4">
          <circle cx="170" cy="105" r="3" />
          <circle cx="210" cy="280" r="3" />
          <circle cx="1270" cy="95" r="3" />
          <circle cx="1240" cy="290" r="3" />
          <circle cx="155" cy="690" r="3" />
          <circle cx="1290" cy="680" r="3" />
        </g>
      </svg>
    </div>
  )
}

function getPreviewItems(template: Template): PreviewItem[] {
  const seen = new Set<ComponentType>()
  const items: PreviewItem[] = []

  for (const node of template.graph.nodes) {
    const type = node.type as ComponentType
    if (!PREVIEW_ICONS[type] || seen.has(type)) continue
    seen.add(type)
    items.push({ type, label: node.label ?? type })
    if (items.length === 5) break
  }

  return items
}

function TemplatePreview({ template }: { template: Template }) {
  const items = getPreviewItems(template)

  return (
    <div className="relative mt-7 h-[156px] overflow-hidden rounded-2xl border border-zinc-100 bg-[#fbfdfe] shadow-inner dark:border-zinc-800 dark:bg-zinc-950">
      <div className="absolute inset-x-5 top-4 flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-300 dark:text-zinc-700">
          Architecture preview
        </span>
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
      </div>

      <div className="absolute inset-x-5 bottom-5 flex items-center justify-center">
        {items.map((item, index) => {
          const Icon = PREVIEW_ICONS[item.type] ?? ServiceIcon

          return (
            <div key={`${template.id}-${item.type}`} className="flex items-center">
              {index > 0 && (
                <span className="mx-1.5 h-px w-5 bg-[#bdeef4] dark:bg-[#1f5b66] sm:mx-2.5 sm:w-7" />
              )}
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-[#079fbb] shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-[#5fd2e6]">
                <Icon width={19} height={19} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TemplatesPage() {
  return (
    <div className="min-h-screen bg-[#fafdfe] text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-50">
      <header className="sticky top-0 z-50 border-b border-zinc-200/70 bg-white/88 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/88">
        <div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-3" aria-label="SysFlow home">
            <img src={logo} alt="SysFlow" className="h-12 w-12 object-contain" />
            <span className="text-[23px] font-bold tracking-[-0.035em] text-[#0f172a] dark:text-zinc-50">
              SysFlow
            </span>
          </Link>

          <nav className="hidden items-center gap-9 sm:flex">
            <Link
              to="/#features"
              className="group relative text-[16px] font-semibold text-zinc-500 transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.04] hover:text-[#079fbb] dark:text-zinc-400 dark:hover:text-[#5fd2e6]"
            >
              Features
              <span className="absolute -bottom-2 left-0 h-[2px] w-0 rounded-full bg-[#12b8d4] transition-all duration-200 group-hover:w-full" />
            </Link>
            <Link
              to="/#how-it-works"
              className="group relative text-[16px] font-semibold text-zinc-500 transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.04] hover:text-[#079fbb] dark:text-zinc-400 dark:hover:text-[#5fd2e6]"
            >
              How it works
              <span className="absolute -bottom-2 left-0 h-[2px] w-0 rounded-full bg-[#12b8d4] transition-all duration-200 group-hover:w-full" />
            </Link>
            <Link
              to="/templates"
              className="group relative text-[16px] font-semibold text-[#079fbb] dark:text-[#5fd2e6]"
              aria-current="page"
            >
              Templates
              <span className="absolute -bottom-2 left-0 h-[2px] w-full rounded-full bg-[#12b8d4]" />
            </Link>
            <Link
              to="/gallery"
              className="group relative text-[16px] font-semibold text-zinc-500 transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.04] hover:text-[#079fbb] dark:text-zinc-400 dark:hover:text-[#5fd2e6]"
            >
              Gallery
              <span className="absolute -bottom-2 left-0 h-[2px] w-0 rounded-full bg-[#12b8d4] transition-all duration-200 group-hover:w-full" />
            </Link>
            <Link
              to="/interview"
              className="group relative text-[16px] font-semibold text-zinc-500 transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.04] hover:text-[#079fbb] dark:text-zinc-400 dark:hover:text-[#5fd2e6]"
            >
              Interview Practice
              <span className="absolute -bottom-2 left-0 h-[2px] w-0 rounded-full bg-[#12b8d4] transition-all duration-200 group-hover:w-full" />
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link
              to="/app"
              className="btn-dark inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[14px] font-semibold transition-all hover:-translate-y-0.5"
            >
              Open Editor
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <CircuitBackdrop />

        <section className="relative z-10 border-b border-zinc-200/70 px-6 pb-16 pt-16 dark:border-zinc-800 sm:pb-20 sm:pt-20">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#b8edf4] bg-white/90 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#079fbb] shadow-[0_8px_24px_-18px_rgba(18,184,212,0.8)] backdrop-blur-sm dark:border-[#1f5b66] dark:bg-zinc-900/90 dark:text-[#5fd2e6]">
                <span className="h-2 w-2 rounded-full bg-[#12b8d4] shadow-[0_0_0_4px_rgba(18,184,212,0.12)]" />
                Architecture templates
              </div>

              <h1 className="mt-7 text-[42px] font-semibold leading-[1.05] tracking-[-0.045em] text-[#0f172a] dark:text-zinc-50 sm:text-[58px]">
                Start with a proven system.
              </h1>

              <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-7 text-zinc-500 dark:text-zinc-400 sm:text-[18px]">
                Pick a pre-configured architecture, open it in the editor and start experimenting immediately.
                Every template is already connected and ready to simulate.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {TEMPLATES.map((template) => {
                const meta = TEMPLATE_META[template.id] ?? {
                  accent: 'ARCHITECTURE',
                  category: 'System design',
                  summary: template.description,
                }

                return (
                  <Link
                    key={template.id}
                    to={`/app?template=${template.id}`}
                    className="group rounded-2xl border border-zinc-200/80 bg-white/96 p-7 shadow-[0_16px_45px_-25px_rgba(15,23,42,0.22)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[#8de3ee] hover:shadow-[0_24px_55px_-22px_rgba(18,184,212,0.30)] dark:border-zinc-800 dark:bg-zinc-900/96 dark:hover:border-[#1f5b66]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-[#effcff] px-3 py-1.5 text-[11px] font-bold tracking-[0.1em] text-[#079fbb] dark:bg-[#122f36] dark:text-[#5fd2e6]">
                        {meta.accent}
                      </span>
                      <span className="text-[16px] text-zinc-300 transition-colors group-hover:text-[#12b8d4] dark:text-zinc-600">
                        →
                      </span>
                    </div>

                    <TemplatePreview template={template} />

                    <div className="mt-6 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                      <span>{meta.category}</span>
                      <span className="h-1 w-1 rounded-full bg-[#12b8d4]" />
                      <span>{template.graph.nodes.length} nodes</span>
                    </div>

                    <h2 className="mt-2 text-[20px] font-bold tracking-[-0.02em] text-[#0f172a] dark:text-zinc-50">
                      {template.name}
                    </h2>

                    <p className="mt-2 text-[14px] leading-6 text-zinc-500 dark:text-zinc-400">
                      {meta.summary}
                    </p>

                    <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-5 text-[13px] font-semibold dark:border-zinc-800">
                      <span className="text-zinc-400 dark:text-zinc-500">Pre-configured topology</span>
                      <span className="text-[#079fbb] transition-transform duration-200 group-hover:translate-x-1 dark:text-[#5fd2e6]">
                        Open in editor →
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>

            <div className="mx-auto mt-12 flex max-w-3xl flex-col items-center justify-between gap-4 rounded-2xl border border-[#b8edf4] bg-white/80 px-6 py-5 text-center shadow-[0_12px_40px_-28px_rgba(18,184,212,0.45)] backdrop-blur-sm dark:border-[#1f5b66] dark:bg-zinc-900/70 sm:flex-row sm:text-left">
              <div>
                <p className="text-[14px] font-bold text-zinc-800 dark:text-zinc-100">
                  Want to build from scratch?
                </p>
                <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400">
                  Open the editor and design your own architecture from the component library.
                </p>
              </div>
              <Link
                to="/app"
                className="shrink-0 rounded-full bg-[#12b8d4] px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_10px_25px_-12px_rgba(18,184,212,0.8)] transition-all hover:-translate-y-0.5 hover:bg-[#079fbb]"
              >
                Open Editor →
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
