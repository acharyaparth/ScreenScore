import { Link, Route, Routes } from 'react-router-dom'
import AnalyzePage from './pages/AnalyzePage'
import DiffPage from './pages/DiffPage'
import LibraryPage from './pages/LibraryPage'
import ProjectPage from './pages/ProjectPage'
import ReportPage from './pages/ReportPage'

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-baseline justify-between px-6 py-4">
          <Link to="/" className="font-serif text-xl tracking-tight">
            ScreenScore
          </Link>
          <nav className="flex items-baseline gap-6 text-sm text-stone-500">
            <Link to="/" className="hover:text-stone-900">Library</Link>
            <Link to="/analyze" className="rounded bg-stone-900 px-3 py-1.5 text-white hover:bg-stone-700">
              Analyze a script
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/analyze" element={<AnalyzePage />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/reports/:reportId" element={<ReportPage />} />
          <Route path="/diffs/:diffId" element={<DiffPage />} />
        </Routes>
      </main>
      <footer className="mx-auto max-w-4xl px-6 pb-10 text-xs text-stone-400">
        Local-first screenplay coverage. Your script never leaves this machine.
      </footer>
    </div>
  )
}
