import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { ProjectSummary } from '../types'

export default function LibraryPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.projects().then((r) => setProjects(r.projects)).catch((e) => setError(String(e)))
  }, [])

  if (error) return <p className="text-red-700">Could not load the library: {error}</p>
  if (projects === null) return <p className="text-stone-400">Loading…</p>

  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-stone-300 bg-white p-12 text-center">
        <h1 className="font-serif text-2xl">Your library is empty</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-stone-500">
          ScreenScore keeps every script, draft and coverage report here — entirely on this
          machine. Analyze your first script to start a project.
        </p>
        <Link
          to="/analyze"
          className="mt-6 inline-block rounded bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700"
        >
          Analyze a script
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-serif text-3xl">Library</h1>
      <ul className="mt-6 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
        {projects.map((p) => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}`} className="flex items-baseline justify-between px-5 py-4 hover:bg-stone-50">
              <span className="font-medium">{p.title}</span>
              <span className="text-sm text-stone-400">
                {p.draft_count} draft{p.draft_count === 1 ? '' : 's'} · {p.report_count} report
                {p.report_count === 1 ? '' : 's'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
