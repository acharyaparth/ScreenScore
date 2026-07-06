import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import type { Evidence, Report, ReportRow, RubricDimension, Score, Verdict } from '../types'

const SCORE_STYLE: Record<Score, string> = {
  weak: 'bg-red-50 text-red-700 ring-red-200',
  fair: 'bg-amber-50 text-amber-700 ring-amber-200',
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  excellent: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
}

const VERDICT_STYLE: Record<Verdict, string> = {
  pass: 'bg-red-50 text-red-800 border-red-200',
  consider: 'bg-amber-50 text-amber-800 border-amber-200',
  recommend: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}

function ScorePill({ score, insufficient }: { score: Score | null; insufficient: boolean }) {
  if (insufficient || score === null) {
    return (
      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500 ring-1 ring-stone-200">
        insufficient evidence
      </span>
    )
  }
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ring-1 ${SCORE_STYLE[score]}`}>
      {score}
    </span>
  )
}

function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) return null
  return (
    <ul className="mt-3 space-y-2">
      {evidence.map((ev, i) => (
        <li key={i} className="border-l-2 border-stone-300 pl-3 text-sm">
          <span className="mr-2 font-mono text-xs text-stone-400">SC {ev.scene_number}</span>
          <span className="italic text-stone-600">“{ev.quote}”</span>
          {ev.note && <p className="mt-0.5 text-xs text-stone-400">{ev.note}</p>}
        </li>
      ))}
    </ul>
  )
}

function Dimension({ dim }: { dim: RubricDimension }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      <button
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="font-medium">{dim.name}</span>
        <ScorePill score={dim.score} insufficient={dim.insufficient_evidence} />
      </button>
      {open && (
        <div className="border-t border-stone-100 px-5 py-4">
          <p className="text-sm text-stone-600">{dim.rationale}</p>
          <EvidenceList evidence={dim.evidence} />
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-xl">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export default function ReportPage() {
  const { reportId } = useParams()
  const [row, setRow] = useState<ReportRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (reportId) api.report(reportId).then(setRow).catch((e) => setError(String(e)))
  }, [reportId])

  if (error) return <p className="text-red-700">{error}</p>
  if (!row) return <p className="text-stone-400">Loading…</p>
  if (row.status !== 'complete' || !row.report) {
    return (
      <p className="text-stone-500">
        This report is {row.status}.{' '}
        {row.error && <span className="text-red-700">{row.error}</span>}
      </p>
    )
  }

  const report: Report = row.report
  const verdict = report.recommendation.verdict

  return (
    <article>
      {report.meta.stub && (
        <p className="mb-6 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This is a <strong>stub report</strong> from the Phase 1 skeleton — placeholder content
          proving the pipeline, storage and UI contracts. Real analysis lands in Phase 3.
        </p>
      )}

      <header>
        <p className="text-sm text-stone-400">
          Coverage · {new Date(report.meta.generated_at).toLocaleDateString()}
        </p>
        <h1 className="mt-1 font-serif text-4xl">{report.header.title}</h1>
        <p className="mt-2 text-sm text-stone-500">
          {report.header.page_count && `${report.header.page_count} pages`}
          {report.header.estimated_runtime_minutes && ` · ≈${report.header.estimated_runtime_minutes} min`}
          {report.header.scene_count && ` · ${report.header.scene_count} scenes`}
          {report.header.genres.length > 0 && ` · ${report.header.genres.map((g) => g.name).join(', ')}`}
        </p>
      </header>

      <div className={`mt-8 rounded-lg border px-6 py-5 ${VERDICT_STYLE[verdict]}`}>
        <p className="text-xs font-medium uppercase tracking-widest">Recommendation</p>
        <p className="mt-1 font-serif text-2xl capitalize">{verdict}</p>
        <p className="mt-2 text-sm">{report.recommendation.rationale}</p>
      </div>

      <Section title="Logline">
        <p className="text-stone-700">{report.logline}</p>
      </Section>

      <Section title="Scorecard">
        <div className="space-y-2">
          {report.rubric.map((dim) => (
            <Dimension key={dim.id} dim={dim} />
          ))}
        </div>
      </Section>

      <Section title="Synopsis">
        {report.synopsis.overview && <p className="text-sm text-stone-600">{report.synopsis.overview}</p>}
        <div className="mt-3 space-y-4">
          {report.synopsis.acts.map((act) => (
            <div key={act.act}>
              <h3 className="text-sm font-medium text-stone-500">{act.act}</h3>
              <p className="mt-1 text-sm text-stone-700">{act.summary}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Characters">
        <div className="space-y-3">
          {report.characters.principals.map((c) => (
            <div key={c.name} className="rounded-lg border border-stone-200 bg-white p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="font-medium">{c.name}</h3>
                {c.dialogue_share !== null && (
                  <span className="text-xs text-stone-400">
                    {(c.dialogue_share * 100).toFixed(0)}% of dialogue · {c.scene_numbers.length} scenes
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-stone-600">{c.description}</p>
              <p className="mt-1 text-sm text-stone-500">{c.arc_summary}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Scene notes">
        <ul className="space-y-3">
          {report.scene_notes.map((note, i) => (
            <li key={i} className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
              <span
                className={`mr-2 rounded px-2 py-0.5 text-xs font-medium ${
                  note.kind === 'standout' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {note.kind} · scene {note.scene_number}
              </span>
              <p className="mt-2 text-stone-700">{note.note}</p>
              {note.evidence && <EvidenceList evidence={note.evidence} />}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Comparables">
        <p className="text-xs text-stone-400">{report.comps.disclaimer}</p>
        <ul className="mt-3 space-y-2">
          {report.comps.items.map((comp) => (
            <li key={comp.title} className="text-sm">
              <span className="font-medium">{comp.title}</span>
              {comp.year && <span className="text-stone-400"> ({comp.year})</span>} —{' '}
              <span className="text-stone-600">{comp.reason}</span>
            </li>
          ))}
        </ul>
      </Section>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <h3 className="text-xs font-medium uppercase tracking-widest text-stone-400">Budget tier</h3>
          <p className="mt-1 font-serif text-xl capitalize">{report.budget_tier.tier}</p>
          <ul className="mt-2 list-inside list-disc text-sm text-stone-600">
            {report.budget_tier.drivers.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <h3 className="text-xs font-medium uppercase tracking-widest text-stone-400">Content rating</h3>
          <p className="mt-1 font-serif text-xl">{report.content_rating.estimated}</p>
          <ul className="mt-2 space-y-1 text-sm text-stone-600">
            {report.content_rating.drivers.map((d, i) => (
              <li key={i}>
                <span className="capitalize">{d.category.replace('_', ' ')}</span>: {d.detail}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-10 text-xs text-stone-400">
        Engine {report.meta.engine_version} · prompts {report.meta.prompt_version} · schema{' '}
        {report.schema_version} · generated locally, never uploaded.
      </p>
    </article>
  )
}
