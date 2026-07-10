import type { ReactNode } from 'react'
import type { Score, Verdict } from '../types'

/** Coverage-form section header: mono eyebrow + serif title. */
export function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="mt-12 border-b border-rule pb-2">
      <p className="label">{eyebrow}</p>
      <h2 className="mt-0.5 font-serif text-2xl">{title}</h2>
    </header>
  )
}

const SCORE_TEXT: Record<Score, string> = {
  weak: 'text-score-weak',
  fair: 'text-score-fair',
  good: 'text-score-good',
  excellent: 'text-score-excellent',
}

/** Categorical score, typewritten. Insufficient evidence is loud, not hidden. */
export function ScoreMark({ score, insufficient }: { score: Score | null; insufficient: boolean }) {
  if (insufficient || score === null) {
    return (
      <span className="font-mono text-xs uppercase tracking-wide text-graphite">
        insufficient<span className="hidden sm:inline"> evidence</span> ⚠
      </span>
    )
  }
  return (
    <span className={`font-mono text-xs font-semibold uppercase tracking-wide ${SCORE_TEXT[score]}`}>
      {score}
    </span>
  )
}

const VERDICT_STYLE: Record<Verdict, string> = {
  pass: 'text-score-weak border-score-weak/30',
  consider: 'text-score-fair border-score-fair/30',
  recommend: 'text-score-good border-score-good/30',
}

export function VerdictWord({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`inline-block border-b-2 font-serif text-3xl capitalize ${VERDICT_STYLE[verdict]}`}>
      {verdict}
    </span>
  )
}

/** The signature mark: a typewritten margin reference to a scene. */
export function SceneChip({
  scene,
  verified,
  active,
  onClick,
  title,
}: {
  scene: number
  verified?: boolean
  active?: boolean
  onClick?: () => void
  title?: string
}) {
  const inner = (
    <>
      SC&nbsp;{scene}
      {verified && <span aria-hidden="true"> ✓</span>}
    </>
  )
  if (!onClick) {
    return <span className="inline-flex items-center rounded-sm border border-rule bg-page px-1.5 py-0.5 font-mono text-[11px] text-graphite">{inner}</span>
  }
  return (
    <button
      onClick={onClick}
      title={title ?? `Show scene ${scene} in the script`}
      aria-label={title ?? `Show scene ${scene} in the script`}
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[11px] transition-colors ${
        active
          ? 'border-ink bg-ink text-white'
          : 'border-rule bg-page text-ink hover:border-ink'
      }`}
    >
      {inner}
    </button>
  )
}

/** Hollywood revision-page colors, in industry order. Draft 1 is white. */
const REVISION_COLORS = ['#FFFFFF', '#CFE3F5', '#F7D3DC', '#F5E9AF', '#CBE6C8', '#E8C87E']
export const REVISION_NAMES = ['White', 'Blue', 'Pink', 'Yellow', 'Green', 'Goldenrod']

export function RevisionSwatch({ index }: { index: number }) {
  const i = Math.min(index, REVISION_COLORS.length - 1)
  return (
    <span
      className="inline-block h-3.5 w-3 shrink-0 rounded-[1px] border border-rule shadow-[1px_1px_0_rgba(0,0,0,0.06)]"
      style={{ backgroundColor: REVISION_COLORS[i] }}
      title={`${REVISION_NAMES[i]} draft (revision ${index + 1})`}
      aria-hidden="true"
    />
  )
}

const CALLOUT_TONE = {
  info: 'border-rule bg-page text-graphite',
  warn: 'border-score-fair/40 bg-[#FBF6E9] text-[#6B4E0E]',
  error: 'border-score-weak/40 bg-[#FAF0EE] text-[#7C2B21]',
} as const

export function Callout({
  tone,
  title,
  children,
}: {
  tone: keyof typeof CALLOUT_TONE
  title?: string
  children: ReactNode
}) {
  return (
    <div role={tone === 'error' ? 'alert' : 'note'} className={`rounded border px-4 py-3 text-sm ${CALLOUT_TONE[tone]}`}>
      {title && <p className="mb-1 font-medium text-ink">{title}</p>}
      {children}
    </div>
  )
}

/** A requirement row in the readiness checklist (Cursor-style: state + fix inline). */
export function ReadyRow({
  ok,
  pending,
  label,
  detail,
  action,
}: {
  ok: boolean
  pending?: boolean
  label: string
  detail?: ReactNode
  action?: ReactNode
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span
        aria-hidden="true"
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border font-mono text-[11px] ${
          ok
            ? 'border-score-good bg-score-good text-white'
            : pending
              ? 'animate-pulse border-graphite text-graphite'
              : 'border-score-fair text-score-fair'
        }`}
      >
        {ok ? '✓' : pending ? '…' : '!'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">{label}</p>
        {detail && <p className="text-xs text-graphite">{detail}</p>}
      </div>
      {action}
    </li>
  )
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="sheet border-dashed px-8 py-14 text-center">
      <h2 className="font-serif text-2xl">{title}</h2>
      <div className="mx-auto mt-3 max-w-md text-sm text-graphite">{children}</div>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
