import { authHeaders } from './auth'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'

export interface NodeComment {
  id: string
  nodeId: string
  authorName: string
  text: string
  createdAt: string
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('You need to log in to do that.')
    throw new Error(`Request failed: ${res.status}`)
  }
  return res.json()
}

export async function listComments(projectId: string): Promise<NodeComment[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/comments`, { headers: { ...authHeaders() } })
  return handle(res)
}

export async function createComment(projectId: string, nodeId: string, text: string): Promise<NodeComment> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ nodeId, text }),
  })
  return handle(res)
}

export async function deleteComment(projectId: string, commentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
  if (!res.ok) throw new Error('Failed to delete comment')
}
