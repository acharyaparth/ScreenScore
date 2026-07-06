import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { HardwareInfo, ProgressEvent } from '../types'

type Phase = 'idle' | 'uploading' | 'running' | 'failed'

interface StageState {
  stage: string
  label: string
  status: 'started' | 'completed'
  detail?: string
}

export default function AnalyzePage() {
  const [hardware, setHardware] = useState<HardwareInfo | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [stages, setStages] = useState<StageState[]>([])
  const [parseSummary, setParseSummary] = useState<{
    title: string | null
    scene_count: number
    page_count: number | null
    warnings: string[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const [pulling, setPulling] = useState<Record<string, string>>({})

  useEffect(() => {
    api.hardware().then(setHardware).catch(() => setHardware(null))
  }, [])

  async function pull(model: string) {
    setPulling((p) => ({ ...p, [model]: 'starting…' }))
    try {
      await api.pullModel(model, (e) => {
        const status = String(e.status ?? '')
        const completed = Number(e.completed ?? 0)
        const total = Number(e.total ?? 0)
        const pct = total > 0 ? ` ${Math.round((completed / total) * 100)}%` : ''
        setPulling((p) => ({ ...p, [model]: `${status}${pct}` }))
      })
      setPulling((p) => ({ ...p, [model]: 'done' }))
      api.hardware().then(setHardware).catch(() => {})
    } catch (e) {
      setPulling((p) => ({ ...p, [model]: `failed: ${e instanceof Error ? e.message : e}` }))
    }
  }

  async function start(file: File) {
    setPhase('uploading')
    setError(null)
    setStages([])
    try {
      const ids = await api.analyze(file)
      setParseSummary(ids.parse_summary)
      setPhase('running')
      const source = api.progressEvents(ids.report_id)
      source.onmessage = (msg) => {
        const event: ProgressEvent = JSON.parse(msg.data)
        if (event.type === 'stage') {
          setStages((prev) => {
            const next = prev.filter((s) => s.stage !== event.stage)
            return [...next, { stage: event.stage!, label: event.label!, status: event.status! }]
          })
        } else if (event.type === 'tick') {
          setStages((prev) =>
            prev.map((s) => (s.stage === event.stage ? { ...s, detail: event.detail } : s)),
          )
        } else if (event.type === 'done') {
          source.close()
          navigate(`/reports/${ids.report_id}`)
        } else if (event.type === 'failed') {
          source.close()
          setPhase('failed')
          setError(event.error ?? 'Analysis failed')
        }
      }
      source.onerror = () => {
        source.close()
        setPhase('failed')
        setError('Lost connection to the analysis run.')
      }
    } catch (e) {
      setPhase('failed')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const rec = hardware?.recommendation

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-3xl">Analyze a script</h1>
      <p className="mt-2 text-sm text-stone-500">
        PDF, TXT, Fountain or Final Draft. The analysis runs entirely on this machine.
      </p>

      {rec && (
        <div className="mt-6 rounded-lg border border-stone-200 bg-white p-5 text-sm">
          <h2 className="font-medium">Recommended setup for this machine</h2>
          <p className="mt-1 text-stone-500">{rec.rationale}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-stone-700">
            <div>
              <dt className="text-xs uppercase tracking-wide text-stone-400">Worker model</dt>
              <dd className="font-mono text-sm">
                {rec.worker_model}
                {hardware!.models_ready.worker ? ' ✓' : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-stone-400">Reasoning model</dt>
              <dd className="font-mono text-sm">
                {rec.reasoning_model}
                {hardware!.models_ready.reasoning ? ' ✓' : ''}
              </dd>
            </div>
          </dl>
          {!hardware!.runtime_available && (
            <p className="mt-3 rounded bg-amber-50 p-3 text-amber-800">
              Ollama isn’t reachable — analysis needs a local model runtime. Install{' '}
              <a href="https://ollama.com" className="underline" target="_blank" rel="noreferrer">
                Ollama
              </a>{' '}
              (free), start it, and refresh this page.
            </p>
          )}
          {hardware!.runtime_available &&
            [
              { role: 'worker', model: rec.worker_model, ready: hardware!.models_ready.worker },
              { role: 'reasoning', model: rec.reasoning_model, ready: hardware!.models_ready.reasoning },
            ]
              .filter((m, i, all) => !m.ready && all.findIndex((x) => x.model === m.model) === i)
              .map(({ model }) => (
                <div key={model} className="mt-3 flex items-center gap-3 rounded bg-stone-50 p-3">
                  <span className="font-mono text-xs">{model}</span>
                  <span className="text-xs text-stone-400">not installed</span>
                  {pulling[model] ? (
                    <span className="text-xs text-stone-500">{pulling[model]}</span>
                  ) : (
                    <button
                      onClick={() => pull(model)}
                      className="rounded bg-stone-900 px-2.5 py-1 text-xs text-white hover:bg-stone-700"
                    >
                      Download
                    </button>
                  )}
                </div>
              ))}
          {rec.warnings.map((w) => (
            <p key={w} className="mt-2 text-xs text-stone-400">{w}</p>
          ))}
        </div>
      )}

      {(phase === 'idle' || phase === 'failed') && (
        <div
          className={`mt-6 cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
            dragging ? 'border-stone-900 bg-stone-100' : 'border-stone-300 bg-white hover:bg-stone-50'
          }`}
          onClick={() => fileInput.current?.click()}
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
          <p className="text-stone-600">Drop your screenplay here, or click to choose a file</p>
          <p className="mt-1 text-xs text-stone-400">.pdf · .txt · .fountain · .fdx — up to 20 MB</p>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.txt,.fountain,.fdx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) start(file)
            }}
          />
        </div>
      )}

      {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {(phase === 'uploading' || phase === 'running') && (
        <div className="mt-6 rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-medium">
            {phase === 'uploading' ? 'Uploading…' : `Analyzing${parseSummary?.title ? ` “${parseSummary.title}”` : ''}`}
          </h2>
          {parseSummary && phase === 'running' && (
            <p className="mt-1 text-xs text-stone-400">
              {parseSummary.scene_count} scenes
              {parseSummary.page_count ? ` · ${parseSummary.page_count} pages` : ''}
            </p>
          )}
          {parseSummary?.warnings.map((w) => (
            <p key={w} className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Parser: {w}
            </p>
          ))}
          <ul className="mt-3 space-y-2 text-sm">
            {stages.map((s) => (
              <li key={s.stage} className="flex items-center gap-2">
                <span
                  className={
                    s.status === 'completed'
                      ? 'text-emerald-600'
                      : 'animate-pulse text-stone-400'
                  }
                >
                  {s.status === 'completed' ? '●' : '○'}
                </span>
                <span>{s.label}</span>
                {s.detail && s.status !== 'completed' && (
                  <span className="text-xs text-stone-400">{s.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
