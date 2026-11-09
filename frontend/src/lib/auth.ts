const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081/api'

if (import.meta.env.PROD && API_BASE.startsWith('http://') && !API_BASE.includes('localhost')) {
  console.warn('[SysFlow] API_BASE uses HTTP in production — set VITE_API_BASE_URL to an HTTPS origin')
}
const TOKEN_KEY = 'sysflow_token'
const USER_KEY = 'sysflow_user'

export interface AuthUser {
  email: string
  displayName: string | null
}

export interface AuthResult {
  token: string
  email: string
  displayName: string | null
}

async function handle(res: Response): Promise<AuthResult> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? (res.status === 401 ? 'Invalid email or password' : 'Request failed'))
  }
  return res.json()
}

export async function register(email: string, password: string, displayName: string): Promise<AuthResult> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, displayName }),
  })
  return handle(res)
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  return handle(res)
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' })
  } catch { /* best-effort */ }
  clearSession()
}

export function saveSession(result: AuthResult) {
  localStorage.setItem(TOKEN_KEY, result.token)
  localStorage.setItem(USER_KEY, JSON.stringify({ email: result.email, displayName: result.displayName }))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearSession()
      return null
    }
  } catch { /* malformed token - let backend reject it */ }
  return token
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    clearSession()
    return null
  }
}

export function isLoggedIn(): boolean {
  return getToken() !== null && getUser() !== null
}

export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function handleUnauthorized(res: Response): void {
  if (res.status === 401 && getUser()) {
    clearSession()
    if (window.location.pathname === '/app') {
      window.dispatchEvent(new CustomEvent('sysflow:session-expired'))
    } else {
      window.location.href = '/login?expired=1'
    }
  }
}
