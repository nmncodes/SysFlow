import { Link, Route, Routes } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import EditorPage from './pages/EditorPage'
import AuthPage from './pages/AuthPage'
import ProjectsPage from './pages/ProjectsPage'
import ShareViewPage from './pages/ShareViewPage'
import { AuthProvider } from './lib/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#fafafa] px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-zinc-400">404</p>
      <h1 className="text-xl font-semibold text-zinc-900">Page not found</h1>
      <p className="text-sm text-zinc-500">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-3 text-sm font-medium text-violet-600 hover:text-violet-800">
        ← Back to home
      </Link>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<EditorPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/share/:id" element={<ShareViewPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
