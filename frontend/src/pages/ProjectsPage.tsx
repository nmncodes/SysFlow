import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { deleteProject, listProjects, setPublished, type ProjectSummary } from '../lib/projects'
import { TEMPLATES } from '../lib/templates'

export default function ProjectsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)

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
    setActionError(null)
    setDeletingId(id)
    try {
      await deleteProject(id)
      setProjects((p) => p.filter((proj) => proj.id !== id))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to delete project')
    } finally {
      setDeletingId(null)
    }
  }

  const handleTogglePublish = async (id: string, current: boolean) => {
    setPublishingId(id)
    try {
      const updated = await setPublished(id, !current)
      setProjects((p) => p.map((proj) => (proj.id === id ? { ...proj, isPublicTemplate: updated.isPublicTemplate } : proj)))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update publish status')
    } finally {
      setPublishingId(null)
    }
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
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <Link to="/gallery" className="font-medium text-zinc-700 hover:text-zinc-900">Gallery</Link>
            <Link to="/interview" className="font-medium text-zinc-700 hover:text-zinc-900">Interview Practice</Link>
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

        {actionError && <p className="mt-4 text-sm text-red-500">{actionError}</p>}

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
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-900">{p.name}</h3>
                    {p.isPublicTemplate && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-semibold uppercase text-violet-600">Published</span>}
                  </div>
                  {p.description && <p className="mt-1 text-xs text-zinc-500">{p.description}</p>}
                  <p className="mt-3 text-[11px] text-zinc-400">Edited {new Date(p.updatedAt).toLocaleDateString()}</p>
                </button>
                <div className="absolute right-3 top-3 hidden items-center gap-2 group-hover:flex">
                  <button
                    onClick={() => handleTogglePublish(p.id, p.isPublicTemplate)}
                    disabled={publishingId === p.id}
                    title={p.isPublicTemplate ? 'Remove from public gallery' : 'Publish to public gallery'}
                    className="text-xs text-zinc-400 hover:text-violet-600 disabled:opacity-50"
                  >
                    {publishingId === p.id ? '…' : p.isPublicTemplate ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    className="text-xs text-zinc-400 hover:text-red-500 disabled:opacity-50"
                  >
                    {deletingId === p.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
