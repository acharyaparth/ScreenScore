// Mirrors backend/screenscore/schemas/report.schema.json (v1.0) by hand for
// now; if the schema changes, change this file in the same commit.
// (Automated codegen is a recorded follow-up in docs/DECISIONS.md.)

export type Score = 'weak' | 'fair' | 'good' | 'excellent'
export type Verdict = 'pass' | 'consider' | 'recommend'
export type SourceFormat = 'pdf' | 'txt' | 'fountain' | 'fdx'

export interface Evidence {
  scene_number: number
  quote: string
  note?: string | null
}

export interface RubricDimension {
  id: string
  name: string
  score: Score | null
  insufficient_evidence: boolean
  rationale: string
  evidence: Evidence[]
}

export interface Report {
  schema_version: '1.0'
  meta: {
    report_id: string
    draft_id: string
    script_hash: string
    generated_at: string
    engine_version: string
    prompt_version: string
    models: { worker: string | null; reasoning: string | null }
    stub: boolean
  }
  header: {
    title: string
    writers: string[]
    page_count: number | null
    estimated_runtime_minutes: number | null
    scene_count: number | null
    genres: { name: string; confidence: number }[]
    source_format: SourceFormat
    draft_label?: string | null
  }
  logline: string
  synopsis: {
    overview?: string | null
    acts: { act: string; summary: string }[]
  }
  rubric: RubricDimension[]
  characters: {
    principals: {
      name: string
      description: string
      dialogue_share: number | null
      scene_numbers: number[]
      arc_summary: string
    }[]
    graph: { edges: { a: string; b: string; shared_scenes: number }[] }
  }
  comps: {
    disclaimer: string
    items: { title: string; year?: number | null; medium?: 'film' | 'tv' | null; reason: string }[]
  }
  budget_tier: {
    tier: 'micro' | 'low' | 'mid' | 'studio' | 'tentpole'
    drivers: string[]
  }
  content_rating: {
    estimated: string
    drivers: { category: string; detail: string; evidence: Evidence[] }[]
  }
  scene_notes: { scene_number: number; kind: 'standout' | 'problem'; note: string; evidence?: Evidence[] }[]
  recommendation: { verdict: Verdict; rationale: string }
}

// -- API payloads -------------------------------------------------------------

export type ReportStatus = 'queued' | 'running' | 'complete' | 'failed'

export interface ReportRow {
  id: string
  draft_id: string
  schema_version: string
  prompt_version: string
  worker_model: string | null
  reasoning_model: string | null
  status: ReportStatus
  error: string | null
  json_path: string | null
  created_at: string
  completed_at: string | null
  report: Report | null
}

export interface ProjectSummary {
  id: string
  title: string
  created_at: string
  draft_count: number
  report_count: number
  last_activity: string | null
}

export interface DraftDetail {
  id: string
  project_id: string
  content_hash: string
  original_filename: string
  source_format: SourceFormat
  file_path: string
  label: string | null
  uploaded_at: string
  reports: Omit<ReportRow, 'report'>[]
}

export interface ProjectDetail extends ProjectSummary {
  drafts: DraftDetail[]
}

export interface HealthInfo {
  status: string
  engine_version: string
  schema_version: string
  runtime: { available: boolean; backend: string; url: string | null; version: string | null; detail: string | null }
}

export interface HardwareInfo {
  hardware: {
    os: string
    arch: string
    total_ram_gb: number
    apple_silicon: boolean
    gpu: string
    vram_gb: number | null
  }
  recommendation: {
    tier: string
    worker_model: string
    reasoning_model: string
    model_budget_gb: number
    rationale: string
    warnings: string[]
    optional_upgrade: string | null
  }
  runtime_available: boolean
  installed_models: string[]
  models_ready: { worker: boolean; reasoning: boolean }
}

export interface ProgressEvent {
  seq: number
  type: 'stage' | 'tick' | 'done' | 'failed'
  stage?: string
  label?: string
  status?: 'started' | 'completed'
  stage_index?: number
  stage_count?: number
  detail?: string
  report_id?: string
  error?: string
}
