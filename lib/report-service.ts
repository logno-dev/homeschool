import 'server-only'

import { createHash, randomUUID } from 'crypto'
import { getGlobalSetting, setGlobalSetting } from '@/lib/database'
import { REPORT_TYPES, REPORT_TYPE_LABELS, type ReportTemplateCatalogItem, type ReportTemplateMappings, type ReportType } from '@/lib/report-types'
import { db } from '@/lib/db'
import { reportJobs } from '@/lib/schema'
import { eq } from 'drizzle-orm'

const MAPPINGS_SETTING = 'report_template_mappings'

function configuration() {
  const baseUrl = process.env.REPORT_API_URL?.trim().replace(/\/$/, '')
  const apiKey = process.env.REPORT_API_KEY?.trim()
  if (!baseUrl || !apiKey) throw new Error('REPORT_API_URL and REPORT_API_KEY must be configured in the active deployment environment')
  return { baseUrl, apiKey }
}

async function reportRequest(path: string, init?: RequestInit, timeoutMs = 20_000) {
  const { baseUrl, apiKey } = configuration()
  const response = await fetch(new URL(path, `${baseUrl}/`), {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers
    },
    signal: AbortSignal.timeout(Math.max(1, timeoutMs))
  })
  return response
}

async function reportError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string; details?: Array<{ path?: string; message?: string }> } } | null
  const detail = payload?.error?.details?.map((entry) => [entry.path, entry.message].filter(Boolean).join(': ')).join('; ')
  return new Error([payload?.error?.message || fallback, detail].filter(Boolean).join(' - '))
}

export async function getReportTemplateCatalog(): Promise<ReportTemplateCatalogItem[]> {
  const response = await reportRequest('v1/report-templates')
  if (!response.ok) throw await reportError(response, 'Unable to load report templates')
  const payload = await response.json() as { items?: ReportTemplateCatalogItem[] }
  return payload.items || []
}

export async function getReportTemplateMappings(): Promise<ReportTemplateMappings> {
  const raw = await getGlobalSetting(MAPPINGS_SETTING)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as ReportTemplateMappings
    return Object.fromEntries(Object.entries(parsed).filter(([type, selection]) => REPORT_TYPES.includes(type as ReportType) && selection && typeof selection.slug === 'string' && Number.isInteger(selection.version) && typeof selection.schemaHash === 'string')) as ReportTemplateMappings
  } catch {
    return {}
  }
}

export async function saveReportTemplateMappings(mappings: ReportTemplateMappings, catalog: ReportTemplateCatalogItem[]) {
  const normalized: ReportTemplateMappings = {}
  for (const type of REPORT_TYPES) {
    const selection = mappings[type]
    if (!selection) continue
    const template = catalog.find((item) => item.slug === selection.slug)
    const version = template?.versions.find((item) => item.version === selection.version && item.schemaHash === selection.schemaHash)
    if (!template || !version) throw new Error(`${REPORT_TYPE_LABELS[type]} references a template version that is not currently published`)
    normalized[type] = { slug: template.slug, version: version.version, schemaHash: version.schemaHash }
  }
  await setGlobalSetting(MAPPINGS_SETTING, JSON.stringify(normalized))
  return normalized
}

export async function generateReportPdf(type: ReportType, data: Record<string, unknown>) {
  const mappings = await getReportTemplateMappings()
  const selection = mappings[type]
  if (!selection) throw new Error(`No published report template is selected for ${REPORT_TYPE_LABELS[type]}`)

  const submitted = await reportRequest('v1/reports', {
    method: 'POST',
    body: JSON.stringify({ template: selection.slug, version: selection.version, schemaHash: selection.schemaHash, data })
  })
  if (!submitted.ok) throw await reportError(submitted, `Unable to submit ${REPORT_TYPE_LABELS[type]}`)
  const job = await submitted.json() as { jobId: string }
  if (!job.jobId) throw new Error('Report service did not return a job ID')
  const now = new Date().toISOString()
  await db.insert(reportJobs).values({
    id: randomUUID(),
    reportType: type,
    providerJobId: job.jobId,
    status: 'queued',
    templateSlug: selection.slug,
    templateVersion: selection.version,
    schemaHash: selection.schemaHash,
    updatedAt: now
  })

  const timeoutMs = Math.min(100_000, Math.max(5_000, Number(process.env.REPORT_POLL_TIMEOUT_MS) || 60_000))
  const deadline = Date.now() + timeoutMs
  let delayMs = 1_000
  let downloadUrl = ''
  let expectedSha = ''

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, Math.max(0, deadline - Date.now()))))
    if (Date.now() >= deadline) break
    let statusResponse: Response
    try {
      statusResponse = await reportRequest(`v1/reports/${encodeURIComponent(job.jobId)}`, undefined, Math.min(20_000, deadline - Date.now()))
    } catch {
      delayMs = Math.min(Math.round(delayMs * 1.5), 5_000)
      continue
    }
    if (statusResponse.status >= 500) {
      delayMs = Math.min(Math.round(delayMs * 1.5), 5_000)
      continue
    }
    if (!statusResponse.ok) {
      const error = await reportError(statusResponse, 'Unable to poll report status')
      await db.update(reportJobs).set({ status: 'failed', error: error.message, updatedAt: new Date().toISOString() }).where(eq(reportJobs.providerJobId, job.jobId))
      throw error
    }
    const status = await statusResponse.json() as { status: string; downloadUrl?: string; sha256?: string; error?: string }
    await db.update(reportJobs).set({ status: status.status, error: status.error || null, updatedAt: new Date().toISOString() }).where(eq(reportJobs.providerJobId, job.jobId))
    if (status.status === 'failed') throw new Error(status.error || `Report job ${job.jobId} failed`)
    if (status.status === 'completed') {
      if (!status.downloadUrl) throw new Error('Completed report did not include a download URL')
      downloadUrl = status.downloadUrl
      expectedSha = status.sha256 || ''
      await db.update(reportJobs).set({ status: 'downloading', updatedAt: new Date().toISOString() }).where(eq(reportJobs.providerJobId, job.jobId))
      break
    }
    delayMs = Math.min(Math.round(delayMs * 1.5), 5_000)
  }

  if (!downloadUrl) {
    await db.update(reportJobs).set({ status: 'failed', error: `Polling timed out after ${Math.round(timeoutMs / 1000)} seconds`, updatedAt: new Date().toISOString() }).where(eq(reportJobs.providerJobId, job.jobId))
    throw new Error(`Report generation timed out after ${Math.round(timeoutMs / 1000)} seconds`)
  }
  try {
    let download: Response | null = null
    let downloadError: unknown
    for (let attempt = 0; attempt < 3 && Date.now() < deadline; attempt++) {
      try {
        const response = await reportRequest(downloadUrl, undefined, Math.min(20_000, deadline - Date.now()))
        if (response.status < 500) {
          download = response
          break
        }
      } catch (error) {
        downloadError = error
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(500 * (attempt + 1), Math.max(0, deadline - Date.now()))))
    }
    if (!download) throw downloadError instanceof Error ? downloadError : new Error('Unable to download completed report before the deadline')
    if (!download.ok) throw await reportError(download, 'Unable to download completed report')
    if (!download.headers.get('content-type')?.toLowerCase().includes('application/pdf')) throw new Error('Report service returned a non-PDF artifact')
    const pdf = Buffer.from(await download.arrayBuffer())
    const actualSha = createHash('sha256').update(pdf).digest('hex')
    const headerSha = download.headers.get('x-content-sha256') || ''
    const checksum = expectedSha || headerSha
    if (checksum && checksum.toLowerCase() !== actualSha) throw new Error('Downloaded report failed its SHA-256 integrity check')
    await db.update(reportJobs).set({ status: 'completed', error: null, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(reportJobs.providerJobId, job.jobId))

    return { pdf, jobId: job.jobId, template: selection }
  } catch (error) {
    await db.update(reportJobs).set({ status: 'failed', error: error instanceof Error ? error.message : 'Report download failed', updatedAt: new Date().toISOString() }).where(eq(reportJobs.providerJobId, job.jobId))
    throw error
  }
}
