import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Callout, EmptyState } from '../components/ui'
import type { ProjectSummary } from '../types'

export default function LibraryPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.projects().then((r) => setProjects(r.projects)).catch((e) => setError(String(e)))
  }, [])

  if (error) {
    return (
      <Callout tone="error" title="The library couldn't load">
        <p>The local engine didn't answer ({error}). If you just started the app, give it a few seconds and reload.</p>
      </Callout>
    )
  }
  if (projects === null) return <p className="text-graphite">Loading your library…</p>

  if (projects.length === 0) {
    return (
      <div className="mx-auto max-w-column">
        <EmptyState
          title="Your library is empty"
          action={
            <Link to="/analyze" className="btn">
              Analyze your first script
            </Link>
          }
        >
          <p>
            Every script, draft, and coverage report you create lives here — stored in a folder on
            this computer, never uploaded. Re-upload a revised draft later and ScreenScore will
            keep its history with the original.
          </p>
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-column">
      <p className="label">Library</p>
      <h1 className="mt-1 font-serif text-3xl">Your projects</h1>
      <ul className="mt-6 divide-y divide-rule sheet">
        {projects.map((p) => (
          <li key={p.id}>
            <Link
              to={`/projects/${p.id}`}
              className="flex items-baseline justify-between gap-4 px-5 py-4 hover:bg-page"
            >
              <span className="min-w-0">
                <span className="block truncate font-serif text-lg">{p.title}</span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-graphite">
                  {p.draft_count} draft{p.draft_count === 1 ? '' : 's'} · {p.report_count} report
                  {p.report_count === 1 ? '' : 's'}
                </span>
              </span>
              <span className="shrink-0 text-xs text-graphite">
                {p.last_activity ? new Date(p.last_activity).toLocaleDateString() : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
