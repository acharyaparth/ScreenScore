import type { HardwareInfo, HealthInfo, ProjectDetail, ProjectSummary, ReportRow } from './types'

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

  async analyze(
    file: File,
    projectId?: string,
  ): Promise<{
    project_id: string
    draft_id: string
    report_id: string
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
}
