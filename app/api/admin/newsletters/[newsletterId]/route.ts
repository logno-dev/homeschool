import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { newsletterGroups, newsletterRecipients, newsletters } from '@/lib/schema'
import { getNewsletterGroupIds, snapshotNewsletterRecipients } from '@/lib/newsletters'
import { normalizeEmailSpacing } from '@/lib/email-content'
import { getNewsletterBroadcastMetrics } from '@/lib/email'
import { processNewsletterCampaign } from '@/lib/newsletter-broadcasts'

export async function GET(request: Request, { params }: { params: Promise<{ newsletterId: string }> }) {
  const auth = await getAuthenticatedAdmin('newsletters')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { newsletterId } = await params
  let [newsletter] = await db.select().from(newsletters).where(eq(newsletters.id, newsletterId)).limit(1)
  if (!newsletter) return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 })
  let metricsError: string | null = null
  if (newsletter.status === 'sent' && newsletter.resendBroadcastId) {
    const knownSent = Math.max(newsletter.totalSent, newsletter.totalRecipients - newsletter.totalFailed)
    if (knownSent !== newsletter.totalSent) {
      await db.update(newsletters).set({ totalSent: knownSent }).where(eq(newsletters.id, newsletterId))
      newsletter = { ...newsletter, totalSent: knownSent }
    }
  }
  const forceMetrics = new URL(request.url).searchParams.get('refresh') === '1'
  const metricsAreStale = !newsletter.metricsUpdatedAt || Date.now() - new Date(newsletter.metricsUpdatedAt).getTime() >= 15 * 60 * 1000
  const metricsReady = !newsletter.sentAt || Date.now() - new Date(newsletter.sentAt).getTime() >= 15 * 60 * 1000
  if (newsletter.status === 'sent' && newsletter.resendBroadcastId && metricsReady && (forceMetrics || metricsAreStale)) {
    try {
      const metrics = await getNewsletterBroadcastMetrics(newsletter.resendBroadcastId)
      const metricsUpdatedAt = new Date().toISOString()
      await db.update(newsletters).set({
        totalSent: Math.max(newsletter.totalSent, metrics.sent),
        deliveredCount: metrics.delivered,
        openedCount: metrics.opened,
        clickedCount: metrics.clicked,
        bouncedCount: metrics.bounced,
        complainedCount: metrics.complained,
        unsubscribedCount: metrics.unsubscribed,
        suppressedCount: metrics.suppressed,
        metricsUpdatedAt,
        updatedAt: metricsUpdatedAt
      }).where(eq(newsletters.id, newsletterId))
      ;[newsletter] = await db.select().from(newsletters).where(eq(newsletters.id, newsletterId)).limit(1)
    } catch (error) {
      metricsError = error instanceof Error ? error.message : 'Unable to refresh Resend delivery details'
      console.error('Error refreshing newsletter delivery metrics:', error)
    }
  } else if (newsletter.status === 'sent' && newsletter.resendBroadcastId && !metricsReady) {
    metricsError = 'Resend delivery details can take up to 15 minutes to become available.'
  }
  const groupIds = await getNewsletterGroupIds(newsletterId)
  const recipients = await db.select().from(newsletterRecipients).where(eq(newsletterRecipients.newsletterId, newsletterId))
  return NextResponse.json({ newsletter, groupIds, recipients, metricsError })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ newsletterId: string }> }) {
  try {
    const auth = await getAuthenticatedAdmin('newsletters')
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
    const sendNow = body.status === 'send_now'
    const activate = schedule || sendNow
    const scheduledAt = body.scheduledAt ? new Date(String(body.scheduledAt)) : null
    if (schedule && (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date())) {
      return NextResponse.json({ error: 'Choose a future send time' }, { status: 400 })
    }
    if (activate && !groupIds.length) return NextResponse.json({ error: 'Select at least one recipient group' }, { status: 400 })

    const now = new Date().toISOString()
    await db.update(newsletters).set({
      kind: body.kind === 'bulk_email' ? 'bulk_email' : body.kind === 'newsletter' ? 'newsletter' : existing.kind,
      subject: body.subject === undefined ? existing.subject : String(body.subject).trim(),
      html: body.html === undefined ? existing.html : normalizeEmailSpacing(String(body.html)),
      text: body.text === undefined ? existing.text : normalizeEmailSpacing(String(body.text)),
      senderAlias: body.senderAlias === undefined ? existing.senderAlias : (body.senderAlias ? String(body.senderAlias) : null),
      replyToAlias: body.replyToAlias === undefined ? existing.replyToAlias : (body.replyToAlias ? String(body.replyToAlias) : null),
      includeInactive: body.includeInactive === undefined ? existing.includeInactive : Boolean(body.includeInactive),
      scheduledAt: schedule ? scheduledAt!.toISOString() : sendNow || body.status === 'draft' ? null : existing.scheduledAt,
      status: body.status === 'draft' ? 'draft' : activate ? 'scheduled' : existing.status,
      updatedAt: now,
      lastError: null
    }).where(eq(newsletters.id, newsletterId))

    if (body.groupIds !== undefined) {
      await db.delete(newsletterGroups).where(eq(newsletterGroups.newsletterId, newsletterId))
      if (groupIds.length) await db.insert(newsletterGroups).values(groupIds.map((groupId) => ({ id: randomUUID(), newsletterId, groupId }))).onConflictDoNothing()
    }
    if (activate) {
      const totalRecipients = await snapshotNewsletterRecipients(newsletterId, groupIds, body.includeInactive === undefined ? existing.includeInactive : Boolean(body.includeInactive))
      await db.update(newsletters).set({ totalRecipients, totalSent: 0, totalFailed: 0, updatedAt: now }).where(eq(newsletters.id, newsletterId))
    }
    let newsletter = existing
    if (activate) {
      ;[newsletter] = await db.select().from(newsletters).where(eq(newsletters.id, newsletterId)).limit(1)
      await processNewsletterCampaign(newsletter, { waitForImport: true })
    }
    ;[newsletter] = await db.select().from(newsletters).where(eq(newsletters.id, newsletterId)).limit(1)
    return NextResponse.json({ success: true, newsletter })
  } catch (error) {
    console.error('Error updating newsletter:', error)
    return NextResponse.json({ error: 'Failed to update newsletter' }, { status: 500 })
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ newsletterId: string }> }) {
  const auth = await getAuthenticatedAdmin('newsletters')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { newsletterId } = await params
  let [newsletter] = await db.select().from(newsletters).where(eq(newsletters.id, newsletterId)).limit(1)
  if (!newsletter) return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 })
  if (newsletter.status !== 'processing') return NextResponse.json({ error: 'Only a message still preparing its recipients can be continued' }, { status: 400 })
  await processNewsletterCampaign(newsletter, { waitForImport: true })
  ;[newsletter] = await db.select().from(newsletters).where(eq(newsletters.id, newsletterId)).limit(1)
  return NextResponse.json({ newsletter })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ newsletterId: string }> }) {
  const auth = await getAuthenticatedAdmin('newsletters')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { newsletterId } = await params
  await db.delete(newsletters).where(and(eq(newsletters.id, newsletterId), eq(newsletters.status, 'draft')))
  return NextResponse.json({ success: true })
}
