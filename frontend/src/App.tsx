import { Link, Route, Routes } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import TemplatesPage from './pages/TemplatesPage'
import EditorPage from './pages/EditorPage'
import AuthPage from './pages/AuthPage'
import ProjectsPage from './pages/ProjectsPage'
import GalleryPage from './pages/GalleryPage'
import InterviewPage from './pages/InterviewPage'
import ShareViewPage from './pages/ShareViewPage'
import LearnPage from './pages/LearnPage'
import EmbedPage from './pages/EmbedPage'
import WorkspacesPage from './pages/WorkspacesPage'
import { AuthProvider } from './lib/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#fafafa] dark:bg-zinc-900 px-6 text-center page-enter">
      <p className="text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">404</p>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 page-enter-delay-1">Page not found</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-3 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300">
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
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/interview" element={<InterviewPage />} />
          <Route path="/share/:id" element={<ShareViewPage />} />
          <Route path="/embed/:id" element={<EmbedPage />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
