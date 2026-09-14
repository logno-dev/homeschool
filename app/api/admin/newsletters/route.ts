import { randomUUID } from 'crypto'
import { desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { newsletterGroups, newsletters } from '@/lib/schema'
import { snapshotNewsletterRecipients } from '@/lib/newsletters'
import { normalizeEmailSpacing } from '@/lib/email-content'
import { processNewsletterCampaign } from '@/lib/newsletter-broadcasts'

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
    const groupIds: string[] = Array.isArray(body.groupIds) ? Array.from(new Set<string>(body.groupIds.map((groupId: unknown) => String(groupId)))) : []
    const schedule = body.status === 'scheduled'
    const sendNow = body.status === 'send_now'
    const activate = schedule || sendNow
    const scheduledAt = body.scheduledAt ? new Date(String(body.scheduledAt)) : null
    if (schedule && (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date())) return NextResponse.json({ error: 'Choose a future send time' }, { status: 400 })
    if (activate && !groupIds.length) return NextResponse.json({ error: 'Select at least one recipient group' }, { status: 400 })
    let [newsletter] = await db.insert(newsletters).values({
      id: randomUUID(),
      kind: body.kind === 'bulk_email' ? 'bulk_email' : 'newsletter',
      subject: String(body.subject || 'Untitled newsletter').trim(),
      html: normalizeEmailSpacing(String(body.html || '')),
      text: normalizeEmailSpacing(String(body.text || '')),
      senderAlias: body.senderAlias ? String(body.senderAlias) : null,
      replyToAlias: body.replyToAlias ? String(body.replyToAlias) : null,
      includeInactive: Boolean(body.includeInactive),
      status: activate ? 'scheduled' : 'draft',
      scheduledAt: schedule ? scheduledAt!.toISOString() : null,
      createdBy: auth.session.user.id,
      createdAt: now,
      updatedAt: now
    }).returning()
    if (groupIds.length) await db.insert(newsletterGroups).values(groupIds.map((groupId) => ({ id: randomUUID(), newsletterId: newsletter.id, groupId }))).onConflictDoNothing()
    if (activate) {
      const totalRecipients = await snapshotNewsletterRecipients(newsletter.id, groupIds, Boolean(body.includeInactive))
      await db.update(newsletters).set({ totalRecipients }).where(eq(newsletters.id, newsletter.id))
      newsletter.totalRecipients = totalRecipients
    }
    if (sendNow) {
      await processNewsletterCampaign(newsletter)
      ;[newsletter] = await db.select().from(newsletters).where(eq(newsletters.id, newsletter.id)).limit(1)
    }
    return NextResponse.json({ newsletter }, { status: 201 })
  } catch (error) {
    console.error('Error creating newsletter:', error)
    return NextResponse.json({ error: 'Failed to create newsletter' }, { status: 500 })
  }
}
