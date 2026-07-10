import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { Callout } from '../components/ui'
import type { DiffDirection, DiffRow, Score } from '../types'

const DIRECTION: Record<DiffDirection, { symbol: string; className: string; word: string }> = {
  improved: { symbol: '▲', className: 'text-score-good', word: 'improved' },
  declined: { symbol: '▼', className: 'text-score-weak', word: 'declined' },
  unchanged: { symbol: '—', className: 'text-rule', word: 'unchanged' },
  newly_scored: { symbol: '＋', className: 'text-graphite', word: 'newly scored' },
  newly_unscored: { symbol: '？', className: 'text-score-fair', word: 'lost its grounding' },
  new_dimension: { symbol: '＋', className: 'text-graphite', word: 'new dimension' },
}

function scoreLabel(score: Score | null): string {
  return score ?? 'insufficient'
}

function NarrativeCard({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className="sheet px-5 py-4">
      <p className={`label ${tone}`}>{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-graphite">None identified.</p>
      ) : (
        <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function DiffPage() {
  const { diffId } = useParams()
  const [diff, setDiff] = useState<DiffRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!diffId) return
    let cancelled = false
    async function poll() {
      try {
        for (;;) {
          const row = await api.diff(diffId!)
          if (cancelled) return
          setDiff(row)
          if (row.status === 'complete' || row.status === 'failed') return
          await new Promise((r) => setTimeout(r, 1500))
        }
      } catch (e) {
        if (!cancelled) setError(String(e))
      }
    }
    poll()
    return () => {
      cancelled = true
    }
  }, [diffId])

  if (error) {
    return (
      <Callout tone="error" title="This comparison couldn't load">
        <p>{error}</p>
      </Callout>
    )
  }
  if (!diff) return <p className="text-graphite">Loading…</p>
  if (diff.status === 'failed') {
    return (
      <div className="mx-auto max-w-column">
        <Callout tone="error" title="The comparison failed">
          <p>{diff.error ?? 'No detail was recorded.'}</p>
          <p className="mt-2 text-xs">
            Open the project and start the comparison again — the underlying reports are intact.
          </p>
        </Callout>
      </div>
    )
  }
  if (diff.status !== 'complete' || !diff.payload) {
    return (
      <div className="mx-auto max-w-column">
        <p className="label">Comparing drafts</p>
        <p className="mt-2 animate-pulse text-sm text-graphite">
          Reading both reports side by side. Scoring stayed blind — this pass is the only place
          the two drafts meet.
        </p>
      </div>
    )
  }

  const { mechanical, narrative } = diff.payload
  const verdictChanged = mechanical.verdict.from !== mechanical.verdict.to
  const similarity = mechanical.content_similarity
  const nearIdentical = typeof similarity === 'number' && similarity >= 0.9

  return (
    <div className="mx-auto max-w-column">
      <nav aria-label="Breadcrumb" className="label">
        <Link to={`/projects/${diff.project_id}`} className="hover:text-ink">Project</Link> / comparison
      </nav>
      <h1 className="mt-1 font-serif text-3xl">What changed</h1>
      <p className="mt-2 max-w-lg text-sm text-graphite">
        Both drafts were scored independently, blind to each other. Regressions are reported as
        prominently as improvements — that's the point.
      </p>

      {nearIdentical && (
        <div className="mt-4">
          <Callout tone="info" title="These drafts are textually near-identical">
            <p>
              {Math.round((similarity as number) * 100)}% of dialogue is shared between the two
              drafts. Any score differences below reflect run-to-run model variance, not actual
              revisions.
            </p>
          </Callout>
        </div>
      )}

      <section className="sheet mt-6 px-6 py-5">
        <p className="label">Verdict</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-3 font-serif text-2xl">
          <span className="capitalize">{mechanical.verdict.from}</span>
          <span aria-hidden="true" className="text-graphite">→</span>
          <span className={`capitalize ${verdictChanged ? '' : 'text-graphite'}`}>{mechanical.verdict.to}</span>
          {!verdictChanged && <span className="font-mono text-[11px] uppercase tracking-wider text-graphite">unchanged</span>}
        </p>
        {(mechanical.size.from_pages || mechanical.size.to_pages) && (
          <p className="mt-2 font-mono text-[11px] text-graphite">
            {mechanical.size.from_pages ?? '?'} → {mechanical.size.to_pages ?? '?'} pages ·{' '}
            {mechanical.size.from_scenes ?? '?'} → {mechanical.size.to_scenes ?? '?'} scenes
            {typeof similarity === 'number' && ` · ${Math.round(similarity * 100)}% dialogue overlap`}
          </p>
        )}
        {narrative.overall && <p className="mt-3 text-sm leading-relaxed">{narrative.overall}</p>}
      </section>

      <section className="mt-8">
        <p className="label">Dimension movement (computed from the scores — not the model's opinion)</p>
        <div className="sheet mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {mechanical.dimensions.map((dim) => {
                const direction = DIRECTION[dim.direction]
                const comment = narrative.dimension_comments.find((c) => c.id === dim.id)?.comment
                return (
                  <tr key={dim.id} className="border-b border-rule last:border-0">
                    <td className="px-4 py-2.5 font-medium">{dim.name}</td>
                    <td className="px-2 py-2.5 text-right font-mono text-xs capitalize text-graphite">
                      {scoreLabel(dim.from_score)}
                    </td>
                    <td className={`px-2 py-2.5 text-center ${direction.className}`}>
                      <span aria-hidden="true">{direction.symbol}</span>
                      <span className="sr-only">{direction.word}</span>
                    </td>
                    <td className="px-2 py-2.5 font-mono text-xs capitalize">{scoreLabel(dim.to_score)}</td>
                    <td className="hidden px-4 py-2.5 text-xs text-graphite md:table-cell">{comment}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Honesty first: regressions before improvements. */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <NarrativeCard title="Regressions" items={narrative.regressions} tone="text-score-weak" />
        <NarrativeCard title="Improved" items={narrative.improved} tone="text-score-good" />
        <NarrativeCard title="Still unresolved" items={narrative.persisted} tone="text-score-fair" />
        <NarrativeCard title="New issues" items={narrative.new_issues} tone="text-graphite" />
      </section>

      <p className="mt-8 font-mono text-[11px] uppercase tracking-wider text-graphite">
        Underlying reports:{' '}
        <Link className="underline" to={`/reports/${diff.payload.from_report_id}`}>earlier draft</Link>
        {' · '}
        <Link className="underline" to={`/reports/${diff.payload.to_report_id}`}>newer draft</Link>
      </p>
    </div>
  )
}
