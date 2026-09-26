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
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="SysFlow" className="h-8 w-8 object-contain" />
            <span className="text-[14px] font-semibold tracking-tight">SysFlow</span>
          </Link>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <Link to="/app" className="font-medium text-zinc-700 hover:text-zinc-900">Editor</Link>
            {user && <Link to="/projects" className="font-medium text-zinc-700 hover:text-zinc-900">My Projects</Link>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Community gallery</h1>
        <p className="mt-2 text-sm text-zinc-500">Architectures other SysFlow users have chosen to share publicly. Opening one loads it as a fresh, unsaved copy — nothing you do here touches the original.</p>

        {loading ? (
          <p className="mt-6 text-sm text-zinc-400">Loading…</p>
        ) : error ? (
          <p className="mt-6 text-sm text-red-500">{error}</p>
        ) : items.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-400">Nothing published yet — be the first: save a project, then publish it from My Projects.</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(`/app?galleryProjectId=${item.id}`)}
                className="hover-lift rounded-2xl border border-zinc-200 bg-white p-5 text-left transition hover:border-violet-200 hover:shadow-md"
              >
                <h3 className="text-sm font-semibold text-zinc-900">{item.name}</h3>
                {item.description && <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{item.description}</p>}
                <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
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
