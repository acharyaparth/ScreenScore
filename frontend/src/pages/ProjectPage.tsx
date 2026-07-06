import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import type { ProjectDetail } from '../types'

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  running: 'Analyzing…',
  complete: 'Complete',
  failed: 'Failed',
}

export default function ProjectPage() {
  const { projectId } = useParams()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (projectId) api.project(projectId).then(setProject).catch((e) => setError(String(e)))
  }, [projectId])

  if (error) return <p className="text-red-700">{error}</p>
  if (!project) return <p className="text-stone-400">Loading…</p>

  return (
    <div>
      <p className="text-sm text-stone-400">
        <Link to="/" className="hover:text-stone-600">Library</Link> /
      </p>
      <h1 className="mt-1 font-serif text-3xl">{project.title}</h1>

      <div className="mt-8 space-y-6">
        {project.drafts.map((draft, i) => (
          <section key={draft.id} className="rounded-lg border border-stone-200 bg-white p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-medium">
                {draft.label ?? `Draft ${project.drafts.length - i}`}
                <span className="ml-2 text-sm font-normal text-stone-400">{draft.original_filename}</span>
              </h2>
              <span className="text-xs text-stone-400">
                uploaded {new Date(draft.uploaded_at).toLocaleDateString()}
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {draft.reports.map((report) => (
                <li key={report.id} className="flex items-baseline justify-between text-sm">
                  <span>
                    Coverage · {new Date(report.created_at).toLocaleString()}
                    <span className="ml-2 text-stone-400">{STATUS_LABEL[report.status]}</span>
                  </span>
                  {report.status === 'complete' && (
                    <Link to={`/reports/${report.id}`} className="text-stone-900 underline hover:no-underline">
                      Open report
                    </Link>
                  )}
                </li>
              ))}
              {draft.reports.length === 0 && <li className="text-sm text-stone-400">No reports yet.</li>}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
