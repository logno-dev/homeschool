import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { executeReport, csvValue, normalizeDefinition } from '@/lib/custom-reports'
import { REPORT_FIELDS } from '@/lib/report-fields'

export async function POST(request: Request) {
  const auth = await getAuthenticatedAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await request.json() as { definition?: unknown; format?: string }
  const definition = normalizeDefinition(body.definition)
  const sessionRequired = definition.scope === 'roster' || definition.columns.some((column) => ['paymentStatus', 'paidAmount', 'totalAmount'].includes(column))
  if ((sessionRequired && !definition.sessionId) || !definition.columns.length) return NextResponse.json({ error: `${sessionRequired ? 'Session and ' : ''}at least one column are required` }, { status: 400 })
  const rows = await executeReport(definition)
  if (body.format === 'csv') {
    const labels = definition.columns.map((column) => REPORT_FIELDS.find((field) => field.key === column)?.label || column)
    const csv = [labels, ...rows.map((row) => definition.columns.map((column) => csvValue(row[column])))] .map((row) => row.join(',')).join('\n')
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="custom-report.csv"' } })
  }
  return NextResponse.json({ rows, count: rows.length })
}
