import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { deleteProject, grantCollaborator, listCollaborators, listProjects, listSharedWithMe, revokeCollaborator, revokeShareLink, setPublished, type ProjectCollaborator, type ProjectSummary } from '../lib/projects'
import { TEMPLATES } from '../lib/templates'
import logo from '../assets/logo.png'

export default function ProjectsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [sharedProjects, setSharedProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [revokingShareId, setRevokingShareId] = useState<string | null>(null)
  const [teamProject, setTeamProject] = useState<ProjectSummary | null>(null)
  const [members, setMembers] = useState<ProjectCollaborator[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'EDITOR' | 'VIEWER'>('EDITOR')
  const [teamBusy, setTeamBusy] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate('/login?redirect=/projects')
      return
    }
    Promise.all([listProjects(), listSharedWithMe()])
      .then(([owned, shared]) => { setProjects(owned); setSharedProjects(shared) })
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

  const openTeam = async (project: ProjectSummary) => {
    setActionError(null)
    setTeamProject(project)
    try {
      setMembers(await listCollaborators(project.id))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to load collaborators')
    }
  }

  const invite = async () => {
    if (!teamProject || !inviteEmail.trim()) return
    setTeamBusy(true)
    try {
      const member = await grantCollaborator(teamProject.id, inviteEmail.trim(), inviteRole)
      setMembers((current) => [...current.filter((item) => item.userId !== member.userId), member])
      setInviteEmail('')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to add collaborator')
    } finally {
      setTeamBusy(false)
    }
  }

  const removeMember = async (userId: string) => {
    if (!teamProject) return
    setTeamBusy(true)
    try {
      await revokeCollaborator(teamProject.id, userId)
      setMembers((current) => current.filter((item) => item.userId !== userId))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to remove collaborator')
    } finally {
      setTeamBusy(false)
    }
  }

  const handleRevokeShare = async (id: string) => {
    setActionError(null)
    setRevokingShareId(id)
    try {
      await revokeShareLink(id)
      setProjects((items) => items.map((project) => project.id === id ? { ...project, isShared: false } : project))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to revoke share link')
    } finally {
      setRevokingShareId(null)
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
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="SysFlow" className="h-8 w-8 object-contain" />
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
                  {p.isShared && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[9px] font-semibold uppercase text-sky-600">Shared</span>}
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
                  {p.isShared && <button
                    onClick={() => handleRevokeShare(p.id)}
                    disabled={revokingShareId === p.id}
                    title="Invalidate this share link immediately"
                    className="text-xs text-zinc-400 hover:text-amber-600 disabled:opacity-50"
                  >
                    {revokingShareId === p.id ? '…' : 'Revoke link'}
                  </button>}
                  <button onClick={() => openTeam(p)} className="text-xs text-zinc-400 hover:text-violet-600">Team</button>
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

        {sharedProjects.length > 0 && <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Shared with me</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sharedProjects.map((p) => <button key={p.id} onClick={() => navigate(`/app?projectId=${p.id}`)} className="rounded-2xl border border-sky-100 bg-white p-5 text-left hover:border-sky-300 hover:shadow-md">
              <h3 className="text-sm font-semibold text-zinc-900">{p.name}</h3>
              <p className="mt-2 text-xs text-sky-700">{p.accessRole === 'EDITOR' ? 'Can edit' : 'View only'}</p>
            </button>)}
          </div>
        </section>}
      </main>

      {teamProject && <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/30 p-4" onClick={() => setTeamProject(null)}>
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Manage collaborators</h2><p className="mt-1 text-xs text-zinc-500">Invite existing SysFlow accounts by email.</p></div><button onClick={() => setTeamProject(null)} aria-label="Close collaborators" className="text-zinc-400 hover:text-zinc-700">✕</button></div>
          <div className="mt-4 flex gap-2"><input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@example.com" className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm" /><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'EDITOR' | 'VIEWER')} className="rounded-lg border border-zinc-200 px-2 text-sm"><option value="EDITOR">Editor</option><option value="VIEWER">Viewer</option></select><button onClick={invite} disabled={!inviteEmail.trim() || teamBusy} className="btn-dark rounded-lg px-3 text-sm disabled:opacity-50">Add</button></div>
          <div className="mt-5 space-y-2">{members.map((member) => <div key={member.userId} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2"><div><p className="text-sm font-medium">{member.displayName || member.email}</p><p className="text-[11px] text-zinc-500">{member.owner ? 'Owner' : member.role === 'EDITOR' ? 'Editor' : 'Viewer'}</p></div>{!member.owner && <button onClick={() => removeMember(member.userId)} disabled={teamBusy} className="text-xs text-red-500 disabled:opacity-50">Remove</button>}</div>)}</div>
        </div>
      </div>}
    </div>
  )
}
