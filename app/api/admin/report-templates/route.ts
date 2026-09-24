import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { getReportTemplateCatalog, getReportTemplateMappings, saveReportTemplateMappings } from '@/lib/report-service'
import type { ReportTemplateMappings } from '@/lib/report-types'
import { REPORT_TYPES, type ReportType } from '@/lib/report-types'
import { sendFinancialReportTestEmail } from '@/lib/email'

export const maxDuration = 120

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin(['settings', 'reports'])
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const [templates, mappings] = await Promise.all([getReportTemplateCatalog(), getReportTemplateMappings()])
    return NextResponse.json({ templates, mappings })
  } catch (error) {
    console.error('Unable to load report template catalog:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load report templates' }, { status: 502 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin('settings')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const body = await request.json() as { mappings?: ReportTemplateMappings }
    if (!body.mappings || typeof body.mappings !== 'object') return NextResponse.json({ error: 'mappings is required' }, { status: 400 })
    const catalog = await getReportTemplateCatalog()
    const mappings = await saveReportTemplateMappings(body.mappings, catalog)
    return NextResponse.json({ mappings })
  } catch (error) {
    console.error('Unable to save report template mappings:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save report templates' }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin('settings')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const body = await request.json() as { type?: string; to?: string }
    if (!REPORT_TYPES.includes(body.type as ReportType)) return NextResponse.json({ error: 'Select a valid financial report type' }, { status: 400 })
    if (!body.to || !/^\S+@\S+\.\S+$/.test(body.to)) return NextResponse.json({ error: 'Enter a valid test recipient email address' }, { status: 400 })
    await sendFinancialReportTestEmail({ type: body.type as ReportType, to: body.to.trim() })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unable to send report template test:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to send report template test' }, { status: 502 })
  }
}
