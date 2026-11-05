import { authHeaders, handleUnauthorized } from './auth'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081/api'

export interface WorkspaceSummary {
  id: string
  name: string
  slug: string
  plan: string
  role: string
  memberCount: number
}

export interface WorkspaceMember {
  userId: string
  email: string
  displayName: string | null
  role: string
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    handleUnauthorized(res)
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  const res = await fetch(`${API_BASE}/workspaces`, { headers: { ...authHeaders() } })
  return handle(res)
}

export async function createWorkspace(name: string): Promise<WorkspaceSummary> {
  const res = await fetch(`${API_BASE}/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name }),
  })
  return handle(res)
}

export async function listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/members`, { headers: { ...authHeaders() } })
  return handle(res)
}

export async function inviteMember(workspaceId: string, email: string, role = 'MEMBER'): Promise<WorkspaceMember> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ email, role }),
  })
  return handle(res)
}

export async function removeMember(workspaceId: string, userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/members/${userId}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
  if (!res.ok) { handleUnauthorized(res); throw new Error('Failed to remove member') }
}
