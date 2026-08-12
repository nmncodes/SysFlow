import { Route, Routes } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import EditorPage from './pages/EditorPage'
import AuthPage from './pages/AuthPage'
import ProjectsPage from './pages/ProjectsPage'
import ShareViewPage from './pages/ShareViewPage'
import { AuthProvider } from './lib/AuthContext'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<EditorPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/share/:id" element={<ShareViewPage />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
