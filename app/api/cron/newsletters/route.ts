import { and, asc, eq, lte } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { newsletterRecipients, newsletters } from '@/lib/schema'
import { sendNewsletterBatch } from '@/lib/email'

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET
  const provided = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  return Boolean(expected && provided === expected)
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const due = await db.select().from(newsletters).where(and(eq(newsletters.status, 'scheduled'), lte(newsletters.scheduledAt, new Date().toISOString()))).orderBy(asc(newsletters.scheduledAt))
  let processed = 0
  let batches = 0

  for (const newsletter of due) {
    const claimed = await db.update(newsletters).set({ status: 'processing', updatedAt: new Date().toISOString() }).where(and(eq(newsletters.id, newsletter.id), eq(newsletters.status, 'scheduled')))
    if (claimed.rowsAffected === 0) continue

    try {
      for (let batchNumber = 0; batchNumber < 10; batchNumber += 1) {
        const recipients = await db.select().from(newsletterRecipients).where(and(eq(newsletterRecipients.newsletterId, newsletter.id), eq(newsletterRecipients.status, 'pending'))).orderBy(asc(newsletterRecipients.createdAt)).limit(100)
        if (!recipients.length) {
          await db.update(newsletters).set({ status: 'sent', sentAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(newsletters.id, newsletter.id))
          break
        }

        try {
           const resendIds = await sendNewsletterBatch({ subject: newsletter.subject, html: newsletter.html, text: newsletter.text, recipients, senderAlias: newsletter.senderAlias || undefined, replyToAlias: newsletter.replyToAlias || undefined })
          const sentAt = new Date().toISOString()
          for (const [index, recipient] of recipients.entries()) {
            await db.update(newsletterRecipients).set({ status: 'sent', resendId: resendIds[index] || null, sentAt }).where(eq(newsletterRecipients.id, recipient.id))
          }
          await db.update(newsletters).set({ totalSent: newsletter.totalSent + recipients.length, updatedAt: sentAt }).where(eq(newsletters.id, newsletter.id))
          newsletter.totalSent += recipients.length
          processed += recipients.length
          batches += 1
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown delivery error'
          await db.update(newsletterRecipients).set({ status: 'failed', error: errorMessage }).where(and(eq(newsletterRecipients.newsletterId, newsletter.id), eq(newsletterRecipients.status, 'pending')))
          await db.update(newsletters).set({ status: 'failed', totalFailed: newsletter.totalRecipients - newsletter.totalSent, lastError: errorMessage, updatedAt: new Date().toISOString() }).where(eq(newsletters.id, newsletter.id))
          break
        }
      }

      const [remaining] = await db.select({ id: newsletterRecipients.id }).from(newsletterRecipients).where(and(eq(newsletterRecipients.newsletterId, newsletter.id), eq(newsletterRecipients.status, 'pending'))).limit(1)
      const [current] = await db.select({ status: newsletters.status }).from(newsletters).where(eq(newsletters.id, newsletter.id)).limit(1)
      if (remaining && current?.status === 'processing') {
        await db.update(newsletters).set({ status: 'scheduled', updatedAt: new Date().toISOString() }).where(eq(newsletters.id, newsletter.id))
      } else if (!remaining && current?.status === 'processing') {
        await db.update(newsletters).set({ status: 'sent', sentAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(newsletters.id, newsletter.id))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown newsletter processing error'
      await db.update(newsletters).set({ status: 'failed', lastError: errorMessage, updatedAt: new Date().toISOString() }).where(eq(newsletters.id, newsletter.id))
    }
  }

  return NextResponse.json({ status: 'completed', campaigns: due.length, batches, recipients: processed })
}
