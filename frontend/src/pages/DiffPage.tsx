import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import type { DiffDirection, DiffRow, Score } from '../types'

const DIRECTION_STYLE: Record<DiffDirection, { symbol: string; className: string }> = {
  improved: { symbol: '▲', className: 'text-emerald-600' },
  declined: { symbol: '▼', className: 'text-red-600' },
  unchanged: { symbol: '—', className: 'text-stone-300' },
  newly_scored: { symbol: '＋', className: 'text-stone-500' },
  newly_unscored: { symbol: '？', className: 'text-amber-600' },
  new_dimension: { symbol: '＋', className: 'text-stone-500' },
}

function scoreLabel(score: Score | null): string {
  return score ?? 'insufficient'
}

function NarrativeList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (!items.length) return null
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <h3 className={`text-xs font-medium uppercase tracking-widest ${tone}`}>{title}</h3>
      <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-stone-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
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

  if (error) return <p className="text-red-700">{error}</p>
  if (!diff) return <p className="text-stone-400">Loading…</p>
  if (diff.status === 'failed') {
    return <p className="text-red-700">Comparison failed: {diff.error}</p>
  }
  if (diff.status !== 'complete' || !diff.payload) {
    return <p className="animate-pulse text-stone-500">Comparing drafts — scoring stays blind; this pass reads both reports…</p>
  }

  const { mechanical, narrative } = diff.payload
  const verdictChanged = mechanical.verdict.from !== mechanical.verdict.to

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-stone-400">
        <Link to={`/projects/${diff.project_id}`} className="hover:text-stone-600">Project</Link> / comparison
      </p>
      <h1 className="mt-1 font-serif text-3xl">What changed</h1>
      <p className="mt-2 text-sm text-stone-500">
        Both drafts were scored independently, blind to each other. This comparison is a separate
        pass — it reports regressions as readily as improvements.
      </p>

      <div className="mt-6 rounded-lg border border-stone-200 bg-white p-5">
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-medium uppercase tracking-widest text-stone-400">Verdict</span>
          <span className="font-serif text-xl capitalize">{mechanical.verdict.from}</span>
          <span className="text-stone-400">→</span>
          <span className={`font-serif text-xl capitalize ${verdictChanged ? '' : 'text-stone-400'}`}>
            {mechanical.verdict.to}
          </span>
          {!verdictChanged && <span className="text-xs text-stone-400">(unchanged)</span>}
        </div>
        {(mechanical.size.from_pages || mechanical.size.to_pages) && (
          <p className="mt-2 text-xs text-stone-400">
            {mechanical.size.from_pages ?? '?'} → {mechanical.size.to_pages ?? '?'} pages ·{' '}
            {mechanical.size.from_scenes ?? '?'} → {mechanical.size.to_scenes ?? '?'} scenes
          </p>
        )}
        {narrative.overall && <p className="mt-3 text-sm text-stone-700">{narrative.overall}</p>}
      </div>

      <section className="mt-8">
        <h2 className="font-serif text-xl">Dimension movement</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <tbody>
              {mechanical.dimensions.map((dim) => {
                const direction = DIRECTION_STYLE[dim.direction]
                const comment = narrative.dimension_comments.find((c) => c.id === dim.id)?.comment
                return (
                  <tr key={dim.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-2.5 font-medium">{dim.name}</td>
                    <td className="px-2 py-2.5 text-right capitalize text-stone-500">
                      {scoreLabel(dim.from_score)}
                    </td>
                    <td className={`px-2 py-2.5 text-center ${direction.className}`}>{direction.symbol}</td>
                    <td className="px-2 py-2.5 capitalize">{scoreLabel(dim.to_score)}</td>
                    <td className="hidden px-4 py-2.5 text-xs text-stone-500 md:table-cell">{comment}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <NarrativeList title="Improved" items={narrative.improved} tone="text-emerald-700" />
        <NarrativeList title="Regressions" items={narrative.regressions} tone="text-red-700" />
        <NarrativeList title="Still unresolved" items={narrative.persisted} tone="text-amber-700" />
        <NarrativeList title="New issues" items={narrative.new_issues} tone="text-stone-500" />
      </section>

      <p className="mt-8 text-xs text-stone-400">
        Open the underlying reports:{' '}
        <Link className="underline" to={`/reports/${diff.payload.from_report_id}`}>earlier draft</Link>
        {' · '}
        <Link className="underline" to={`/reports/${diff.payload.to_report_id}`}>newer draft</Link>
      </p>
    </div>
  )
}
