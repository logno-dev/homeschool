import { randomUUID } from 'crypto'
import { desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { newsletterGroups, newsletters } from '@/lib/schema'

export async function GET() {
  const auth = await getAuthenticatedAdmin('newsletters')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const rows = await db.select().from(newsletters).orderBy(desc(newsletters.updatedAt))
  return NextResponse.json({ newsletters: rows })
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin('newsletters')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const body = await request.json()
    const now = new Date().toISOString()
    const [newsletter] = await db.insert(newsletters).values({
      id: randomUUID(),
      kind: body.kind === 'bulk_email' ? 'bulk_email' : 'newsletter',
      subject: String(body.subject || 'Untitled newsletter').trim(),
      html: String(body.html || ''),
      text: String(body.text || ''),
      includeInactive: Boolean(body.includeInactive),
      createdBy: auth.session.user.id,
      createdAt: now,
      updatedAt: now
    }).returning()
    const groupIds: string[] = Array.isArray(body.groupIds) ? body.groupIds.map((groupId: unknown) => String(groupId)) : []
    if (groupIds.length) await db.insert(newsletterGroups).values(groupIds.map((groupId) => ({ id: randomUUID(), newsletterId: newsletter.id, groupId }))).onConflictDoNothing()
    return NextResponse.json({ newsletter }, { status: 201 })
  } catch (error) {
    console.error('Error creating newsletter:', error)
    return NextResponse.json({ error: 'Failed to create newsletter' }, { status: 500 })
  }
}
