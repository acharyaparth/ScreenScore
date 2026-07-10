import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { api } from './api'
import AnalyzePage from './pages/AnalyzePage'
import DiffPage from './pages/DiffPage'
import LibraryPage from './pages/LibraryPage'
import ProjectPage from './pages/ProjectPage'
import ReportPage from './pages/ReportPage'

function LocalBadge() {
  const [runtimeUp, setRuntimeUp] = useState<boolean | null>(null)
  useEffect(() => {
    api.health().then((h) => setRuntimeUp(h.runtime.available)).catch(() => setRuntimeUp(null))
  }, [])
  return (
    <span
      className="hidden items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-graphite sm:flex"
      title={
        runtimeUp === null
          ? 'Everything stays on this machine.'
          : runtimeUp
            ? 'Everything stays on this machine. Local model runtime connected.'
            : 'Everything stays on this machine. Local model runtime not reachable.'
      }
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          runtimeUp === null ? 'bg-rule' : runtimeUp ? 'bg-score-good' : 'bg-score-fair'
        }`}
      />
      Local
    </span>
  )
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-rule bg-sheet">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/" className="font-serif text-lg tracking-tight">
            ScreenScore
          </Link>
          <nav aria-label="Main" className="flex items-center gap-2 sm:gap-4">
            <LocalBadge />
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded px-2 py-1 text-sm ${isActive ? 'text-ink underline underline-offset-4' : 'text-graphite hover:text-ink'}`
              }
            >
              Library
            </NavLink>
            <NavLink
              to="/analyze"
              className={({ isActive }) =>
                isActive ? 'btn' : 'btn-ghost'
              }
            >
              Analyze a script
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:py-10">
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/analyze" element={<AnalyzePage />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/reports/:reportId" element={<ReportPage />} />
          <Route path="/diffs/:diffId" element={<DiffPage />} />
        </Routes>
      </main>
      <footer className="mx-auto w-full max-w-7xl px-5 pb-8">
        <p className="border-t border-rule pt-4 font-mono text-[11px] uppercase tracking-wider text-graphite">
          Coverage generated on this machine · nothing is uploaded, ever
        </p>
      </footer>
    </div>
  )
}
