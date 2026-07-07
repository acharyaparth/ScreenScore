import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import type {
  Annotation,
  AnnotationStatus,
  Evidence,
  ParseData,
  Report,
  ReportRow,
  RubricDimension,
  Score,
  Verdict,
} from '../types'

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

const ANNOTATION_LABEL: Record<AnnotationStatus, string> = {
  working: 'working on it',
  addressed: 'addressed',
  dismissed: 'dismissed',
}

interface Highlight {
  scene: number
  quote: string | null
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

function EvidenceList({
  evidence,
  onJump,
}: {
  evidence: Evidence[]
  onJump: (h: Highlight) => void
}) {
  if (!evidence.length) return null
  return (
    <ul className="mt-3 space-y-2">
      {evidence.map((ev, i) => (
        <li key={i} className="border-l-2 border-stone-300 pl-3 text-sm">
          <button
            className="group text-left"
            onClick={() => onJump({ scene: ev.scene_number, quote: ev.quote })}
            title="Show in script"
          >
            <span className="mr-2 font-mono text-xs text-stone-400 underline decoration-dotted group-hover:text-stone-700">
              SC {ev.scene_number}
            </span>
            <span className="italic text-stone-600 group-hover:text-stone-900">“{ev.quote}”</span>
          </button>
          {ev.note && <p className="mt-0.5 text-xs text-stone-400">{ev.note}</p>}
        </li>
      ))}
    </ul>
  )
}

/** The writer's memory layer: status + note per report element. */
function AnnotationControl({
  reportId,
  targetRef,
  annotation,
  onChange,
}: {
  reportId: string
  targetRef: string
  annotation: Annotation | undefined
  onChange: (a: Annotation) => void
}) {
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState(annotation?.note ?? '')

  async function setStatus(status: AnnotationStatus) {
    const updated = annotation
      ? await api.updateAnnotation(annotation.id, { status })
      : await api.createAnnotation(reportId, targetRef, status)
    onChange(updated)
  }

  async function saveNote() {
    const updated = annotation
      ? await api.updateAnnotation(annotation.id, { note: noteDraft })
      : await api.createAnnotation(reportId, targetRef, 'working', noteDraft)
    onChange(updated)
    setNoteOpen(false)
  }

  return (
    <div className="mt-3 border-t border-stone-100 pt-2">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {(Object.keys(ANNOTATION_LABEL) as AnnotationStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatus(status)}
            className={`rounded-full px-2.5 py-0.5 ring-1 transition-colors ${
              annotation?.status === status
                ? 'bg-stone-900 text-white ring-stone-900'
                : 'bg-white text-stone-500 ring-stone-200 hover:ring-stone-400'
            }`}
          >
            {ANNOTATION_LABEL[status]}
          </button>
        ))}
        <button
          onClick={() => setNoteOpen(!noteOpen)}
          className="ml-1 text-stone-400 underline decoration-dotted hover:text-stone-700"
        >
          {annotation?.note ? 'edit note' : 'add note'}
        </button>
      </div>
      {annotation?.note && !noteOpen && (
        <p className="mt-1.5 text-xs text-stone-500">✎ {annotation.note}</p>
      )}
      {noteOpen && (
        <div className="mt-2 flex gap-2">
          <input
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveNote()}
            placeholder="Your note to self…"
            className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
          />
          <button onClick={saveNote} className="rounded bg-stone-900 px-2 py-1 text-xs text-white">
            Save
          </button>
        </div>
      )}
    </div>
  )
}

function Dimension({
  dim,
  reportId,
  targetRef,
  annotation,
  onAnnotation,
  onJump,
}: {
  dim: RubricDimension
  reportId: string
  targetRef: string
  annotation: Annotation | undefined
  onAnnotation: (a: Annotation) => void
  onJump: (h: Highlight) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      <button
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="font-medium">
          {dim.name}
          {annotation && (
            <span className="ml-2 text-xs font-normal text-stone-400">
              · {ANNOTATION_LABEL[annotation.status]}
            </span>
          )}
        </span>
        <ScorePill score={dim.score} insufficient={dim.insufficient_evidence} />
      </button>
      {open && (
        <div className="border-t border-stone-100 px-5 py-4">
          <p className="text-sm text-stone-600">{dim.rationale}</p>
          <EvidenceList evidence={dim.evidence} onJump={onJump} />
          <AnnotationControl
            reportId={reportId}
            targetRef={targetRef}
            annotation={annotation}
            onChange={onAnnotation}
          />
        </div>
      )}
    </div>
  )
}

/** Length-preserving normalization so match indexes map back to the source. */
function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
}

function SceneBlock({ scene, highlight }: { scene: ParseData['scenes'][0]; highlight: Highlight | null }) {
  const active = highlight?.scene === scene.number
  const parts = useMemo(() => {
    const text = scene.raw_text
    if (!active || !highlight?.quote) return null
    const idx = normalizeForSearch(text).indexOf(normalizeForSearch(highlight.quote))
    if (idx === -1) return null
    return [text.slice(0, idx), text.slice(idx, idx + highlight.quote.length), text.slice(idx + highlight.quote.length)]
  }, [scene.raw_text, active, highlight?.quote])

  return (
    <div
      id={`scene-${scene.number}`}
      className={`rounded px-3 py-2 ${active ? 'bg-amber-50 ring-1 ring-amber-200' : ''}`}
    >
      <p className="font-mono text-xs font-semibold text-stone-500">
        {scene.number}. {scene.slugline}
      </p>
      <pre className="mt-1 whitespace-pre-wrap font-mono text-xs leading-relaxed text-stone-700">
        {parts ? (
          <>
            {parts[0]}
            <mark className="bg-amber-200 px-0.5">{parts[1]}</mark>
            {parts[2]}
          </>
        ) : (
          scene.raw_text
        )}
      </pre>
    </div>
  )
}

function ScriptPane({ parse, highlight }: { parse: ParseData; highlight: Highlight | null }) {
  return (
    <div className="max-h-[85vh] overflow-y-auto rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="mb-3 font-serif text-lg">Script</h2>
      <div className="space-y-3">
        {parse.scenes.map((scene) => (
          <SceneBlock key={scene.number} scene={scene} highlight={highlight} />
        ))}
      </div>
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
  const [parse, setParse] = useState<ParseData | null>(null)
  const [annotations, setAnnotations] = useState<Record<string, Annotation>>({})
  const [error, setError] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<Highlight | null>(null)
  const [scriptOpen, setScriptOpen] = useState(false)
  const scriptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!reportId) return
    api.report(reportId).then((r) => {
      setRow(r)
      if (r.draft_id) api.parse(r.draft_id).then(setParse).catch(() => setParse(null))
    }).catch((e) => setError(String(e)))
    api.annotations(reportId).then((r) => {
      setAnnotations(Object.fromEntries(r.annotations.map((a) => [a.target_ref, a])))
    }).catch(() => {})
  }, [reportId])

  const jump = useCallback((h: Highlight) => {
    setHighlight(h)
    setScriptOpen(true)
    // Wait for the pane to render before scrolling.
    setTimeout(() => {
      document.getElementById(`scene-${h.scene}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
  }, [])

  const onAnnotation = useCallback((a: Annotation) => {
    setAnnotations((prev) => ({ ...prev, [a.target_ref]: a }))
  }, [])

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
    <div className={scriptOpen && parse ? 'mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr),420px]' : ''}>
      <article className="min-w-0">
        {report.meta.stub && (
          <p className="mb-6 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This report was generated by the <strong>built-in development model</strong>, not a real
            analysis model. Structure and citations are real; the judgments are placeholders.
          </p>
        )}

        <header className="flex items-start justify-between gap-4">
          <div>
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
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-stone-400">Export</span>
            {(['pdf', 'md', 'json'] as const).map((fmt) => (
              <a
                key={fmt}
                href={`/api/reports/${row.id}/export/${fmt}`}
                className="rounded border border-stone-300 px-2 py-1 text-xs uppercase text-stone-600 hover:bg-stone-100"
              >
                {fmt}
              </a>
            ))}
            {parse && (
              <button
                onClick={() => setScriptOpen(!scriptOpen)}
                className="ml-2 rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100"
              >
                {scriptOpen ? 'Hide script' : 'Show script'}
              </button>
            )}
          </div>
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
            {report.rubric.map((dim, index) => (
              <Dimension
                key={dim.id}
                dim={dim}
                reportId={row.id}
                targetRef={`/rubric/${index}`}
                annotation={annotations[`/rubric/${index}`]}
                onAnnotation={onAnnotation}
                onJump={jump}
              />
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
                      {(c.dialogue_share * 100).toFixed(0)}% of dialogue ·{' '}
                      <button
                        className="underline decoration-dotted hover:text-stone-700"
                        onClick={() => c.scene_numbers[0] && jump({ scene: c.scene_numbers[0], quote: null })}
                      >
                        {c.scene_numbers.length} scenes
                      </button>
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
            {report.scene_notes.map((note, index) => (
              <li key={index} className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
                <button
                  className={`mr-2 rounded px-2 py-0.5 text-xs font-medium underline-offset-2 hover:underline ${
                    note.kind === 'standout' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}
                  onClick={() => jump({ scene: note.scene_number, quote: note.evidence?.[0]?.quote ?? null })}
                >
                  {note.kind} · scene {note.scene_number}
                </button>
                <p className="mt-2 text-stone-700">{note.note}</p>
                {note.evidence && <EvidenceList evidence={note.evidence} onJump={jump} />}
                <AnnotationControl
                  reportId={row.id}
                  targetRef={`/scene_notes/${index}`}
                  annotation={annotations[`/scene_notes/${index}`]}
                  onChange={onAnnotation}
                />
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
          {report.schema_version}
          {report.meta.models.reasoning &&
            ` · models ${report.meta.models.worker} / ${report.meta.models.reasoning}`}{' '}
          · generated locally, never uploaded.
        </p>
      </article>

      {scriptOpen && parse && (
        <div ref={scriptRef} className="lg:sticky lg:top-6 lg:self-start">
          <ScriptPane parse={parse} highlight={highlight} />
        </div>
      )}
    </div>
  )
}
