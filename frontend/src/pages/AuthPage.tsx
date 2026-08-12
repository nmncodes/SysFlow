import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function AuthPage() {
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'login' | 'register'>(params.get('mode') === 'register' ? 'register' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const auth = useAuth()
  const navigate = useNavigate()
  const redirectTo = params.get('redirect') ?? '/app'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        await auth.login(email, password)
      } else {
        await auth.register(email, password, displayName)
      }
      navigate(redirectTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-6">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow-sm">
            S
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-zinc-900">SysFlow</span>
        </Link>

        <div className="rounded-2xl border border-zinc-100 bg-white p-7 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)]">
          <h1 className="text-lg font-semibold text-zinc-900">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {mode === 'login' ? 'Log in to access your saved architectures.' : 'Save and revisit your designs anytime.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
            {mode === 'register' && (
              <input
                type="text"
                required
                placeholder="Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
            )}
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Password (min. 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button type="submit" disabled={loading} className="btn-dark mt-2 rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
              {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-zinc-400">
            {mode === 'login' ? (
              <>
                No account?{' '}
                <button onClick={() => setMode('register')} className="font-medium text-violet-600 hover:text-violet-800">
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button onClick={() => setMode('login')} className="font-medium text-violet-600 hover:text-violet-800">
                  Log in
                </button>
              </>
            )}
          </p>
        </div>

        <p className="mt-5 text-center text-xs text-zinc-400">
          <Link to="/app" className="hover:text-zinc-600">
            Continue without an account →
          </Link>
        </p>
      </div>
    </div>
  )
}
