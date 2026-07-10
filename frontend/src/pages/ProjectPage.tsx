import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { Callout, RevisionSwatch, REVISION_NAMES } from '../components/ui'
import type { ProjectDetail, ReportListItem } from '../types'

const STATUS_LABEL: Record<string, string> = {
  queued: 'queued',
  running: 'analyzing…',
  complete: 'complete',
  failed: 'failed',
}

function annotationSummary(report: ReportListItem): string | null {
  const c = report.annotation_counts
  if (!c) return null
  const parts = []
  if (c.working) parts.push(`${c.working} in progress`)
  if (c.addressed) parts.push(`${c.addressed} addressed`)
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
  const [retrying, setRetrying] = useState<string | null>(null)

  const load = () => {
    if (projectId) api.project(projectId).then(setProject).catch((e) => setError(String(e)))
  }
  useEffect(load, [projectId])

  // Drafts oldest-first for revision-color order (white, blue, pink, …).
  const draftsOldestFirst = useMemo(() => (project ? [...project.drafts].reverse() : []), [project])

  const completeReports = useMemo(() => {
    const items: { id: string; label: string }[] = []
    draftsOldestFirst.forEach((draft, draftIndex) => {
      draft.reports
        .filter((r) => r.status === 'complete')
        .forEach((report) => {
          items.push({
            id: report.id,
            label: `${REVISION_NAMES[Math.min(draftIndex, REVISION_NAMES.length - 1)]} draft — ${new Date(report.created_at).toLocaleDateString()}`,
          })
        })
    })
    return items
  }, [draftsOldestFirst])

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

  async function retry(draftId: string) {
    setRetrying(draftId)
    try {
      const ids = await api.reanalyze(draftId)
      navigate(`/reports/${ids.report_id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setRetrying(null)
    }
  }

  if (error && !project) {
    return (
      <Callout tone="error" title="This project couldn't load">
        <p>{error}</p>
      </Callout>
    )
  }
  if (!project) return <p className="text-graphite">Loading…</p>

  return (
    <div className="mx-auto max-w-column">
      <nav aria-label="Breadcrumb" className="label">
        <Link to="/" className="hover:text-ink">Library</Link> /
      </nav>
      <h1 className="mt-1 font-serif text-3xl">{project.title}</h1>

      {completeReports.length >= 2 && (
        <section className="sheet mt-6 px-5 py-4">
          <p className="label">What changed between drafts?</p>
          <p className="mt-1.5 text-xs text-graphite">
            Every draft is scored blind — the comparison is a separate pass that reads both
            reports and will name regressions as readily as improvements.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <select
              value={fromReport}
              onChange={(e) => setFromReport(e.target.value)}
              aria-label="Earlier report"
              className="rounded border border-rule bg-sheet px-2 py-1.5 text-xs"
            >
              {completeReports.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            <span className="text-graphite" aria-hidden="true">→</span>
            <select
              value={toReport}
              onChange={(e) => setToReport(e.target.value)}
              aria-label="Later report"
              className="rounded border border-rule bg-sheet px-2 py-1.5 text-xs"
            >
              {completeReports.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            <button
              onClick={compare}
              disabled={comparing || !fromReport || !toReport || fromReport === toReport}
              className="btn text-xs"
            >
              {comparing ? 'Comparing…' : 'Compare'}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-score-weak">{error}</p>}
          {project.diffs.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-rule pt-3">
              {project.diffs.map((d) => (
                <li key={d.id} className="text-xs">
                  <Link to={`/diffs/${d.id}`} className="text-graphite underline decoration-dotted underline-offset-2 hover:text-ink">
                    Comparison from {new Date(d.created_at).toLocaleString()}
                    {d.status !== 'complete' && ` (${STATUS_LABEL[d.status]})`}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {completeReports.length === 1 && project.drafts.length === 1 && (
        <p className="mt-6 text-xs text-graphite">
          When you upload a revised draft, it will appear here alongside this one — and you'll be
          able to compare them honestly, regressions included.
        </p>
      )}

      <section aria-label="Drafts" className="mt-8 space-y-5">
        {project.drafts.map((draft) => {
          const revisionIndex = draftsOldestFirst.findIndex((d) => d.id === draft.id)
          const isLatest = draft.id === project.drafts[0]?.id
          return (
            <div key={draft.id} className="sheet px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="flex min-w-0 items-center gap-2 font-medium">
                  <RevisionSwatch index={revisionIndex} />
                  <span>{draft.label ?? `${REVISION_NAMES[Math.min(revisionIndex, REVISION_NAMES.length - 1)]} draft`}</span>
                  {isLatest && (
                    <span className="rounded-sm border border-rule px-1.5 font-mono text-[10px] uppercase tracking-wider text-graphite">
                      latest
                    </span>
                  )}
                  <span className="truncate text-sm font-normal text-graphite">{draft.original_filename}</span>
                </h2>
                <span className="font-mono text-[11px] text-graphite">
                  {new Date(draft.uploaded_at).toLocaleDateString()}
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {draft.reports.map((report) => (
                  <li key={report.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      Coverage · {new Date(report.created_at).toLocaleString()}
                      <span
                        className={`ml-2 font-mono text-[11px] uppercase tracking-wider ${
                          report.status === 'failed' ? 'text-score-weak' : 'text-graphite'
                        }`}
                      >
                        {STATUS_LABEL[report.status]}
                      </span>
                      {annotationSummary(report) && (
                        <span className="ml-2 text-xs text-graphite">✎ {annotationSummary(report)}</span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {report.status === 'complete' && (
                        <Link to={`/reports/${report.id}`} className="underline underline-offset-2 hover:no-underline">
                          Open report
                        </Link>
                      )}
                      {report.status === 'failed' && (
                        <button
                          className="btn-ghost px-2 py-0.5 text-xs"
                          onClick={() => retry(draft.id)}
                          disabled={retrying === draft.id}
                        >
                          {retrying === draft.id ? 'Starting…' : 'Run again'}
                        </button>
                      )}
                    </span>
                  </li>
                ))}
                {draft.reports.length === 0 && (
                  <li className="flex items-center justify-between text-sm text-graphite">
                    <span>No reports yet for this draft.</span>
                    <button className="btn-ghost px-2 py-0.5 text-xs" onClick={() => retry(draft.id)} disabled={retrying === draft.id}>
                      {retrying === draft.id ? 'Starting…' : 'Analyze'}
                    </button>
                  </li>
                )}
              </ul>
              {draft.reports.some((r) => r.status === 'failed') && (
                <p className="mt-2 text-xs text-graphite">
                  Failed runs keep their error on record; running again starts a fresh report and
                  reuses everything the last run already finished.
                </p>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}
