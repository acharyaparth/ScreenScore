import type {
  Annotation,
  AnnotationStatus,
  DiffRow,
  HardwareInfo,
  HealthInfo,
  ParseData,
  ProjectDetail,
  ProjectSummary,
  ReportRow,
} from './types'

async function getJson<T>(url: string): Promise<T> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`${url}: ${resp.status} ${await resp.text()}`)
  return resp.json()
}

export const api = {
  health: () => getJson<HealthInfo>('/api/health'),
  hardware: () => getJson<HardwareInfo>('/api/hardware'),
  projects: () => getJson<{ projects: ProjectSummary[] }>('/api/projects'),
  project: (id: string) => getJson<ProjectDetail>(`/api/projects/${id}`),
  report: (id: string) => getJson<ReportRow>(`/api/reports/${id}`),
  parse: (draftId: string) => getJson<ParseData>(`/api/drafts/${draftId}/parse`),
  annotations: (reportId: string) =>
    getJson<{ annotations: Annotation[] }>(`/api/reports/${reportId}/annotations`),
  diff: (id: string) => getJson<DiffRow>(`/api/diffs/${id}`),

  async createAnnotation(
    reportId: string,
    targetRef: string,
    status: AnnotationStatus,
    note?: string,
  ): Promise<Annotation> {
    const resp = await fetch(`/api/reports/${reportId}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_ref: targetRef, status, note: note ?? null }),
    })
    if (!resp.ok) throw new Error(`annotation failed (${resp.status})`)
    return resp.json()
  },

  async updateAnnotation(
    id: string,
    patch: { status?: AnnotationStatus; note?: string },
  ): Promise<Annotation> {
    const resp = await fetch(`/api/annotations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!resp.ok) throw new Error(`annotation update failed (${resp.status})`)
    return resp.json()
  },

  async createDiff(fromReportId: string, toReportId: string): Promise<{ diff_id: string }> {
    const resp = await fetch('/api/diffs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_report_id: fromReportId, to_report_id: toReportId }),
    })
    if (!resp.ok) {
      const body = await resp.json().catch(() => null)
      throw new Error(body?.detail ?? `diff failed (${resp.status})`)
    }
    return resp.json()
  },

  async analyze(
    file: File,
    projectId?: string,
  ): Promise<{
    project_id: string
    draft_id: string
    report_id: string
    attached_to_existing: boolean
    parse_summary: { title: string | null; scene_count: number; page_count: number | null; warnings: string[] }
  }> {
    const form = new FormData()
    form.append('file', file)
    if (projectId) form.append('project_id', projectId)
    const resp = await fetch('/api/analyze', { method: 'POST', body: form })
    if (!resp.ok) {
      const body = await resp.json().catch(() => null)
      throw new Error(body?.detail ?? `Upload failed (${resp.status})`)
    }
    return resp.json()
  },

  progressEvents(reportId: string): EventSource {
    return new EventSource(`/api/reports/${reportId}/events`)
  },

  async pullModel(model: string, onEvent: (e: Record<string, unknown>) => void): Promise<void> {
    const resp = await fetch('/api/models/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    })
    if (!resp.ok || !resp.body) throw new Error(`pull failed (${resp.status})`)
    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        if (part.startsWith('data: ')) onEvent(JSON.parse(part.slice(6)))
      }
    }
  },
}
