const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'
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
    throw new Error(body?.message ?? (res.status === 401 ? 'Invalid email or password' : res.status === 409 ? 'An account with this email already exists' : 'Request failed'))
  }
  return res.json()
}

export async function register(email: string, password: string, displayName: string): Promise<AuthResult> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  })
  return handle(res)
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return handle(res)
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
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export function isLoggedIn(): boolean {
  return getToken() !== null
}

export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
