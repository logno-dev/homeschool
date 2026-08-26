import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { customReports } from '@/lib/schema'
import { normalizeDefinition } from '@/lib/custom-reports'

export async function GET() {
  const auth = await getAuthenticatedAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const reports = await db.select({ id: customReports.id, name: customReports.name, definition: customReports.definition, updatedAt: customReports.updatedAt }).from(customReports).orderBy(asc(customReports.name))
  return NextResponse.json({ reports: reports.map((report) => ({ ...report, definition: { ...normalizeDefinition(JSON.parse(report.definition)), sessionId: '' } })) })
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await request.json() as { name?: string; definition?: unknown }
  const name = String(body.name || '').trim().slice(0, 100)
  const definition = { ...normalizeDefinition(body.definition), sessionId: '' }
  if (!name || !definition.columns.length) return NextResponse.json({ error: 'Name and at least one column are required' }, { status: 400 })
  const now = new Date().toISOString()
  const [report] = await db.insert(customReports).values({ id: randomUUID(), name, definition: JSON.stringify(definition), createdBy: auth.session.user.id, createdAt: now, updatedAt: now }).returning()
  return NextResponse.json({ report: { ...report, definition } }, { status: 201 })
}

export async function PUT(request: Request) {
  const auth = await getAuthenticatedAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await request.json() as { id?: string; name?: string; definition?: unknown }
  if (!body.id) return NextResponse.json({ error: 'Report id is required' }, { status: 400 })
  const definition = { ...normalizeDefinition(body.definition), sessionId: '' }
  if (!String(body.name || '').trim() || !definition.columns.length) return NextResponse.json({ error: 'Name and at least one column are required' }, { status: 400 })
  const [report] = await db.update(customReports).set({ name: String(body.name).trim().slice(0, 100), definition: JSON.stringify(definition), updatedAt: new Date().toISOString() }).where(eq(customReports.id, body.id)).returning()
  return report ? NextResponse.json({ report: { ...report, definition } }) : NextResponse.json({ error: 'Report not found' }, { status: 404 })
}
