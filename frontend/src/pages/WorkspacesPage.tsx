import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { createWorkspace, inviteMember, listMembers, listWorkspaces, removeMember, type WorkspaceMember, type WorkspaceSummary } from '../lib/workspaces'
import logo from '../assets/logo.png'

export default function WorkspacesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([])
  const [selected, setSelected] = useState<WorkspaceSummary | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [createName, setCreateName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('MEMBER')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (user) listWorkspaces().then(setWorkspaces).catch(() => setError('Failed to load workspaces'))
  }, [user])

  useEffect(() => {
    if (selected) listMembers(selected.id).then(setMembers).catch(() => setMembers([]))
  }, [selected])

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#fafafa] dark:bg-zinc-900 page-enter">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Log in to manage workspaces.</p>
        <Link to="/login" className="btn-dark rounded-lg px-4 py-2 text-sm font-medium">Log in</Link>
      </div>
    )
  }

  const handleCreate = async () => {
    if (!createName.trim()) return
    setCreating(true)
    setError('')
    try {
      const ws = await createWorkspace(createName.trim())
      setWorkspaces((prev) => [...prev, ws])
      setCreateName('')
      setSelected(ws)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    setCreating(false)
  }

  const handleInvite = async () => {
    if (!selected || !inviteEmail.trim()) return
    setError('')
    try {
      const m = await inviteMember(selected.id, inviteEmail.trim(), inviteRole)
      setMembers((prev) => [...prev, m])
      setInviteEmail('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
  }

  const handleRemove = async (userId: string) => {
    if (!selected) return
    try {
      await removeMember(selected.id, userId)
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
    } catch {}
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-zinc-900 page-enter">
      <header className="flex h-14 items-center justify-between border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-sm font-medium text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200 transition-colors">← Back</button>
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="SysFlow" className="h-7 w-7" />
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Workspaces</span>
          </Link>
        </div>
        <Link to="/projects" className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline">My Projects</Link>
      </header>

      <div className="mx-auto flex max-w-4xl gap-6 p-6">
        <div className="w-72 shrink-0 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Your workspaces</h2>
          <div className="space-y-1">
            {workspaces.map((ws) => (
              <button key={ws.id} onClick={() => setSelected(ws)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${selected?.id === ws.id ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                <span className="font-medium">{ws.name}</span>
                <span className="text-[10px] text-zinc-400">{ws.memberCount} member{ws.memberCount === 1 ? '' : 's'}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
            <input value={createName} onChange={(e) => setCreateName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} placeholder="New workspace name" className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-violet-400 focus:outline-none" />
            <button onClick={handleCreate} disabled={creating || !createName.trim()} className="btn-dark mt-2 w-full rounded-lg py-2 text-sm font-medium disabled:opacity-50">
              {creating ? 'Creating…' : 'Create workspace'}
            </button>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {!selected ? (
            <div className="flex h-64 items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">Select or create a workspace</div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{selected.name}</h2>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">Plan: <span className="font-medium capitalize">{selected.plan}</span> · Your role: <span className="font-medium">{selected.role}</span></p>
              </div>

              {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

              <div>
                <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Members</h3>
                <div className="space-y-1">
                  {members.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2">
                      <div>
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{m.displayName || m.email}</span>
                        {m.displayName && <span className="ml-2 text-xs text-zinc-400">{m.email}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">{m.role}</span>
                        {(selected.role === 'OWNER' || selected.role === 'ADMIN') && m.role !== 'OWNER' && (
                          <button onClick={() => handleRemove(m.userId)} className="text-[10px] font-medium text-red-500 hover:underline">Remove</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {(selected.role === 'OWNER' || selected.role === 'ADMIN') && (
                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
                  <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Invite member</h3>
                  <div className="flex gap-2">
                    <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email address" className="min-w-0 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-violet-400 focus:outline-none" />
                    <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-2 text-xs text-zinc-700 dark:text-zinc-300">
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                    <button onClick={handleInvite} disabled={!inviteEmail.trim()} className="btn-dark rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">Invite</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
