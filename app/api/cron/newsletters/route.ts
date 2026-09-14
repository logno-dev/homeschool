import { asc, and, eq, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { newsletterRecipients, newsletters } from '@/lib/schema'
import { createNewsletterBroadcast, createNewsletterContactImport, createNewsletterSegment, getNewsletterBroadcast, getNewsletterContactImport } from '@/lib/email'

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET
  const provided = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  return Boolean(expected && provided === expected)
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Prepare future campaigns early so Resend, rather than this hourly cron,
  // owns the exact send time and delivery pacing.
  const campaigns = await db.select().from(newsletters).where(inArray(newsletters.status, ['scheduled', 'processing', 'provider_scheduled'])).orderBy(asc(newsletters.scheduledAt))
  let prepared = 0
  let sent = 0

  for (const newsletter of campaigns) {
    try {
      if (newsletter.resendBroadcastId) {
        const broadcast = await getNewsletterBroadcast(newsletter.resendBroadcastId)
        if (broadcast.status === 'sent') {
          const acceptedRecipients = await db.select({ id: newsletterRecipients.id }).from(newsletterRecipients).where(and(eq(newsletterRecipients.newsletterId, newsletter.id), eq(newsletterRecipients.status, 'submitted')))
          const sentAt = broadcast.sent_at || new Date().toISOString()
          await db.update(newsletterRecipients).set({ status: 'sent', sentAt }).where(and(eq(newsletterRecipients.newsletterId, newsletter.id), eq(newsletterRecipients.status, 'submitted')))
          await db.update(newsletters).set({ status: 'sent', totalSent: newsletter.totalSent + acceptedRecipients.length, sentAt, updatedAt: new Date().toISOString() }).where(eq(newsletters.id, newsletter.id))
          sent += 1
        } else if (broadcast.status === 'canceled') {
          const acceptedRecipients = await db.select({ id: newsletterRecipients.id }).from(newsletterRecipients).where(and(eq(newsletterRecipients.newsletterId, newsletter.id), eq(newsletterRecipients.status, 'submitted')))
          await db.update(newsletterRecipients).set({ status: 'failed', error: 'The Resend broadcast was canceled.' }).where(and(eq(newsletterRecipients.newsletterId, newsletter.id), eq(newsletterRecipients.status, 'submitted')))
          await db.update(newsletters).set({ status: 'failed', totalFailed: newsletter.totalFailed + acceptedRecipients.length, lastError: 'The Resend broadcast was canceled.', updatedAt: new Date().toISOString() }).where(eq(newsletters.id, newsletter.id))
        }
        continue
      }

      if (newsletter.status === 'scheduled') {
        const claimed = await db.update(newsletters).set({ status: 'processing', updatedAt: new Date().toISOString() }).where(and(eq(newsletters.id, newsletter.id), eq(newsletters.status, 'scheduled')))
        if (claimed.rowsAffected === 0) continue
      }

      const recipients = await db.select().from(newsletterRecipients).where(and(eq(newsletterRecipients.newsletterId, newsletter.id), eq(newsletterRecipients.status, 'pending'))).orderBy(asc(newsletterRecipients.createdAt))
      if (!recipients.length) {
        const status = newsletter.totalRecipients > 0 ? 'sent' : 'failed'
        await db.update(newsletters).set({ status, sentAt: status === 'sent' ? new Date().toISOString() : null, lastError: status === 'failed' ? 'No recipients matched the selected groups.' : null, updatedAt: new Date().toISOString() }).where(eq(newsletters.id, newsletter.id))
        continue
      }

      let segmentId = newsletter.resendSegmentId
      if (!segmentId) {
        segmentId = await createNewsletterSegment(newsletter.id, newsletter.subject || 'DVCLC message')
        await db.update(newsletters).set({ resendSegmentId: segmentId, updatedAt: new Date().toISOString() }).where(eq(newsletters.id, newsletter.id))
      }

      let contactImportId = newsletter.resendContactImportId
      if (!contactImportId) {
        contactImportId = await createNewsletterContactImport(newsletter.id, segmentId, recipients)
        await db.update(newsletters).set({ resendContactImportId: contactImportId, updatedAt: new Date().toISOString() }).where(eq(newsletters.id, newsletter.id))
      }

      const contactImport = await getNewsletterContactImport(contactImportId)
      if (contactImport.status !== 'completed') {
        if (['failed', 'canceled'].includes(contactImport.status)) throw new Error(`Resend contact import ${contactImport.status}`)
        continue
      }
      const importFailures = contactImport.counts?.failed || 0
      if (importFailures >= recipients.length) throw new Error('Resend could not import any campaign recipients')

      const broadcastId = await createNewsletterBroadcast({
        newsletterId: newsletter.id,
        segmentId,
        subject: newsletter.subject,
        html: newsletter.html,
        text: newsletter.text,
        scheduledAt: newsletter.scheduledAt,
        senderAlias: newsletter.senderAlias || undefined,
        replyToAlias: newsletter.replyToAlias || undefined
      })
      const acceptedAt = new Date().toISOString()
      const providerScheduled = Boolean(newsletter.scheduledAt && new Date(newsletter.scheduledAt) > new Date())
      await db.update(newsletterRecipients).set({ status: providerScheduled ? 'submitted' : 'sent', resendId: broadcastId, sentAt: providerScheduled ? null : acceptedAt }).where(and(eq(newsletterRecipients.newsletterId, newsletter.id), eq(newsletterRecipients.status, 'pending')))
      await db.update(newsletters).set({
        resendBroadcastId: broadcastId,
        status: providerScheduled ? 'provider_scheduled' : 'sent',
        totalSent: newsletter.totalSent + (providerScheduled ? 0 : Math.max(0, recipients.length - importFailures)),
        totalFailed: newsletter.totalFailed + importFailures,
        sentAt: providerScheduled ? null : acceptedAt,
        updatedAt: acceptedAt,
        lastError: importFailures ? `${importFailures} recipient${importFailures === 1 ? '' : 's'} could not be imported by Resend.` : null
      }).where(eq(newsletters.id, newsletter.id))
      prepared += 1
      if (!providerScheduled) sent += 1
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown broadcast processing error'
      await db.update(newsletters).set({ status: 'failed', lastError: errorMessage, updatedAt: new Date().toISOString() }).where(eq(newsletters.id, newsletter.id))
    }
  }

  return NextResponse.json({ status: 'completed', campaigns: campaigns.length, prepared, sent })
}
