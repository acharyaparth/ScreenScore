import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Callout, ReadyRow } from '../components/ui'
import type { HardwareInfo, HealthInfo, ProgressEvent, ProjectSummary } from '../types'

type Phase = 'idle' | 'uploading' | 'running' | 'failed'

/** The pipeline's real stage sequence, pre-rendered so the user sees the
 * whole journey before it starts — never a lone spinner. */
const STAGES: { id: string; label: string }[] = [
  { id: 'parse', label: 'Reading the script' },
  { id: 'segment', label: 'Locating act structure' },
  { id: 'map', label: 'Summarizing every scene' },
  { id: 'characters', label: 'Writing character breakdowns' },
  { id: 'score', label: 'Scoring eight coverage dimensions' },
  { id: 'notes', label: 'Selecting scene notes' },
  { id: 'synthesize', label: 'Writing logline, synopsis and verdict' },
  { id: 'verify', label: 'Checking every citation against the script' },
  { id: 'assemble', label: 'Assembling the report' },
]

interface StageState {
  status: 'pending' | 'started' | 'completed'
  detail?: string
}

interface ParseSummary {
  title: string | null
  scene_count: number
  page_count: number | null
  warnings: string[]
}

export default function AnalyzePage() {
  const [health, setHealth] = useState<HealthInfo | null>(null)
  const [hardware, setHardware] = useState<HardwareInfo | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [targetProject, setTargetProject] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [stages, setStages] = useState<Record<string, StageState>>({})
  const [parseSummary, setParseSummary] = useState<ParseSummary | null>(null)
  const [attachedNotice, setAttachedNotice] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [failedDraftId, setFailedDraftId] = useState<string | null>(null)
  const [connectionLost, setConnectionLost] = useState(false)
  const [pulling, setPulling] = useState<Record<string, string>>({})
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const pollTimer = useRef<number | null>(null)
  const navigate = useNavigate()

  const refreshReadiness = useCallback(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
    api.hardware().then(setHardware).catch(() => setHardware(null))
  }, [])

  useEffect(() => {
    refreshReadiness()
    api.projects().then((r) => setProjects(r.projects)).catch(() => {})
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current)
    }
  }, [refreshReadiness])

  async function pull(model: string) {
    setPulling((p) => ({ ...p, [model]: 'starting download…' }))
    try {
      await api.pullModel(model, (e) => {
        const status = String(e.status ?? '')
        const completed = Number(e.completed ?? 0)
        const total = Number(e.total ?? 0)
        const pct = total > 0 ? ` ${Math.round((completed / total) * 100)}%` : ''
        setPulling((p) => ({ ...p, [model]: `${status}${pct}` }))
      })
      setPulling((p) => {
        const next = { ...p }
        delete next[model]
        return next
      })
      refreshReadiness()
    } catch (e) {
      setPulling((p) => ({ ...p, [model]: `download failed: ${e instanceof Error ? e.message : e}` }))
    }
  }

  function watchRun(reportId: string) {
    setPhase('running')
    setConnectionLost(false)
    setStages(Object.fromEntries(STAGES.map((s) => [s.id, { status: 'pending' as const }])))

    const source = api.progressEvents(reportId)
    const finish = (ok: boolean, error?: string) => {
      source.close()
      if (pollTimer.current) window.clearInterval(pollTimer.current)
      if (ok) navigate(`/reports/${reportId}`)
      else {
        setPhase('failed')
        setRunError(error ?? 'The analysis stopped unexpectedly.')
      }
    }
    source.onmessage = (msg) => {
      setConnectionLost(false)
      const event: ProgressEvent = JSON.parse(msg.data)
      if (event.type === 'stage' && event.stage) {
        setStages((prev) => ({
          ...prev,
          [event.stage!]: { status: event.status === 'completed' ? 'completed' : 'started' },
        }))
      } else if (event.type === 'tick' && event.stage) {
        setStages((prev) => ({
          ...prev,
          [event.stage!]: { status: 'started', detail: event.detail },
        }))
      } else if (event.type === 'done') {
        finish(true)
      } else if (event.type === 'failed') {
        finish(false, event.error)
      }
    }
    // If the live stream drops, the run itself keeps going on the engine —
    // say so, and fall back to polling the report status.
    source.onerror = () => {
      setConnectionLost(true)
      if (pollTimer.current) return
      pollTimer.current = window.setInterval(async () => {
        try {
          const row = await api.report(reportId)
          if (row.status === 'complete') finish(true)
          if (row.status === 'failed') finish(false, row.error ?? undefined)
        } catch {
          /* engine unreachable; keep trying */
        }
      }, 5000)
    }
  }

  async function start(file: File) {
    setPhase('uploading')
    setRunError(null)
    setParseSummary(null)
    setFailedDraftId(null)
    try {
      const ids = await api.analyze(file, targetProject || undefined)
      setParseSummary(ids.parse_summary)
      setFailedDraftId(ids.draft_id)
      setAttachedNotice(
        ids.attached_to_existing
          ? 'Recognized as a new draft of an existing project — it joins that project’s history.'
          : null,
      )
      watchRun(ids.report_id)
    } catch (e) {
      setPhase('failed')
      setRunError(e instanceof Error ? e.message : String(e))
    }
  }

  async function retry() {
    if (!failedDraftId) return
    setRunError(null)
    try {
      const ids = await api.reanalyze(failedDraftId)
      watchRun(ids.report_id)
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e))
    }
  }

  const rec = hardware?.recommendation
  const runtimeUp = hardware?.runtime_available ?? false
  const isFake = health?.runtime.backend === 'fake'
  const workerReady = hardware?.models_ready.worker ?? false
  const reasoningReady = hardware?.models_ready.reasoning ?? false
  const sameModel = rec ? rec.worker_model === rec.reasoning_model : false
  const allReady = isFake || (runtimeUp && workerReady && (sameModel || reasoningReady))

  return (
    <div className="mx-auto max-w-column">
      <p className="label">New analysis</p>
      <h1 className="mt-1 font-serif text-3xl">Analyze a script</h1>
      <p className="mt-2 max-w-lg text-sm text-graphite">
        PDF, Final Draft, Fountain, or plain text. The whole read happens on this machine —
        expect a full-length feature to take on the order of half an hour.
      </p>

      {/* Readiness — each unmet requirement carries its own fix. */}
      <section aria-label="Readiness" className="sheet mt-6 px-5 py-3">
        <p className="label border-b border-rule pb-2">Ready to analyze?</p>
        {isFake ? (
          <p className="py-3 text-sm text-graphite">
            Running with the built-in development model — reports will be clearly labeled as
            placeholders. Good for trying the app, not for real coverage.
          </p>
        ) : (
          <ul className="divide-y divide-rule">
            <ReadyRow
              ok={runtimeUp}
              label="Local model runtime (Ollama)"
              detail={
                runtimeUp
                  ? undefined
                  : (
                    <>
                      Not reachable. Install it free from{' '}
                      <a className="underline" href="https://ollama.com" target="_blank" rel="noreferrer">
                        ollama.com
                      </a>
                      , open it once, then{' '}
                      <button className="underline" onClick={refreshReadiness}>check again</button>.
                    </>
                  )
              }
            />
            {rec && (
              <ReadyRow
                ok={workerReady}
                pending={pulling[rec.worker_model] !== undefined}
                label={`Scene-reading model — ${rec.worker_model}`}
                detail={
                  pulling[rec.worker_model] ??
                  (workerReady ? undefined : 'Needs a one-time download (a few GB). This is the only time ScreenScore uses the internet.')
                }
                action={
                  !workerReady && runtimeUp && !pulling[rec.worker_model] ? (
                    <button className="btn-ghost text-xs" onClick={() => pull(rec.worker_model)}>
                      Download
                    </button>
                  ) : undefined
                }
              />
            )}
            {rec && !sameModel && (
              <ReadyRow
                ok={reasoningReady}
                pending={pulling[rec.reasoning_model] !== undefined}
                label={`Scoring model — ${rec.reasoning_model}`}
                detail={pulling[rec.reasoning_model] ?? (reasoningReady ? undefined : 'Needs a one-time download.')}
                action={
                  !reasoningReady && runtimeUp && !pulling[rec.reasoning_model] ? (
                    <button className="btn-ghost text-xs" onClick={() => pull(rec.reasoning_model)}>
                      Download
                    </button>
                  ) : undefined
                }
              />
            )}
          </ul>
        )}
        {rec && !isFake && (
          <p className="border-t border-rule py-2.5 text-xs text-graphite">
            Picked for this machine: {rec.rationale}
          </p>
        )}
      </section>

      {(phase === 'idle' || phase === 'failed') && (
        <>
          {projects.length > 0 && (
            <label className="mt-6 block text-sm">
              <span className="label">Project</span>
              <select
                value={targetProject}
                onChange={(e) => setTargetProject(e.target.value)}
                className="ml-3 rounded border border-rule bg-sheet px-2 py-1.5 text-sm"
              >
                <option value="">Match by title automatically</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </label>
          )}

          <div
            className={`mt-4 rounded-lg border-2 border-dashed px-8 py-12 text-center transition-colors ${
              dragging ? 'border-ink bg-page' : 'border-rule bg-sheet'
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const file = e.dataTransfer.files[0]
              if (file) start(file)
            }}
          >
            <p className="text-graphite">Drop your screenplay here, or</p>
            <button className="btn mt-3" onClick={() => fileInput.current?.click()}>
              Choose a file
            </button>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-graphite">
              .pdf · .fdx · .fountain · .txt — up to 20 MB
            </p>
            <p className="mx-auto mt-4 max-w-sm text-xs text-graphite">
              What happens next: the script is read scene by scene, scored on eight dimensions,
              and every claim is checked against your pages before the report is saved to your
              library.
            </p>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.txt,.fountain,.fdx"
              className="hidden"
              aria-label="Choose a screenplay file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) start(file)
              }}
            />
          </div>
          {!allReady && phase === 'idle' && (
            <p className="mt-2 text-xs text-graphite">
              You can upload now, but the analysis won't start until the checklist above is green.
            </p>
          )}
        </>
      )}

      {runError && (
        <div className="mt-4">
          <Callout tone="error" title="The analysis failed">
            <p>{runError}</p>
            <div className="mt-3 flex gap-2">
              {failedDraftId && (
                <button className="btn text-xs" onClick={retry}>
                  Run it again
                </button>
              )}
              <button className="btn-ghost text-xs" onClick={refreshReadiness}>
                Re-check readiness
              </button>
            </div>
            {failedDraftId && (
              <p className="mt-2 text-xs">
                Your draft is saved in the library either way — nothing needs re-uploading.
              </p>
            )}
          </Callout>
        </div>
      )}

      {(phase === 'uploading' || phase === 'running') && (
        <section aria-live="polite" className="sheet mt-6 px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-xl">
              {phase === 'uploading'
                ? 'Reading the file…'
                : `Analyzing${parseSummary?.title ? ` “${parseSummary.title}”` : ''}`}
            </h2>
            {parseSummary && (
              <span className="font-mono text-[11px] uppercase tracking-wider text-graphite">
                {parseSummary.scene_count} scenes
                {parseSummary.page_count ? ` · ${parseSummary.page_count} pp` : ''}
              </span>
            )}
          </div>
          {attachedNotice && <p className="mt-1 text-xs text-graphite">{attachedNotice}</p>}
          {parseSummary?.warnings.map((w) => (
            <div key={w} className="mt-3">
              <Callout tone="warn" title="The parser flagged something">
                <p>{w}</p>
                <p className="mt-1 text-xs">
                  This usually means formatting the parser couldn't read with confidence. The
                  analysis continues, but affected dimensions will say “insufficient evidence”
                  rather than guess.
                </p>
              </Callout>
            </div>
          ))}
          {connectionLost && (
            <div className="mt-3">
              <Callout tone="warn" title="Live progress connection lost">
                <p>
                  The analysis is still running on the engine. Progress will resume here, and the
                  report opens automatically when it's done.
                </p>
              </Callout>
            </div>
          )}
          {phase === 'running' && (
            <ol className="mt-4 space-y-2.5">
              {STAGES.map((stage) => {
                const st = stages[stage.id] ?? { status: 'pending' }
                return (
                  <li key={stage.id} className="flex items-center gap-3 text-sm">
                    <span
                      aria-hidden="true"
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border font-mono text-[11px] ${
                        st.status === 'completed'
                          ? 'border-score-good bg-score-good text-white'
                          : st.status === 'started'
                            ? 'animate-pulse border-ink text-ink'
                            : 'border-rule text-rule'
                      }`}
                    >
                      {st.status === 'completed' ? '✓' : st.status === 'started' ? '●' : ''}
                    </span>
                    <span className={st.status === 'pending' ? 'text-graphite' : ''}>{stage.label}</span>
                    {st.detail && st.status === 'started' && (
                      <span className="font-mono text-[11px] text-graphite">{st.detail}</span>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
          <p className="mt-4 border-t border-rule pt-3 text-xs text-graphite">
            You can leave this page — the run continues, and the report will be waiting in your
            library.
          </p>
        </section>
      )}
    </div>
  )
}
