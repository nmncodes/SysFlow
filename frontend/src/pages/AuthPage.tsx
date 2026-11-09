import { useState, useId } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import logo from '../assets/logo.png'

export default function AuthPage() {
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'login' | 'register'>(params.get('mode') === 'register' ? 'register' : 'login')
  const formKey = useId() + mode
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const auth = useAuth()
  const navigate = useNavigate()
  const rawRedirect = params.get('redirect')
  const redirectTo = rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/app'

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
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] dark:bg-zinc-900 px-6">
      <div className="w-full max-w-sm page-enter">
        <button onClick={() => navigate(-1)} className="mb-4 self-start text-sm font-medium text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200 transition-colors">← Back</button>
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <img src={logo} alt="SysFlow" className="h-9 w-9 object-contain" />
          <span className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">SysFlow</span>
        </Link>

        <div className="rounded-2xl border border-zinc-100 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-7 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] page-enter-delay-1">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {mode === 'login' ? 'Log in to access your saved architectures.' : 'Save and revisit your designs anytime.'}
          </p>

          <form key={formKey} onSubmit={handleSubmit} className="auth-form-enter mt-6 flex flex-col gap-3">
            {mode === 'register' && (
              <input
                type="text"
                required
                placeholder="Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:border-violet-300 dark:focus:border-violet-500 focus:bg-white dark:focus:bg-zinc-600 focus:ring-2 focus:ring-violet-100 dark:focus:ring-violet-800"
              />
            )}
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:border-violet-300 dark:focus:border-violet-500 focus:bg-white dark:focus:bg-zinc-600 focus:ring-2 focus:ring-violet-100 dark:focus:ring-violet-800"
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Password (min. 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:border-violet-300 dark:focus:border-violet-500 focus:bg-white dark:focus:bg-zinc-600 focus:ring-2 focus:ring-violet-100 dark:focus:ring-violet-800"
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
                <button onClick={() => setMode('register')} className="font-medium text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300">
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button onClick={() => setMode('login')} className="font-medium text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300">
                  Log in
                </button>
              </>
            )}
          </p>
        </div>

        <p className="mt-5 text-center text-xs text-zinc-400">
          <Link to="/app" className="hover:text-zinc-600 dark:hover:text-zinc-300">
            Continue without an account →
          </Link>
        </p>
      </div>
    </div>
  )
}
