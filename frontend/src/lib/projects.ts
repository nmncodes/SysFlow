import { authHeaders } from './auth'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'

export interface GraphJson {
  nodes: { id: string; type: string; config: Record<string, unknown>; position?: { x: number; y: number }; label?: string }[]
  edges: { id: string; source: string; target: string }[]
}

export interface ProjectSummary {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  isPublicTemplate: boolean
}

export interface ProjectDetail extends ProjectSummary {
  graphJson: GraphJson
}

export interface GalleryItem {
  id: string
  name: string
  description: string | null
  authorName: string
  nodeCount: number
  updatedAt: string
}

export interface ProjectVersionSummary {
  id: string
  createdAt: string
}

export interface ProjectVersionDetail extends ProjectVersionSummary {
  graphJson: GraphJson
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('You need to log in to do that.')
    throw new Error(`Request failed: ${res.status}`)
  }
  return res.json()
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const res = await fetch(`${API_BASE}/projects`, { headers: { ...authHeaders() } })
  return handle(res)
}

export async function getProject(id: string): Promise<ProjectDetail> {
  const res = await fetch(`${API_BASE}/projects/${id}`, { headers: { ...authHeaders() } })
  return handle(res)
}

export async function createProject(name: string, description: string, graphJson: GraphJson): Promise<ProjectDetail> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name, description, graphJson }),
  })
  return handle(res)
}

export async function updateProject(id: string, name: string, description: string, graphJson: GraphJson): Promise<ProjectDetail> {
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name, description, graphJson }),
  })
  return handle(res)
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE', headers: { ...authHeaders() } })
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
}

export async function getPublicProject(id: string): Promise<ProjectDetail> {
  const res = await fetch(`${API_BASE}/public/projects/${id}`)
  return handle(res)
}

export async function listVersions(projectId: string): Promise<ProjectVersionSummary[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/versions`, { headers: { ...authHeaders() } })
  return handle(res)
}

export async function restoreVersion(projectId: string, versionId: string): Promise<ProjectDetail> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/versions/${versionId}/restore`, {
    method: 'POST',
    headers: { ...authHeaders() },
  })
  return handle(res)
}

export async function setPublished(projectId: string, publish: boolean): Promise<ProjectDetail> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/publish`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ publish }),
  })
  return handle(res)
}

export async function listGallery(): Promise<GalleryItem[]> {
  const res = await fetch(`${API_BASE}/gallery`)
  return handle(res)
}
