import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { deleteProject, listProjects, type ProjectSummary } from '../lib/projects'
import { TEMPLATES } from '../lib/templates'

export default function ProjectsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      navigate('/login?redirect=/projects')
      return
    }
    listProjects()
      .then(setProjects)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load projects'))
      .finally(() => setLoading(false))
  }, [user, navigate])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project? This cannot be undone.')) return
    await deleteProject(id)
    setProjects((p) => p.filter((proj) => proj.id !== id))
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-[13px] font-semibold text-white">
              S
            </div>
            <span className="text-[14px] font-semibold tracking-tight">SysFlow</span>
          </Link>
          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <span>{user.displayName ?? user.email}</span>
            <button onClick={logout} className="font-medium text-zinc-700 hover:text-zinc-900">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-10">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Start from a template</h1>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/app?template=${t.id}`)}
                className="hover-lift rounded-2xl border border-zinc-200 bg-white p-5 text-left transition hover:border-violet-200 hover:shadow-md"
              >
                <h3 className="text-sm font-semibold text-zinc-900">{t.name}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{t.description}</p>
              </button>
            ))}
            <button
              onClick={() => navigate('/app')}
              className="rounded-2xl border border-dashed border-zinc-300 p-5 text-left text-zinc-400 transition hover:border-violet-300 hover:text-violet-600"
            >
              <h3 className="text-sm font-semibold">Blank canvas</h3>
              <p className="mt-1.5 text-xs leading-relaxed">Start from scratch.</p>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">My Projects</h2>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-zinc-400">Loading…</p>
        ) : error ? (
          <p className="mt-6 text-sm text-red-500">{error}</p>
        ) : projects.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-400">No saved projects yet — save one from the editor.</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="hover-lift group relative rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-violet-200 hover:shadow-md"
              >
                <button onClick={() => navigate(`/app?projectId=${p.id}`)} className="block w-full text-left">
                  <h3 className="text-sm font-semibold text-zinc-900">{p.name}</h3>
                  {p.description && <p className="mt-1 text-xs text-zinc-500">{p.description}</p>}
                  <p className="mt-3 text-[11px] text-zinc-400">Edited {new Date(p.updatedAt).toLocaleDateString()}</p>
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="absolute right-3 top-3 hidden text-xs text-zinc-400 hover:text-red-500 group-hover:block"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
