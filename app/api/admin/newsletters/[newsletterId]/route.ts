import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { newsletterGroups, newsletterRecipients, newsletters } from '@/lib/schema'
import { getNewsletterGroupIds, snapshotNewsletterRecipients } from '@/lib/newsletters'

export async function GET(request: Request, { params }: { params: Promise<{ newsletterId: string }> }) {
  const auth = await getAuthenticatedAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { newsletterId } = await params
  const [newsletter] = await db.select().from(newsletters).where(eq(newsletters.id, newsletterId)).limit(1)
  if (!newsletter) return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 })
  const groupIds = await getNewsletterGroupIds(newsletterId)
  const recipients = await db.select().from(newsletterRecipients).where(eq(newsletterRecipients.newsletterId, newsletterId))
  return NextResponse.json({ newsletter, groupIds, recipients })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ newsletterId: string }> }) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { newsletterId } = await params
    const [existing] = await db.select().from(newsletters).where(eq(newsletters.id, newsletterId)).limit(1)
    if (!existing) return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 })
    if (!['draft', 'scheduled'].includes(existing.status)) return NextResponse.json({ error: 'This newsletter can no longer be edited' }, { status: 400 })

    const body = await request.json()
    const groupIds: string[] = Array.isArray(body.groupIds)
      ? Array.from(new Set<string>(body.groupIds.map((groupId: unknown) => String(groupId))))
      : await getNewsletterGroupIds(newsletterId)
    const schedule = body.status === 'scheduled'
    const scheduledAt = body.scheduledAt ? new Date(String(body.scheduledAt)) : null
    if (schedule && (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date())) {
      return NextResponse.json({ error: 'Choose a future send time' }, { status: 400 })
    }
    if (schedule && !groupIds.length) return NextResponse.json({ error: 'Select at least one recipient group' }, { status: 400 })

    const now = new Date().toISOString()
    await db.update(newsletters).set({
      kind: body.kind === 'bulk_email' ? 'bulk_email' : body.kind === 'newsletter' ? 'newsletter' : existing.kind,
      subject: body.subject === undefined ? existing.subject : String(body.subject).trim(),
      html: body.html === undefined ? existing.html : String(body.html),
      text: body.text === undefined ? existing.text : String(body.text),
      includeInactive: body.includeInactive === undefined ? existing.includeInactive : Boolean(body.includeInactive),
      scheduledAt: schedule ? scheduledAt!.toISOString() : body.status === 'draft' ? null : existing.scheduledAt,
      status: body.status === 'draft' ? 'draft' : schedule ? 'scheduled' : existing.status,
      updatedAt: now,
      lastError: null
    }).where(eq(newsletters.id, newsletterId))

    if (body.groupIds !== undefined) {
      await db.delete(newsletterGroups).where(eq(newsletterGroups.newsletterId, newsletterId))
      if (groupIds.length) await db.insert(newsletterGroups).values(groupIds.map((groupId) => ({ id: randomUUID(), newsletterId, groupId }))).onConflictDoNothing()
    }
    if (schedule) {
      const totalRecipients = await snapshotNewsletterRecipients(newsletterId, groupIds, body.includeInactive === undefined ? existing.includeInactive : Boolean(body.includeInactive))
      await db.update(newsletters).set({ totalRecipients, totalSent: 0, totalFailed: 0, updatedAt: now }).where(eq(newsletters.id, newsletterId))
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating newsletter:', error)
    return NextResponse.json({ error: 'Failed to update newsletter' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ newsletterId: string }> }) {
  const auth = await getAuthenticatedAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { newsletterId } = await params
  await db.delete(newsletters).where(and(eq(newsletters.id, newsletterId), eq(newsletters.status, 'draft')))
  return NextResponse.json({ success: true })
}
