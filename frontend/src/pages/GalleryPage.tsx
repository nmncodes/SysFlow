import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { listGallery, type GalleryItem } from '../lib/projects'
import logo from '../assets/logo.png'

export default function GalleryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listGallery()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load gallery'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#f7fafb] dark:bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-200/60 dark:border-zinc-800 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-sm font-medium text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200 transition-colors">← Back</button>
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="SysFlow" className="h-8 w-8 object-contain" />
              <span className="text-[14px] font-semibold tracking-tight dark:text-zinc-100">SysFlow</span>
            </Link>
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
            <Link to="/app" className="font-medium text-zinc-700 dark:text-zinc-300 hover:text-[#12b8d4]">Editor</Link>
            {user && <Link to="/projects" className="font-medium text-zinc-700 dark:text-zinc-300 hover:text-[#12b8d4]">My Projects</Link>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 page-enter">
        <div className="text-center page-enter-delay-1">
          <div className="mx-auto mb-4 h-2.5 w-2.5 rounded-full bg-[#12b8d4] shadow-[0_0_0_6px_rgba(18,184,212,0.10),0_0_20px_rgba(18,184,212,0.25)]" />
          <h1 className="text-[32px] font-bold tracking-[-0.03em] text-zinc-900 dark:text-zinc-50 sm:text-[38px]">Community gallery</h1>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Architectures other SysFlow users have chosen to share publicly. Opening one loads it as a fresh, unsaved copy.
          </p>
        </div>

        {loading ? (
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3].map(i => <div key={i} className="skeleton-shimmer h-32 rounded-2xl" />)}
          </div>
        ) : error ? (
          <p className="mt-10 text-center text-sm text-red-500">{error}</p>
        ) : items.length === 0 ? (
          <p className="mt-10 text-center text-sm text-zinc-400 dark:text-zinc-500">Nothing published yet — be the first: save a project, then publish it from My Projects.</p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, i) => (
              <button
                key={item.id}
                onClick={() => navigate(`/app?galleryProjectId=${item.id}`)}
                className={`card-enter card-stagger-${Math.min(i + 1, 8)} hover-lift rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/94 dark:bg-zinc-900/94 px-6 py-5 text-left shadow-[0_8px_24px_-16px_rgba(15,23,42,0.12)] transition-all duration-300 hover:border-[#8de3ee] dark:hover:border-[#1f5b66] hover:shadow-[0_16px_40px_-16px_rgba(18,184,212,0.25)]`}
              >
                <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</h3>
                {item.description && <p className="mt-2 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{item.description}</p>}
                <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
                  <span>{item.nodeCount} component{item.nodeCount === 1 ? '' : 's'} · by {item.authorName}</span>
                  <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
