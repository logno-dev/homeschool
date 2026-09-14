import { asc, and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { newsletterRecipients, newsletters } from '@/lib/schema'
import { createNewsletterBroadcast, createNewsletterContactImport, createNewsletterSegment, getNewsletterBroadcast, getNewsletterContactImport } from '@/lib/email'

export async function processNewsletterCampaign(newsletter: typeof newsletters.$inferSelect): Promise<'pending' | 'prepared' | 'sent' | 'failed'> {
  try {
    if (newsletter.resendBroadcastId) {
      const broadcast = await getNewsletterBroadcast(newsletter.resendBroadcastId)
      if (broadcast.status === 'sent') {
        const acceptedRecipients = await db.select({ id: newsletterRecipients.id }).from(newsletterRecipients).where(and(eq(newsletterRecipients.newsletterId, newsletter.id), eq(newsletterRecipients.status, 'submitted')))
        const sentAt = broadcast.sent_at || new Date().toISOString()
        await db.update(newsletterRecipients).set({ status: 'sent', sentAt }).where(and(eq(newsletterRecipients.newsletterId, newsletter.id), eq(newsletterRecipients.status, 'submitted')))
        await db.update(newsletters).set({ status: 'sent', totalSent: newsletter.totalSent + acceptedRecipients.length, sentAt, updatedAt: new Date().toISOString() }).where(eq(newsletters.id, newsletter.id))
        return 'sent'
      }
      if (broadcast.status === 'canceled') {
        const acceptedRecipients = await db.select({ id: newsletterRecipients.id }).from(newsletterRecipients).where(and(eq(newsletterRecipients.newsletterId, newsletter.id), eq(newsletterRecipients.status, 'submitted')))
        await db.update(newsletterRecipients).set({ status: 'failed', error: 'The Resend broadcast was canceled.' }).where(and(eq(newsletterRecipients.newsletterId, newsletter.id), eq(newsletterRecipients.status, 'submitted')))
        await db.update(newsletters).set({ status: 'failed', totalFailed: newsletter.totalFailed + acceptedRecipients.length, lastError: 'The Resend broadcast was canceled.', updatedAt: new Date().toISOString() }).where(eq(newsletters.id, newsletter.id))
        return 'failed'
      }
      return 'pending'
    }

    if (newsletter.status === 'scheduled') {
      const claimed = await db.update(newsletters).set({ status: 'processing', updatedAt: new Date().toISOString() }).where(and(eq(newsletters.id, newsletter.id), eq(newsletters.status, 'scheduled')))
      if (claimed.rowsAffected === 0) return 'pending'
    }

    const recipients = await db.select().from(newsletterRecipients).where(and(eq(newsletterRecipients.newsletterId, newsletter.id), eq(newsletterRecipients.status, 'pending'))).orderBy(asc(newsletterRecipients.createdAt))
    if (!recipients.length) {
      const status = newsletter.totalRecipients > 0 ? 'sent' : 'failed'
      await db.update(newsletters).set({ status, sentAt: status === 'sent' ? new Date().toISOString() : null, lastError: status === 'failed' ? 'No recipients matched the selected groups.' : null, updatedAt: new Date().toISOString() }).where(eq(newsletters.id, newsletter.id))
      return status
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
      return 'pending'
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
    return providerScheduled ? 'prepared' : 'sent'
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown broadcast processing error'
    await db.update(newsletters).set({ status: 'failed', lastError: errorMessage, updatedAt: new Date().toISOString() }).where(eq(newsletters.id, newsletter.id))
    return 'failed'
  }
}
