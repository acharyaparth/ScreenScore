import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { Callout, SceneChip, ScoreMark, SectionHead, VerdictWord } from '../components/ui'
import type {
  Annotation,
  AnnotationStatus,
  Evidence,
  ParseData,
  Report,
  ReportRow,
  RubricDimension,
} from '../types'

const ANNOTATION_LABEL: Record<AnnotationStatus, string> = {
  working: 'working on it',
  addressed: 'addressed',
  dismissed: 'dismissed',
}

/** What the script pane is currently showing: a scene, an optional quote to
 * mark, and the evidence list being stepped through. */
interface Focus {
  scene: number
  quote: string | null
  list: Evidence[]
  index: number
}

/* ---------------------------------- evidence ---------------------------------- */

function EvidenceList({
  evidence,
  onJump,
}: {
  evidence: Evidence[]
  onJump: (list: Evidence[], index: number) => void
}) {
  if (!evidence.length) return null
  return (
    <ul className="mt-3 space-y-2">
      {evidence.map((ev, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <SceneChip
            scene={ev.scene_number}
            verified
            onClick={() => onJump(evidence, i)}
            title={`Show this line in scene ${ev.scene_number}`}
          />
          <span className="min-w-0">
            <button
              className="text-left italic text-graphite hover:text-ink"
              onClick={() => onJump(evidence, i)}
            >
              “{ev.quote}”
            </button>
            {ev.note && <span className="block text-xs text-graphite/80">{ev.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

/* --------------------------------- annotations -------------------------------- */

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
    <div className="mt-3 border-t border-rule pt-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="label mr-1">Your call</span>
        {(Object.keys(ANNOTATION_LABEL) as AnnotationStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatus(status)}
            aria-pressed={annotation?.status === status}
            className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] transition-colors ${
              annotation?.status === status
                ? 'bg-ink text-white'
                : 'border border-rule bg-sheet text-graphite hover:border-graphite'
            }`}
          >
            {ANNOTATION_LABEL[status]}
          </button>
        ))}
        <button
          onClick={() => setNoteOpen(!noteOpen)}
          className="ml-1 text-xs text-graphite underline decoration-dotted underline-offset-2 hover:text-ink"
        >
          {annotation?.note ? 'edit note' : 'add note'}
        </button>
      </div>
      {annotation?.note && !noteOpen && (
        <p className="mt-1.5 text-xs text-graphite">✎ {annotation.note}</p>
      )}
      {noteOpen && (
        <div className="mt-2 flex gap-2">
          <input
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveNote()}
            placeholder="Note to self for the rewrite…"
            aria-label="Annotation note"
            className="w-full rounded border border-rule px-2 py-1 text-xs"
          />
          <button onClick={saveNote} className="btn text-xs">
            Save
          </button>
        </div>
      )}
    </div>
  )
}

/* ----------------------------------- rubric ----------------------------------- */

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
  onJump: (list: Evidence[], index: number) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="sheet">
      <button
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block font-medium">{dim.name}</span>
          <span className="font-mono text-[11px] text-graphite">
            {dim.insufficient_evidence
              ? 'no verifiable grounding — score withheld'
              : `${dim.evidence.length} verified citation${dim.evidence.length === 1 ? '' : 's'}`}
            {annotation && ` · ✎ ${ANNOTATION_LABEL[annotation.status]}`}
          </span>
        </span>
        <ScoreMark score={dim.score} insufficient={dim.insufficient_evidence} />
      </button>
      {open && (
        <div className="border-t border-rule px-5 py-4">
          {dim.insufficient_evidence && (
            <div className="mb-3">
              <Callout tone="warn">
                <p>
                  No citation for this dimension survived verification against your script, so
                  ScreenScore withholds the score instead of guessing. A cleaner file format or a
                  stronger model can help.
                </p>
              </Callout>
            </div>
          )}
          <p className="text-sm leading-relaxed text-ink">{dim.rationale}</p>
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

/* --------------------------------- script pane -------------------------------- */

function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
}

function SceneBlock({ scene, focus }: { scene: ParseData['scenes'][0]; focus: Focus | null }) {
  const active = focus?.scene === scene.number
  // The block header already shows the slugline — don't print it twice.
  const body = useMemo(() => {
    const text = scene.raw_text
    const firstBreak = text.indexOf('\n')
    if (firstBreak !== -1 && text.slice(0, firstBreak).trim() === scene.slugline) {
      return text.slice(firstBreak + 1).replace(/^\n+/, '')
    }
    return text
  }, [scene.raw_text, scene.slugline])
  const parts = useMemo(() => {
    if (!active || !focus?.quote) return null
    const text = body
    const idx = normalizeForSearch(text).indexOf(normalizeForSearch(focus.quote))
    if (idx === -1) return null
    return [text.slice(0, idx), text.slice(idx, idx + focus.quote.length), text.slice(idx + focus.quote.length)]
  }, [body, active, focus?.quote])

  return (
    <div
      id={`scene-${scene.number}`}
      data-scene={scene.number}
      className={`px-3 py-2 ${active ? 'border-l-2 border-ink bg-page' : ''}`}
    >
      <p className="font-mono text-[11px] font-semibold tracking-wide text-graphite">
        {scene.number} · {scene.slugline}
      </p>
      <pre className="mt-1 whitespace-pre-wrap font-mono text-xs leading-relaxed text-ink/90">
        {parts ? (
          <>
            {parts[0]}
            <mark className="marker-hit px-0.5 font-semibold text-ink">{parts[1]}</mark>
            {parts[2]}
          </>
        ) : (
          body
        )}
      </pre>
    </div>
  )
}

function ScriptPane({
  parse,
  focus,
  onStep,
  onClose,
}: {
  parse: ParseData
  focus: Focus | null
  onStep: (delta: number) => void
  onClose: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [visibleScene, setVisibleScene] = useState<number | null>(null)

  // Sticky context: always name the scene the reader is looking at.
  const onScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const blocks = container.querySelectorAll<HTMLElement>('[data-scene]')
    const top = container.getBoundingClientRect().top + 48
    let current: number | null = null
    blocks.forEach((el) => {
      if (el.getBoundingClientRect().top <= top) current = Number(el.dataset.scene)
    })
    setVisibleScene(current)
  }, [])

  const currentScene = parse.scenes.find((s) => s.number === (visibleScene ?? focus?.scene))
  const hasStepper = focus && focus.list.length > 1

  return (
    <section aria-label="Script" className="sheet flex max-h-[85vh] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-rule bg-page px-3 py-2">
        <p className="min-w-0 truncate font-mono text-[11px] uppercase tracking-wider text-graphite">
          {currentScene ? `${currentScene.number} · ${currentScene.slugline}` : 'Your script'}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {hasStepper && (
            <>
              <span className="mr-1 font-mono text-[11px] text-graphite">
                citation {focus!.index + 1} of {focus!.list.length}
              </span>
              <button className="btn-ghost px-1.5 py-0.5 text-xs" onClick={() => onStep(-1)} aria-label="Previous citation">
                ↑
              </button>
              <button className="btn-ghost px-1.5 py-0.5 text-xs" onClick={() => onStep(1)} aria-label="Next citation">
                ↓
              </button>
            </>
          )}
          <button className="btn-ghost px-2 py-0.5 text-xs lg:hidden" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div ref={scrollRef} onScroll={onScroll} className="divide-y divide-rule/60 overflow-y-auto">
        {parse.scenes.map((scene) => (
          <SceneBlock key={scene.number} scene={scene} focus={focus} />
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------ page ------------------------------------ */

export default function ReportPage() {
  const { reportId } = useParams()
  const [row, setRow] = useState<ReportRow | null>(null)
  const [parse, setParse] = useState<ParseData | null>(null)
  const [annotations, setAnnotations] = useState<Record<string, Annotation>>({})
  const [error, setError] = useState<string | null>(null)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [scriptOpen, setScriptOpen] = useState(false)

  useEffect(() => {
    if (!reportId) return
    api
      .report(reportId)
      .then((r) => {
        setRow(r)
        if (r.draft_id) api.parse(r.draft_id).then(setParse).catch(() => setParse(null))
      })
      .catch((e) => setError(String(e)))
    api
      .annotations(reportId)
      .then((r) => setAnnotations(Object.fromEntries(r.annotations.map((a) => [a.target_ref, a]))))
      .catch(() => {})
  }, [reportId])

  const scrollToScene = useCallback((scene: number) => {
    window.setTimeout(() => {
      document.getElementById(`scene-${scene}`)?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'center',
      })
    }, 80)
  }, [])

  const jump = useCallback(
    (list: Evidence[], index: number) => {
      const ev = list[index]
      setFocus({ scene: ev.scene_number, quote: ev.quote, list, index })
      setScriptOpen(true)
      scrollToScene(ev.scene_number)
    },
    [scrollToScene],
  )

  const jumpScene = useCallback(
    (scene: number) => {
      setFocus({ scene, quote: null, list: [], index: 0 })
      setScriptOpen(true)
      scrollToScene(scene)
    },
    [scrollToScene],
  )

  const step = useCallback(
    (delta: number) => {
      setFocus((prev) => {
        if (!prev || prev.list.length === 0) return prev
        const index = (prev.index + delta + prev.list.length) % prev.list.length
        const ev = prev.list[index]
        scrollToScene(ev.scene_number)
        return { scene: ev.scene_number, quote: ev.quote, list: prev.list, index }
      })
    },
    [scrollToScene],
  )

  const onAnnotation = useCallback((a: Annotation) => {
    setAnnotations((prev) => ({ ...prev, [a.target_ref]: a }))
  }, [])

  if (error) {
    return (
      <Callout tone="error" title="This report couldn't load">
        <p>{error}</p>
      </Callout>
    )
  }
  if (!row) return <p className="text-graphite">Loading the report…</p>
  if (row.status === 'failed') {
    return (
      <div className="mx-auto max-w-column">
        <Callout tone="error" title="This analysis failed">
          <p>{row.error ?? 'No error detail was recorded.'}</p>
          <p className="mt-2 text-xs">
            The draft is still in your library — open its project to run the analysis again.
          </p>
        </Callout>
      </div>
    )
  }
  if (row.status !== 'complete' || !row.report) {
    return (
      <div className="mx-auto max-w-column">
        <Callout tone="info" title="Still analyzing">
          <p>
            This report is {row.status}. Watch its progress on the{' '}
            <Link className="underline" to="/analyze">
              Analyze page
            </Link>
            , or come back — it opens here when finished.
          </p>
        </Callout>
      </div>
    )
  }

  const report: Report = row.report

  return (
    <div className={scriptOpen && parse ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr),26rem]' : 'mx-auto max-w-column'}>
      <article className="min-w-0">
        {report.meta.stub && (
          <div className="mb-6">
            <Callout tone="warn" title="Development model">
              <p>
                This report came from the built-in placeholder model. Structure and citations are
                real; the judgments are not. Analyze with a real local model for actual coverage.
              </p>
            </Callout>
          </div>
        )}

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="label">
              Coverage · {new Date(report.meta.generated_at).toLocaleDateString()}
            </p>
            <h1 className="mt-1 font-serif text-4xl leading-tight">{report.header.title}</h1>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-graphite">
              {[
                report.header.writers.length > 0 && `by ${report.header.writers.join(', ')}`,
                report.header.page_count && `${report.header.page_count} pp`,
                report.header.scene_count && `${report.header.scene_count} scenes`,
                report.header.genres.length > 0 && report.header.genres.map((g) => g.name).join(' / '),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="label mr-1">Export</span>
            {(['pdf', 'md', 'json'] as const).map((fmt) => (
              <a key={fmt} href={`/api/reports/${row.id}/export/${fmt}`} className="btn-ghost px-2 py-1 font-mono text-[11px] uppercase">
                {fmt}
              </a>
            ))}
            {parse && (
              <button className="btn-ghost ml-2 text-sm" onClick={() => setScriptOpen(!scriptOpen)} aria-pressed={scriptOpen}>
                {scriptOpen ? 'Hide script' : 'Show script'}
              </button>
            )}
          </div>
        </header>

        {/* The read: verdict + logline together, first. */}
        <section className="sheet mt-8 px-6 py-5">
          <p className="label">The read</p>
          <div className="mt-2">
            <VerdictWord verdict={report.recommendation.verdict} />
          </div>
          <p className="mt-3 max-w-prose text-sm leading-relaxed">{report.recommendation.rationale}</p>
          <p className="mt-4 border-t border-rule pt-3 font-serif text-lg leading-snug">
            {report.logline}
          </p>
        </section>

        <SectionHead eyebrow="Scored rubric" title="Scorecard" />
        <p className="mt-2 text-xs text-graphite">
          Every score cites lines that were verified to exist in your script. Click any citation
          to see it on the page.
        </p>
        <div className="mt-4 space-y-2">
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

        <SectionHead eyebrow="Story" title="Synopsis" />
        {report.synopsis.overview && (
          <p className="mt-3 text-sm leading-relaxed text-graphite">{report.synopsis.overview}</p>
        )}
        <div className="mt-3 space-y-4">
          {report.synopsis.acts.map((act) => (
            <div key={act.act}>
              <h3 className="label">{act.act}</h3>
              <p className="mt-1 text-sm leading-relaxed">{act.summary}</p>
            </div>
          ))}
        </div>

        <SectionHead eyebrow="People" title="Characters" />
        <div className="mt-4 space-y-2">
          {report.characters.principals.map((c) => (
            <div key={c.name} className="sheet px-5 py-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-mono text-sm font-semibold">{c.name}</h3>
                {c.dialogue_share !== null && (
                  <button
                    className="font-mono text-[11px] text-graphite underline decoration-dotted underline-offset-2 hover:text-ink"
                    onClick={() => c.scene_numbers[0] && jumpScene(c.scene_numbers[0])}
                  >
                    {(c.dialogue_share * 100).toFixed(0)}% of dialogue · {c.scene_numbers.length} scenes
                  </button>
                )}
              </div>
              <p className="mt-1 text-sm">{c.description}</p>
              <p className="mt-0.5 text-sm text-graphite">{c.arc_summary}</p>
            </div>
          ))}
        </div>

        <SectionHead eyebrow="On the page" title="Scene notes" />
        {report.scene_notes.length === 0 ? (
          <p className="mt-3 text-sm text-graphite">The analysis didn't single out standout or problem scenes for this draft.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {report.scene_notes.map((note, index) => (
              <li key={index} className="sheet px-5 py-4 text-sm">
                <div className="flex items-center gap-2">
                  <SceneChip
                    scene={note.scene_number}
                    onClick={() => (note.evidence?.[0] ? jump(note.evidence, 0) : jumpScene(note.scene_number))}
                  />
                  <span
                    className={`font-mono text-[11px] uppercase tracking-wider ${
                      note.kind === 'standout' ? 'text-score-good' : 'text-score-weak'
                    }`}
                  >
                    {note.kind}
                  </span>
                </div>
                <p className="mt-2 leading-relaxed">{note.note}</p>
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
        )}

        <SectionHead eyebrow="Market" title="Commercial" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sheet px-5 py-4">
            <p className="label">Budget tier</p>
            <p className="mt-1 font-serif text-xl capitalize">{report.budget_tier.tier}</p>
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-graphite">
              {report.budget_tier.drivers.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
          <div className="sheet px-5 py-4">
            <p className="label">Content rating (estimated)</p>
            <p className="mt-1 font-serif text-xl">{report.content_rating.estimated}</p>
            <ul className="mt-2 space-y-1.5 text-sm text-graphite">
              {report.content_rating.drivers.map((d, i) => (
                <li key={i}>
                  <span className="capitalize">{d.category.replace('_', ' ')}</span>: {d.detail}
                  {d.evidence.length > 0 && (
                    <span className="ml-1.5 inline-flex gap-1 align-middle">
                      {d.evidence.map((ev, j) => (
                        <SceneChip key={j} scene={ev.scene_number} verified onClick={() => jump(d.evidence, j)} />
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 sheet px-5 py-4">
          <p className="label">Comparable titles</p>
          {report.comps.items.length === 0 ? (
            <p className="mt-2 text-sm text-graphite">The model didn't offer comparable titles for this script.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {report.comps.items.map((comp) => (
                <li key={comp.title}>
                  <span className="font-medium">{comp.title}</span>
                  {comp.year && <span className="text-graphite"> ({comp.year})</span>} —{' '}
                  <span className="text-graphite">{comp.reason}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-rule pt-2 text-xs text-graphite">{report.comps.disclaimer}</p>
        </div>

        <p className="mt-10 font-mono text-[11px] uppercase tracking-wider text-graphite">
          Engine {report.meta.engine_version} · prompts {report.meta.prompt_version}
          {report.meta.models.reasoning && ` · ${report.meta.models.worker} / ${report.meta.models.reasoning}`}{' '}
          · generated locally — nothing left this machine
        </p>
      </article>

      {scriptOpen && parse && (
        <div className="fixed inset-0 z-20 bg-black/30 p-3 lg:static lg:z-auto lg:bg-transparent lg:p-0">
          <div className="mx-auto h-full max-w-lg lg:sticky lg:top-6 lg:h-auto lg:max-w-none">
            <ScriptPane parse={parse} focus={focus} onStep={step} onClose={() => setScriptOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
