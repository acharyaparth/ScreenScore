# ScreenScore interface design

The app is a **coverage document you can interrogate**, not a dashboard. Its
audience is a screenwriter or producer reading a professional read of their
script on their own machine. Everything below serves three feelings:
trustworthy, editorial, private.

## Research (Mobbin), and what was borrowed

- **Fabric / Dropbox document review** — a clean document canvas with a
  persistent side rail; annotations display the exact text they anchor to.
  → The script pane is a proper reader, and every citation carries its quote.
- **Perplexity / ChatGPT cited answers** — small inline citation chips in
  running prose; a sources rail with snippets. → Scene-number chips
  (`SC 47`) are the app's grounding mark; clicking one opens the script at
  that scene.
- **Sana AI version history** — chronological rail, "current" badge, grouped
  by day. → The project page reads as a draft timeline, newest first.
- **Wayyy / Workable job progress** — named steps with checkmarks and real
  counts ("scene 120/192"), never a lone spinner. → The analysis screen is a
  stage checklist with a determinate scene counter.
- **Cursor setup checklist** — per-requirement state with the fix action
  inline on the unmet row. → "Ready to analyze" panel: runtime / worker
  model / reasoning model, each row carrying its own Download button.
- **Linear "highlight changes n of m"** — stepping through changes one at a
  time. → The script pane gets a citation stepper (2 of 4 ↑↓) when arriving
  from a dimension's evidence.

No single product was copied; the app should read as coverage, not as any of
these tools.

## Palette (5 named colors + semantic trio)

| Name | Hex | Role |
|---|---|---|
| Page | `#FAFAF8` | app background — script-paper white, not cream |
| Sheet | `#FFFFFF` | cards, panes, the "document" surfaces |
| Ink | `#1A1915` | text, primary buttons, focus rings |
| Graphite | `#6B675F` | secondary text (4.9:1 on Sheet) |
| Rule | `#E7E4DD` | hairlines, borders |
| Marker | `#F5E27A` | the highlighter — evidence highlights only |

Semantic score/verdict colors (used *only* for meaning, never decoration):
weak/pass `#A63A2E`, fair/consider `#8A6512`, good/recommend `#1E6B45`,
excellent `#134F33`.

Hollywood **revision-page colors** identify draft order in library/history
(the industry sequence: white, blue, pink, yellow, green, goldenrod) as small
paper-swatch chips — decoration that encodes something real.

## Typography (system faces only — the app makes no network requests)

- **Display** — Iowan Old Style / Palatino: report title, verdict word,
  section heads. The book-serif voice of coverage prose.
- **Body/UI** — system sans: controls, rationale text, everything read fast.
- **Utility** — ui-monospace (SF Mono): sluglines, scene chips, form labels,
  statuses, counts. The typewritten-form register of studio coverage sheets;
  labels are 11px letterspaced uppercase.

## Layout

Thin top bar (brand · Library · Analyze · "Local" status dot). Content is a
single centered column (max ~52rem) that widens to a two-column
document+script layout on the report when the script pane is open. No
sidebar shell — four routes don't need one. Mobile: script pane becomes a
full-height overlay.

## Signature element

**The verified citation chip → marker sweep.** Citations render as
typewriter margin-references (`SC 47 ✓`). Clicking one opens the script pane,
scrolls to the scene, and sweeps the Marker yellow across the exact quoted
line (a single 500ms highlight animation; static under reduced-motion). A
sticky mono context bar in the pane always names the scene you're looking at.
This is the product thesis — *every claim has an address in your script* —
made physical. Boldness is spent here; everything else stays quiet.

## Self-critique (before building)

- *Generic risk:* warm-cream + serif + white cards is the current AI-default
  look. Countered by: background pushed to script-paper white (not cream), no
  terracotta accent anywhere, personality carried by the typewritten utility
  register, revision-color swatches, and the marker interaction — all
  screenplay-native. The serif stays because coverage is a literary document;
  that's a subject reason, not a habit.
- *Specific to coverage:* scene chips, revision colors, coverage-form labels,
  the marker. A reader who has held studio coverage should feel at home.
- *Removed for discipline:* no left nav shell, no dark mode this pass, no
  character-graph visualization, no numbered section markers (the report's
  sections aren't a sequence), no progress percentage theatre (real counts
  only).
