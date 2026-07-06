import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import type { ProjectDetail, ReportListItem } from '../types'

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  running: 'Analyzing…',
  complete: 'Complete',
  failed: 'Failed',
}

function annotationSummary(report: ReportListItem): string | null {
  const c = report.annotation_counts
  if (!c) return null
  const parts = []
  if (c.addressed) parts.push(`${c.addressed} addressed`)
  if (c.working) parts.push(`${c.working} in progress`)
  if (c.dismissed) parts.push(`${c.dismissed} dismissed`)
  return parts.length ? parts.join(' · ') : null
}

export default function ProjectPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fromReport, setFromReport] = useState('')
  const [toReport, setToReport] = useState('')
  const [comparing, setComparing] = useState(false)

  useEffect(() => {
    if (projectId) api.project(projectId).then(setProject).catch((e) => setError(String(e)))
  }, [projectId])

  // Complete reports across drafts, oldest first, labeled by draft.
  const completeReports = useMemo(() => {
    if (!project) return []
    const items: { id: string; label: string }[] = []
    const draftsOldestFirst = [...project.drafts].reverse()
    draftsOldestFirst.forEach((draft, draftIndex) => {
      draft.reports
        .filter((r) => r.status === 'complete')
        .forEach((report) => {
          items.push({
            id: report.id,
            label: `Draft ${draftIndex + 1} (${draft.label ?? draft.original_filename}) — ${new Date(report.created_at).toLocaleDateString()}`,
          })
        })
    })
    return items
  }, [project])

  useEffect(() => {
    if (completeReports.length >= 2 && !fromReport && !toReport) {
      setFromReport(completeReports[completeReports.length - 2].id)
      setToReport(completeReports[completeReports.length - 1].id)
    }
  }, [completeReports, fromReport, toReport])

  async function compare() {
    setComparing(true)
    setError(null)
    try {
      const { diff_id } = await api.createDiff(fromReport, toReport)
      navigate(`/diffs/${diff_id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setComparing(false)
    }
  }

  if (error && !project) return <p className="text-red-700">{error}</p>
  if (!project) return <p className="text-stone-400">Loading…</p>

  return (
    <div>
      <p className="text-sm text-stone-400">
        <Link to="/" className="hover:text-stone-600">Library</Link> /
      </p>
      <h1 className="mt-1 font-serif text-3xl">{project.title}</h1>

      {completeReports.length >= 2 && (
        <section className="mt-6 rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-medium">What changed between drafts?</h2>
          <p className="mt-1 text-xs text-stone-500">
            Each draft is scored blind — the comparison below is a separate pass that sees both
            reports and will call out regressions, not just improvements.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <select
              value={fromReport}
              onChange={(e) => setFromReport(e.target.value)}
              className="rounded border border-stone-300 px-2 py-1.5 text-xs"
            >
              {completeReports.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            <span className="text-stone-400">→</span>
            <select
              value={toReport}
              onChange={(e) => setToReport(e.target.value)}
              className="rounded border border-stone-300 px-2 py-1.5 text-xs"
            >
              {completeReports.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            <button
              onClick={compare}
              disabled={comparing || !fromReport || !toReport || fromReport === toReport}
              className="rounded bg-stone-900 px-3 py-1.5 text-xs text-white hover:bg-stone-700 disabled:opacity-40"
            >
              {comparing ? 'Comparing…' : 'Compare'}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
          {project.diffs.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-xs">
              {project.diffs.map((d) => (
                <li key={d.id}>
                  <Link to={`/diffs/${d.id}`} className="text-stone-500 underline decoration-dotted hover:text-stone-900">
                    Comparison from {new Date(d.created_at).toLocaleString()}
                    {d.status !== 'complete' && ` (${STATUS_LABEL[d.status]})`}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
                    {annotationSummary(report) && (
                      <span className="ml-2 text-xs text-stone-400">✎ {annotationSummary(report)}</span>
                    )}
                    {report.status === 'failed' && report.error && (
                      <span className="ml-2 text-xs text-red-600">{report.error.slice(0, 120)}</span>
                    )}
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
