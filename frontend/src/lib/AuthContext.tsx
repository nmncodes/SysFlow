import { createContext, useContext, useState, type ReactNode } from 'react'
import * as authApi from './auth'

interface AuthContextValue {
  user: authApi.AuthUser | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<authApi.AuthUser | null>(authApi.getUser())

  const login = async (email: string, password: string) => {
    const result = await authApi.login(email, password)
    authApi.saveSession(result)
    setUser({ email: result.email, displayName: result.displayName })
  }

  const register = async (email: string, password: string, displayName: string) => {
    const result = await authApi.register(email, password, displayName)
    authApi.saveSession(result)
    setUser({ email: result.email, displayName: result.displayName })
  }

  const logout = () => {
    authApi.clearSession()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
